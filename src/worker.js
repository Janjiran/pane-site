// Static site plus `/download/<file>` served from the R2 bucket (the notarized Pane Relay DMG, uploaded
// by pane-agent/scripts/release.sh). Everything else is a static asset.
const BOT = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless|lighthouse|facebookexternalhit|whatsapp/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // One address per page: https, the bare domain, no `.html`. The old workers.dev host (baked into app
    // builds up to 17) and plain http land here too, path and query kept. `pnpm dev` sets DEV: wrangler
    // serves the route's host over http there.
    if (!env.DEV) {
      const html = /^(.*?)(\/index)?\.html$/.exec(url.pathname);
      if (url.protocol === 'http:' || url.hostname !== 'pane.video' || html) {
        url.protocol = 'https:';
        url.hostname = 'pane.video';
        url.port = '';
        if (html) url.pathname = html[2] ? `${html[1]}/` : html[1];
        return Response.redirect(url.toString(), 301);
      }
    }
    const match = /^\/download\/([A-Za-z0-9._-]+)$/.exec(url.pathname);
    if (!match) return page(request, env, ctx, url);
    const object = await env.DOWNLOADS.get(match[1]);
    if (!object) return new Response('Not found', { status: 404 });
    // Only the DMG: the app's own update check fetches latest.json from here a few times a day.
    if (request.method === 'GET' && match[1].endsWith('.dmg') && firstChunk(request)) {
      ctx.waitUntil(capture(env, 'relay_downloaded', { file: match[1], device: device(request) }));
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('content-disposition', `attachment; filename="${match[1]}"`);
    headers.set('cache-control', 'public, max-age=300');
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  },
};

/** A static asset. Pages are counted (no cookie, no identifier); images may be cached for a week. */
async function page(request, env, ctx, url) {
  // `/get/<source>` is `/get` with the source in the path: the app types that address into Spotlight on the
  // Mac, where a `?` is one more key to get wrong.
  const alias = /^\/get\/([a-z-]+)$/.exec(url.pathname);
  const pathname = alias ? '/get' : url.pathname;
  const asset = await env.ASSETS.fetch(alias ? new Request(new URL('/get', url), request) : request);
  const response = new Response(asset.body, asset);
  response.headers.set('strict-transport-security', 'max-age=31536000');
  if (url.pathname.startsWith('/img/') && asset.status === 200) response.headers.set('cache-control', 'public, max-age=604800');
  const isPage = request.method === 'GET' && asset.status === 200 && (asset.headers.get('content-type') ?? '').includes('text/html');
  if (isPage && !url.pathname.startsWith('/review') && !BOT.test(request.headers.get('user-agent') ?? '')) {
    ctx.waitUntil(capture(env, '$pageview', {
      $pathname: pathname,
      $current_url: `${url.origin}${pathname}`,
      $referring_domain: referrer(request),
      device: device(request),
      // Where a link to the page came from: the app's own links and the "send to my Mac" share carry `s`.
      source: alias?.[1] ?? url.searchParams.get('s') ?? url.searchParams.get('utm_source') ?? undefined,
    }));
  }
  return response;
}

/** A download, not a HEAD probe or a later range of the same file (Safari fetches a DMG in pieces). */
function firstChunk(request) {
  const range = request.headers.get('range');
  return !range || /^bytes=0-/.test(range);
}

/** phone, tablet, mac or other, from the user agent. An iPad asking for the desktop site reads as mac. */
function device(request) {
  const ua = request.headers.get('user-agent') ?? '';
  if (/iPhone|iPod|Android.*Mobile/.test(ua)) return 'phone';
  if (/iPad|Android/.test(ua)) return 'tablet';
  return /Macintosh/.test(ua) ? 'mac' : 'other';
}

/** The site that linked here, or `$direct`. Never the full referring address. */
function referrer(request) {
  try {
    const host = new URL(request.headers.get('referer') ?? '').hostname;
    return host && host !== 'pane.video' ? host : '$direct';
  } catch {
    return '$direct';
  }
}

/** One anonymous event in the app's PostHog project: a random id per event, no IP, no location, no profile. */
function capture(env, event, properties) {
  if (!env.POSTHOG_KEY) return Promise.resolve();
  return fetch(`${env.POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: env.POSTHOG_KEY,
      event,
      distinct_id: crypto.randomUUID(),
      properties: { ...properties, $lib: 'pane-site', $process_person_profile: false, $geoip_disable: true },
    }),
  }).then(() => undefined, () => undefined);
}
