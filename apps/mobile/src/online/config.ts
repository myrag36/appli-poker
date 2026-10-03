// Both values are public by design: data is protected by row-level security
// and every write goes through the `poker` Edge Function.
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://kjxzzcenvssemsftczfh.supabase.co';
export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_wEjzodJ_O4DwI0EHVt3whQ_QCt9y2xp';
