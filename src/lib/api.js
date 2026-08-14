import * as FileSystem from 'expo-file-system/legacy';

import { resolveApiUrl } from './config';
import { accessToken } from './supabase';

export const API_URL = resolveApiUrl();

async function request(path, { timeoutMs = 30_000, auth = true, ...init } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : null),
      ...init.headers,
    };

    if (auth) {
      const token = await accessToken();
      if (!token) throw new Error('Not signed in');
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      // FastAPI puts the useful message in `detail`; showing the raw body instead
      // surfaces JSON at the user.
      let detail = '';
      try {
        const body = await response.json();
        detail = body.detail ?? JSON.stringify(body);
      } catch {
        detail = await response.text().catch(() => '');
      }
      throw new Error(detail || `${response.status} ${response.statusText}`);
    }

    return response.status === 204 ? null : await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request('/health', { auth: false }),
  styles: () => request('/api/styles', { auth: false }),

  requestUpload: (payload) =>
    request('/api/memories/upload-url', { method: 'POST', body: JSON.stringify(payload) }),

  completeUpload: (memoryId) =>
    request('/api/memories/complete', {
      method: 'POST',
      body: JSON.stringify({ memory_id: memoryId }),
    }),

  memories: (eventId) => request(`/api/memories?event_id=${eventId}`),

  // One thumbnail per event for a whole list, rather than a full memory listing
  // per card.
  eventCovers: (eventIds) =>
    request('/api/memories/covers', {
      method: 'POST',
      body: JSON.stringify(eventIds),
    }),

  // Takes a list: clearing out a bad batch means twenty at once, not twenty
  // round trips.
  deleteMemories: (memoryIds) =>
    request('/api/memories/delete', {
      method: 'POST',
      body: JSON.stringify(memoryIds),
      timeoutMs: 60_000,
    }),

  /** Called once a batch finishes: duplicates can only be grouped as a set. */
  analyseBatch: (eventId) =>
    request(`/api/memories/analyse?event_id=${eventId}`, { method: 'POST' }),

  summarise: (eventId) =>
    request(`/api/events/${eventId}/summarise`, { method: 'POST', timeoutMs: 120_000 }),

  requestReplay: (eventId, style, albumId = null) =>
    request('/api/replays', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, style, album_id: albumId }),
    }),

  replay: (replayId) => request(`/api/replays/${replayId}`),

  // Signed URLs for a whole feed in one call. Asking per post was sixty round
  // trips before anything appeared.
  replayMedia: (replayIds) =>
    request('/api/replays/media', {
      method: 'POST',
      body: JSON.stringify(replayIds),
    }),

  // The source frames each film was cut from, spaced across its running order.
  replayStrips: (replayIds) =>
    request('/api/replays/strips', {
      method: 'POST',
      body: JSON.stringify(replayIds),
    }),
  eventReplays: (eventId) => request(`/api/events/${eventId}/replays`),

  // ---- editing by hand -------------------------------------------------
  // The plan the renderer executes is an edit decision list, so editing is
  // reading it, changing it and handing it back. No second pipeline.

  /** Open a new edit — blank, or seeded from a film that already exists. */
  draft: (payload) =>
    request('/api/replays/draft', { method: 'POST', body: JSON.stringify(payload) }),

  /** The edit plus every memory it may cut from, in one call. */
  editable: (replayId) => request(`/api/replays/${replayId}/editable`),

  /**
   * Small, easily decoded copies of this edit's video, for editing against.
   *
   * Slow the first time an event is edited — each clip is transcoded — and
   * instant afterwards, since they are kept. Worth the wait: a 4K clip is 16MB
   * and beyond what most phone decoders will touch, and its proxy is 0.5MB of
   * baseline H.264 that anything can play.
   */
  proxies: (replayId) =>
    request(`/api/replays/${replayId}/proxies`, { method: 'POST', timeoutMs: 300_000 }),

  /** Store the edit; `render` also queues it. Everything is re-checked server side. */
  savePlan: (replayId, plan, render = false) =>
    request(`/api/replays/${replayId}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ plan, render }),
      timeoutMs: 45_000,
    }),

  /** Permission to upload a track to score an edit with. */
  audioUploadUrl: (replayId, payload) =>
    request(`/api/replays/${replayId}/audio`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Every track this family has composed, uploaded, or had a render leave behind. */
  musicLibrary: () => request('/api/music'),

  /**
   * Compose a track now and keep it.
   *
   * Deliberately slow — the model takes a minute or two and this waits for it,
   * because the point is to hear the result before committing to it. If the wait
   * runs out the track is still saved server side and turns up in the library, so
   * a timeout costs the wait rather than the work.
   */
  composeMusic: (eventId, payload) =>
    request(`/api/events/${eventId}/music`, {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 240_000,
    }),

  /** Tell the library about a file that went straight from the phone to storage. */
  registerMusic: (payload) =>
    request('/api/music/register', { method: 'POST', body: JSON.stringify(payload) }),

  deleteMusic: (trackId) => request(`/api/music/${trackId}`, { method: 'DELETE' }),
};

/**
 * Upload a file straight to the signed URL.
 *
 * Streams from disk via expo-file-system rather than fetch().blob(): reading a
 * file into a Blob first holds the whole thing in memory, which fails on large
 * photos and never survives a video.
 *
 * The bytes never touch our backend — it only issues permission.
 */
export async function uploadToSignedUrl(uploadUrl, uri, contentType) {
  const result = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status})`);
  }
}
