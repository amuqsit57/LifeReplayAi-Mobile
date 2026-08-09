import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { readExtra } from './config';

const url = readExtra('supabaseUrl');
const anonKey = readExtra('supabaseAnonKey');

if (!url || !anonKey) {
  // Fail at startup rather than letting each screen fail separately with an
  // unrelated-looking error.
  throw new Error(
    'Missing supabaseUrl / supabaseAnonKey in app.json under expo.extra.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no URL bar to parse a session out of.
    detectSessionInUrl: false,
  },
});

/** The backend authorises requests with the caller's Supabase access token. */
export async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
