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
        : 'image/jpeg');

  return { kind: isVideo ? 'video' : 'photo', filename: name, contentType: mime };
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

  onProgress?.('requesting');
  const ticket = await api.requestUpload({
    event_id: eventId,
    filename,
    content_type: contentType,
    kind,
    bytes: asset.fileSize ?? null,
  });

  onProgress?.('uploading');
  await uploadToSignedUrl(ticket.upload_url, asset.uri, contentType);

  onProgress?.('finishing');
  return api.completeUpload(ticket.memory_id);
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
      // One bad file should not abandon the rest of someone's upload.
      results.push({ ok: false, error: error.message });
    }
  }
  return results;
}
