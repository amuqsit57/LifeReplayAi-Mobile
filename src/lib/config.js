import Constants from 'expo-constants';

/**
 * Read a string from app.json's `expo.extra`.
 *
 * Expo resolves a `null` value there to an empty object at runtime, which is
 * truthy — so require a real non-empty string rather than trusting truthiness.
 */
export function readExtra(key) {
  const value = Constants.expoConfig?.extra?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

const DEFAULT_API_PORT = 8000;

/**
 * Where the FastAPI backend lives.
 *
 * Falls back to the host Metro is served from, which is what lets a physical
 * device reach the laptop without anyone hardcoding a LAN IP.
 */
export function resolveApiUrl() {
  const configured = readExtra('apiUrl');
  if (configured) return configured.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (typeof hostUri === 'string' && hostUri) {
    return `http://${hostUri.split(':')[0]}:${DEFAULT_API_PORT}`;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
}
