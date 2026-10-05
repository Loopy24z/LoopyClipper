import { Scissors, ArrowRight } from 'lucide-react';
import { getCurrentUser, isAuthConfigured } from '@/lib/auth';
import { supabaseConfig } from '@/lib/supabase/config';
import { googleProviderStatus } from '@/lib/supabase/provider.mjs';
import { safeNextPath } from '@/lib/supabase/security.mjs';
import './login.css';

export const dynamic = 'force-dynamic';

const errors: Record<string, string> = {
  not_configured: 'Google sign-in is not connected yet. Please ask the workspace owner to finish setup.',
  unavailable: 'Sign-in is temporarily unavailable. Please reload this page and try again.',
  oauth_failed: 'Google sign-in could not start. Please try again or ask the workspace owner to check the Google provider.',
  callback_failed: 'Sign-in could not be completed. Please try again in the same browser window.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const configured = isAuthConfigured();
  const providerStatus = configured ? await googleProviderStatus(supabaseConfig()) : 'not_configured';
  const user = configured ? await getCurrentUser() : null;
  const error = typeof params.error === 'string' ? errors[params.error] : undefined;
  return <main className="login-screen">
    <section className="login-card" aria-labelledby="login-title">
      <a href="/" className="brand login-brand"><span className="brand-icon"><img src="/loofyai-mark.svg" alt="" width="48" height="48"/></span><span>Loofy<span className="brand-light">AI</span></span></a>
      <p className="eyebrow">YOUR CREATIVE WORKSPACE</p>
      <h1 id="login-title">Your ideas. A new dimension.</h1>
      <p className="login-intro">Sign in with Google to keep your videos, captions, and clips in your private workspace.</p>
      {error && <p className="notice error" role="alert">{error}</p>}
        {user && <div className="login-existing"><p>Signed in as <strong>{user.email}</strong></p><a className="primary" href={next}>Continue to workspace <ArrowRight size={18}/></a></div>}
      {providerStatus !== 'ready' ? <div className="notice" role="status"><p>{errors[providerStatus]}</p>{providerStatus === 'unavailable' && <a href="/login">Retry sign-in</a>}</div> : <>
        <form method="post" action="/auth/google">
          <input type="hidden" name="next" value={next}/>
          <button className="google-login" type="submit"><svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4.1 6v5h6.6c3.9-3.6 6.1-8.7 6.1-14.7z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.5 16.1 44 24 44z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.2H5.8a20 20 0 0 0 0 17.8z"/><path fill="#EA4335" d="M24 11.9c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4C16.1 4 9.2 8.5 5.8 15.1l6.8 5.2c1.6-4.8 6.1-8.4 11.4-8.4z"/></svg>{user ? 'Choose another Google account' : 'Continue with Google'}</button>
        </form>
        <p className="login-note">Choose your account on Google. LoofyAI never asks for your Google password.</p>
      </>}
    </section>
  </main>;
}
