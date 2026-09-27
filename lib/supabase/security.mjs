/** Only application paths may be used after an OAuth callback. */
export function safeNextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(decoded)) return '/';
    const url = new URL(value, 'https://app.invalid');
    if (url.origin !== 'https://app.invalid' || /^\/(?:auth|login)(?:\/|$)/i.test(decodeURIComponent(url.pathname))) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}

/** Production redirects use a configured origin, never untrusted forwarded headers. */
export function appOrigin(requestUrl, configuredUrl, production = false) {
  if (production && !configuredUrl) throw new Error('NEXT_PUBLIC_APP_URL is required in production.');
  const url = new URL(configuredUrl || requestUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (production && url.protocol !== 'https:')) {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS in production.');
  }
  return url.origin;
}

export function isSameOriginPost(request, origin) {
  return request.method === 'POST' && request.headers.get('origin') === origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
