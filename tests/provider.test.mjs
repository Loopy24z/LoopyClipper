import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleProviderStatus } from '../lib/supabase/provider.mjs';

const config = { url: 'https://project.supabase.co', key: 'public-test-key' };

test('Google login requires an enabled remote provider, not just a project URL', async () => {
  for (const enabled of [true, false]) {
    const result = await googleProviderStatus(config, async (url, options) => {
      assert.equal(url, `${config.url}/auth/v1/settings`);
      assert.equal(options.headers.apikey, config.key);
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
      return Response.json({ external: { google: enabled } });
    });
    assert.equal(result, enabled ? 'ready' : 'not_configured');
  }
});

test('missing config and provider outages have distinct retryable outcomes', async () => {
  assert.equal(await googleProviderStatus(null, () => { throw new Error('must not fetch'); }), 'not_configured');
  for (const fetcher of [
    async () => new Response('', { status: 503 }),
    async () => { throw new Error('timeout'); },
    async () => Response.json({}),
    async () => new Response('not json'),
  ]) assert.equal(await googleProviderStatus(config, fetcher), 'unavailable');
});
