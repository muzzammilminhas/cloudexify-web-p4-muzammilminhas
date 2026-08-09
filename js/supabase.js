import { APP_CONFIG, hasSupabaseConfig } from './config.js';

if (!hasSupabaseConfig()) {
  throw new Error('Supabase is not configured yet. Add the project URL and publishable key in js/config.js.');
}

if (!window.supabase?.createClient) {
  throw new Error('The Supabase client library could not be loaded. Check your connection and try again.');
}

export const supabase = window.supabase.createClient(
  APP_CONFIG.supabaseUrl,
  APP_CONFIG.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'aatish-aangan-auth-v1',
    },
    realtime: { params: { eventsPerSecond: 8 } },
  },
);

