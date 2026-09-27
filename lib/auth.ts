import { createClient } from '@/lib/supabase/server';
export { isAuthConfigured } from '@/lib/supabase/config';

export type AppUser = {
  userId: string;
  email: string;
  fullName: string | null;
  displayName: string;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  // getUser contacts Supabase Auth. Never authorize using client metadata or getSession.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) return null;
  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;
  return { userId: user.id, email: user.email.toLowerCase(), fullName, displayName: fullName || user.email };
}
