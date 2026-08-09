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

  return { kind: isVideo ? 'video' : 'photo', filename: name, contentType: mime };
}

const STAGING_DIR = `${FileSystem.cacheDirectory}lifereplay-uploads/`;

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
    const { kind, filename, contentType } = describe(asset);
    const target = `${STAGING_DIR}${Date.now()}-${index}-${filename}`;
    try {
      await FileSystem.copyAsync({ from: asset.uri, to: target });
      staged.push({ asset, uri: target, kind, filename, contentType });
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
  });

  onProgress?.('uploading');
  await uploadToSignedUrl(ticket.upload_url, item.uri, item.contentType);

  onProgress?.('finishing');
  return api.completeUpload(ticket.memory_id);
}

export async function uploadAll(eventId, assets, onEach) {
  onEach?.({ index: 0, total: assets.length, phase: 'preparing' });
  const staged = await stageAssets(assets);

  const results = [];
  try {
    for (const [index, item] of staged.entries()) {
      if (item.error) {
        console.warn(`[upload] ${item.filename} could not be staged: ${item.error}`);
        results.push({ ok: false, error: item.error, file: item.filename });
        continue;
      }

      try {
        const memory = await uploadStaged(eventId, item, (phase) =>
          onEach?.({ index, total: staged.length, phase })
        );
        results.push({ ok: true, memory });
      } catch (error) {
        // One bad file should not abandon the rest of someone's upload, but the
        // reason has to survive — a bare count is impossible to act on.
        console.warn(`[upload] ${item.filename} failed:`, error);
        results.push({ ok: false, error: error.message, file: item.filename });
      }
    }
  } finally {
    await clearStaging();
  }

  return results;
}
