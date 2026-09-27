import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath, appOrigin, isSameOriginPost } from '../lib/supabase/security.mjs';

test('auth return paths cannot leave the app or re-enter an auth endpoint', () => {
  assert.equal(safeNextPath('/?project=abc#clip'), '/?project=abc#clip');
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/%5cevil.test', '/auth/signout', '/auth/callback?code=x', '/login', '/%0d%0aevil', '/%E0%A4%A']) {
    assert.equal(safeNextPath(path), '/', path);
  }
});

test('auth uses the configured origin in production, never forwarded headers', () => {
  assert.equal(appOrigin('http://internal:3000/auth/callback', 'https://loofy.example/', true), 'https://loofy.example');
  assert.equal(appOrigin('http://localhost:5174/auth/google', undefined, false), 'http://localhost:5174');
  assert.throws(() => appOrigin('http://localhost:5174', undefined, true));
  assert.throws(() => appOrigin('http://internal', 'http://loofy.example', true));
  assert.throws(() => appOrigin('http://internal', 'https://user:password@loofy.example', true));
});

test('auth mutations require a same-origin POST, not a cross-site or originless request', () => {
  const origin = 'https://loofy.example';
  assert.equal(isSameOriginPost(new Request(`${origin}/auth/signout`, { method: 'POST', headers: { origin } }), origin), true);
  for (const request of [
    new Request(`${origin}/auth/signout`),
    new Request(`${origin}/auth/signout`, { method: 'POST' }),
    new Request(`${origin}/auth/signout`, { method: 'POST', headers: { origin: 'https://evil.test' } }),
    new Request(`${origin}/auth/signout`, { method: 'POST', headers: { origin, 'sec-fetch-site': 'cross-site' } }),
  ]) assert.equal(isSameOriginPost(request, origin), false);
});
