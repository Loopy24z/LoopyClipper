export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}

export function isAuthConfigured() {
  if (!supabaseConfig()) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    const url = new URL(process.env.NEXT_PUBLIC_APP_URL || '');
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
