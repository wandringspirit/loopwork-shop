// The demo site's Worker. Everything is served from static assets (dist/) except /for-sellers/,
// which wrangler.jsonc routes here (`run_worker_first`). It shows the ₹ sales page to visitors in
// India and the USD one to everyone else, at the same address, using the country Cloudflare
// detects. The pages' "Prices in ₹ / USD" links add ?region=in or ?region=intl, which is
// remembered in a cookie so the choice sticks.
// Not part of a client's copy: `npm run starter` removes this folder.

const PAGES = { in: '/for-sellers/india/', intl: '/for-sellers/international/' };
const COOKIE = 'region';
const YEAR = 60 * 60 * 24 * 365;

/** @param {string | null} header */
const cookieRegion = (header) => header?.match(/(?:^|;\s*)region=(in|intl)\b/)?.[1];

export default {
  /** @param {Request} request @param {{ ASSETS: { fetch: (input: Request | string | URL) => Promise<Response> } }} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/for-sellers' && url.pathname !== '/for-sellers/') return env.ASSETS.fetch(request);

    // A switch link: remember the choice, then come back to the clean address.
    const chosen = url.searchParams.get(COOKIE);
    if (chosen === 'in' || chosen === 'intl') {
      url.searchParams.delete(COOKIE);
      url.pathname = '/for-sellers/';
      return new Response(null, {
        status: 302,
        headers: {
          Location: url.href,
          'Set-Cookie': `${COOKIE}=${chosen}; Path=/for-sellers; Max-Age=${YEAR}; SameSite=Lax; Secure`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    // request.cf.country is an ISO code such as "IN" or "US"; unknown ("XX") and Tor ("T1") get USD.
    const country = /** @type {{ country?: string } | undefined} */ (request.cf)?.country;
    const region = cookieRegion(request.headers.get('Cookie')) ?? (country === 'IN' ? 'in' : 'intl');
    const page = await env.ASSETS.fetch(new URL(PAGES[region], url));

    const headers = new Headers(page.headers);
    headers.delete('ETag'); // the two versions share one address, so don't let caches mix them up
    headers.set('Cache-Control', 'private, no-cache');
    headers.set('Vary', 'Cookie, CF-IPCountry');
    return new Response(page.body, { status: page.status, headers });
  },
};
