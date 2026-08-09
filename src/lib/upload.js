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

/**
 * Give the uploader a real file to stream from.
 *
 * Android's picker hands back `content://` URIs for some assets and cached
 * `file://` paths for others, and the streaming uploader can only read the latter.
 * Copying into the cache first makes every asset behave the same way.
 */
async function ensureLocalFile(uri, filename) {
  if (uri.startsWith('file://')) return { uri, cleanup: null };

  const target = `${FileSystem.cacheDirectory}upload-${Date.now()}-${filename}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  return { uri: target, cleanup: () => FileSystem.deleteAsync(target, { idempotent: true }) };
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
export async function uploadMemory(eventId, asset, onProgress) {
  const { kind, filename, contentType } = describe(asset);

  onProgress?.('preparing');
  const local = await ensureLocalFile(asset.uri, filename);

  try {
    onProgress?.('requesting');
    const ticket = await api.requestUpload({
      event_id: eventId,
      filename,
      content_type: contentType,
      kind,
      bytes: asset.fileSize ?? null,
    });

    onProgress?.('uploading');
    await uploadToSignedUrl(ticket.upload_url, local.uri, contentType);

    onProgress?.('finishing');
    return await api.completeUpload(ticket.memory_id);
  } finally {
    await local.cleanup?.().catch(() => {});
  }
}

export async function uploadAll(eventId, assets, onEach) {
  const results = [];
  for (const [index, asset] of assets.entries()) {
    try {
      const memory = await uploadMemory(eventId, asset, (phase) =>
        onEach?.({ index, total: assets.length, phase })
      );
      results.push({ ok: true, memory });
    } catch (error) {
      // One bad file should not abandon the rest of someone's upload, but the
      // reason has to survive — a bare count is impossible to act on.
      const name = asset.fileName || asset.uri.split('/').pop();
      console.warn(`[upload] ${name} failed:`, error);
      results.push({ ok: false, error: error.message, file: name });
    }
  }
  return results;
}
