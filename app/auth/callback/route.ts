import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appOrigin, safeNextPath } from '@/lib/supabase/security.mjs';

export async function GET(request: Request) {
  let origin: string;
  try {
    origin = appOrigin(request.url, process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV === 'production');
  } catch {
    return NextResponse.json({ error: 'The application URL has not been configured.' }, { status: 503 });
  }
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const supabase = await createClient();
  let destination = '/login?error=callback_failed';
  if (code && supabase && !params.has('error')) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) destination = safeNextPath(params.get('next'));
  }
  const response = NextResponse.redirect(new URL(destination, origin), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
