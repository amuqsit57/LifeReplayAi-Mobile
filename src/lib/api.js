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

  summarise: (eventId) =>
    request(`/api/events/${eventId}/summarise`, { method: 'POST', timeoutMs: 120_000 }),

  requestReplay: (eventId, style) =>
    request('/api/replays', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, style }),
    }),

  replay: (replayId) => request(`/api/replays/${replayId}`),
  eventReplays: (eventId) => request(`/api/events/${eventId}/replays`),
};

/**
 * Upload a file straight to the signed URL.
 *
 * The bytes never touch our backend — it only issues permission — which is what
 * keeps a 200MB video from being proxied through a Python process.
 */
export async function uploadToSignedUrl(uploadUrl, uri, contentType) {
  const file = await fetch(uri);
  const blob = await file.blob();

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}
