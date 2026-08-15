import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { api, uploadToSignedUrl } from './api';

/** Map a picker asset to the memory kind and a sane MIME type. */
function describe(asset) {
  const isVideo = asset.type === 'video';
  const name = asset.fileName || asset.uri.split('/').pop() || (isVideo ? 'clip.mp4' : 'photo.jpg');
  const extension = name.split('.').pop()?.toLowerCase();

  const mime =
    asset.mimeType ||
    (isVideo
      ? extension === 'mov'
        ? 'video/quicktime'
        : 'video/mp4'
      : extension === 'png'
        ? 'image/png'
        : extension === 'heic'
          ? 'image/heic'
          : 'image/jpeg');

  return {
    kind: isVideo ? 'video' : 'photo',
    filename: name,
    contentType: mime,
    capturedAt: capturedAt(asset),
  };
}

/**
 * When the shot was taken, read from EXIF.
 *
 * EXIF writes "2024:06:15 14:30:00" — colons in the date, and no timezone. It is
 * the camera's local time, which is the right thing to keep: everyone at the same
 * wedding shares it, so their photos interleave correctly however many days apart
 * they get around to uploading.
 *
 * Videos carry no EXIF here, but their capture time is in the container and the
 * backend reads it while probing.
 */
function capturedAt(asset) {
  const exif = asset?.exif || {};
  const raw =
    exif.DateTimeOriginal ||
    exif.DateTimeDigitized ||
    exif.DateTime ||
    exif['{Exif}']?.DateTimeOriginal ||
    null;

  if (typeof raw !== 'string') return null;

  const parts = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!parts) return null;

  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const when = new Date(year, month - 1, day, hour, minute, second);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

const STAGING_DIR = `${FileSystem.cacheDirectory}lifereplay-uploads/`;

// How many files go up at once. Enough to hide the round trip on each one,
// few enough that a phone's upstream is not split into uselessly thin shares.
const UPLOAD_LANES = 3;

async function ensureStagingDir() {
  const info = await FileSystem.getInfoAsync(STAGING_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(STAGING_DIR, { intermediates: true });
  }
}

/**
 * Copy every picked asset somewhere we control, before uploading any of them.
 *
 * The picker stores its results in a cache directory that Android clears while a
 * long batch is still running — the first files upload, then the rest fail with
 * "directory doesn't exist" because the originals were deleted underneath us.
 * Snapshotting up front, while they are all still present, is the only reliable
 * way to survive a multi-file upload.
 */
async function stageAssets(assets) {
  await ensureStagingDir();

  const staged = [];
  for (const [index, asset] of assets.entries()) {
    const { kind, filename, contentType, capturedAt } = describe(asset);
    const target = `${STAGING_DIR}${Date.now()}-${index}-${filename}`;
    try {
      await FileSystem.copyAsync({ from: asset.uri, to: target });
      staged.push({ asset, uri: target, kind, filename, contentType, capturedAt });
    } catch (error) {
      staged.push({ asset, error: `Could not read the file: ${error.message}`, filename });
    }
  }
  return staged;
}

async function clearStaging() {
  await FileSystem.deleteAsync(STAGING_DIR, { idempotent: true }).catch(() => {});
}

export async function pickMemories() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Life Replay needs access to your photos to add memories.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    // Array form, not MediaTypeOptions: the enum is deprecated in expo-image-picker
    // 17 and silently returns images only, so videos never reach the vault.
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    quality: 0.9,
    // Nobody should have to sort their camera roll before contributing.
    selectionLimit: 30,
    // Needed for the capture date. Without it the only timestamp an event has is
    // the upload, so a wedding shot by four guests is cut in the order they got
    // home rather than in the order the day happened.
    exif: true,
  });

  return result.canceled ? [] : result.assets;
}

/**
 * Upload one asset: reserve a row, PUT the bytes to the signed URL, then confirm.
 *
 * Confirming is a separate call so a failed upload leaves the memory visibly
 * `uploading` rather than silently missing.
 */
async function uploadStaged(eventId, item, onProgress) {
  onProgress?.('requesting');
  const ticket = await api.requestUpload({
    event_id: eventId,
    filename: item.filename,
    content_type: item.contentType,
    kind: item.kind,
    bytes: item.asset.fileSize ?? null,
    captured_at: item.capturedAt ?? null,
  });

  onProgress?.('uploading');
  await uploadToSignedUrl(ticket.upload_url, item.uri, item.contentType);

  onProgress?.('finishing');
  return api.completeUpload(ticket.memory_id);
}

export async function uploadAll(eventId, assets, onEach) {
  onEach?.({ index: 0, total: assets.length, phase: 'preparing' });
  const staged = await stageAssets(assets);

  const results = new Array(staged.length);
  let done = 0;

  // Three at a time.
  //
  // One at a time meant every file waited out the round trip of the one before
  // it — a ticket, the bytes, a confirmation — and on a batch of thirty that is
  // mostly latency rather than transfer. Three keeps the connection busy without
  // the phone splitting its upstream so many ways that each one crawls.
  const queue = staged.map((item, index) => ({ item, index }));

  async function worker() {
    while (queue.length) {
      const { item, index } = queue.shift();

      if (item.error) {
        console.warn(`[upload] ${item.filename} could not be staged: ${item.error}`);
        results[index] = { ok: false, error: item.error, file: item.filename };
        done += 1;
        continue;
      }

      try {
        const memory = await uploadStaged(eventId, item, (phase) =>
          onEach?.({ index: done, total: staged.length, phase })
        );
        results[index] = { ok: true, memory };
      } catch (error) {
        // One bad file should not abandon the rest of someone's upload, but the
        // reason has to survive — a bare count is impossible to act on.
        console.warn(`[upload] ${item.filename} failed:`, error);
        results[index] = { ok: false, error: error.message, file: item.filename };
      }

      done += 1;
      onEach?.({ index: done, total: staged.length, phase: 'uploading' });
    }
  }

  try {
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_LANES, staged.length) }, worker)
    );
  } finally {
    await clearStaging();
  }

  return results;
}
