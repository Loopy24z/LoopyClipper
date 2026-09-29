/**
 * Public provider availability only; this never authenticates or authorizes a user.
 * @param {{ url: string, key: string } | null} config
 * @param {typeof fetch} fetcher
 * @returns {Promise<'ready' | 'not_configured' | 'unavailable'>}
 */
export async function googleProviderStatus(config, fetcher = fetch) {
  if (!config) return 'not_configured';
  try {
    const response = await fetcher(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return 'unavailable';
    const settings = await response.json();
    if (settings?.external?.google === true) return 'ready';
    if (settings?.external?.google === false) return 'not_configured';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}
