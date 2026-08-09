// The publishable/anon key is intentionally public in a browser application.
// Database security is enforced by grants, RLS policies and guarded RPC functions.
export const APP_CONFIG = Object.freeze({
  supabaseUrl: 'https://pgupgoijldelucigkpbb.supabase.co',
  supabaseAnonKey: 'sb_publishable_722NTDjoZcOHsSSevUNtNg_BTSEgXK-',
  appName: 'Aatish & Aangan',
  currency: 'PKR',
  timezone: 'Asia/Karachi',
});

export function hasSupabaseConfig() {
  return /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(APP_CONFIG.supabaseUrl)
    && APP_CONFIG.supabaseAnonKey.length > 40
    && !APP_CONFIG.supabaseAnonKey.includes('YOUR_');
}
