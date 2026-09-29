import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfig } from '@/lib/supabase/config';
import { googleProviderStatus } from '@/lib/supabase/provider.mjs';
import { appOrigin, isSameOriginPost, safeNextPath } from '@/lib/supabase/security.mjs';

export async function POST(request: Request) {
  let origin: string;
  try {
    origin = appOrigin(request.url, process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV === 'production');
  } catch {
    return NextResponse.json({ error: 'Google sign-in is not configured. Set the application URL first.' }, { status: 503 });
  }
  if (!isSameOriginPost(request, origin)) return NextResponse.json({ error: 'Request origin not allowed.' }, { status: 403 });
  const providerStatus = await googleProviderStatus(supabaseConfig());
  if (providerStatus !== 'ready') {
    const response = NextResponse.redirect(new URL(`/login?error=${providerStatus}`, origin), 303);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(new URL('/login?error=not_configured', origin), 303);
  const form = await request.formData();
  const next = safeNextPath(form.get('next'));
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.toString(),
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: true,
    },
  });
  const response = NextResponse.redirect(error || !data.url ? new URL('/login?error=oauth_failed', origin) : data.url, 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
