// The demo site's Worker. Everything is served from static assets (dist/) except /sell, which
// wrangler.jsonc routes here (`run_worker_first`): it sends visitors in India to the ₹ sales page
// and everyone else to the USD one, using the country Cloudflare detects for the request.
// Not part of a client's copy: `npm run starter` removes this folder.

const INDIA_PAGE = '/for-sellers/';
const INTERNATIONAL_PAGE = '/for-sellers/international/';

export default {
  /** @param {Request} request @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/sell' && url.pathname !== '/sell/') return env.ASSETS.fetch(request);

    // request.cf.country is an ISO code such as "IN" or "US"; unknown ("XX") and Tor ("T1") go international.
    const country = /** @type {{ country?: string } | undefined} */ (request.cf)?.country;
    const target = new URL(country === 'IN' ? INDIA_PAGE : INTERNATIONAL_PAGE, url);
    target.search = url.search;
    return new Response(null, {
      status: 302,
      headers: { Location: target.href, 'Cache-Control': 'private, no-store', Vary: 'CF-IPCountry' },
    });
  },
};
