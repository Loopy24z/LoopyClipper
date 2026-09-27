import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appOrigin, isSameOriginPost } from '@/lib/supabase/security.mjs';

export async function POST(request: Request) {
  let origin: string;
  try {
    origin = appOrigin(request.url, process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV === 'production');
  } catch {
    return NextResponse.json({ error: 'The application URL has not been configured.' }, { status: 503 });
  }
  if (!isSameOriginPost(request, origin)) return NextResponse.json({ error: 'Request origin not allowed.' }, { status: 403 });
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) return NextResponse.json({ error: 'Sign-out failed. Please try again.' }, { status: 502 });
  }
  const response = NextResponse.redirect(new URL('/login', origin), 303);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
