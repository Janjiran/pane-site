// Static site plus `/download/<file>` served from the R2 bucket (the notarized Pane Relay DMG, uploaded
// by pane-agent/scripts/release.sh). Everything else is a static asset.
export default {
  async fetch(request, env, ctx) {
    // The old workers.dev host (baked into app builds up to 17) moves to the domain, path and query kept.
    const url = new URL(request.url);
    if (url.hostname.endsWith('.workers.dev') || url.hostname === 'www.pane.video') {
      url.hostname = 'pane.video';
      return Response.redirect(url.toString(), 301);
    }
    const match = /^\/download\/([A-Za-z0-9._-]+)$/.exec(new URL(request.url).pathname);
    if (!match) return env.ASSETS.fetch(request);
    const object = await env.DOWNLOADS.get(match[1]);
    if (!object) return new Response('Not found', { status: 404 });
    // Only the DMG: the app's own update check fetches latest.json from here a few times a day.
    if (request.method === 'GET' && match[1].endsWith('.dmg') && firstChunk(request)) ctx.waitUntil(countDownload(env, match[1]));
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('content-disposition', `attachment; filename="${match[1]}"`);
    headers.set('cache-control', 'public, max-age=300');
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  },
};

/** A download, not a HEAD probe or a later range of the same file (Safari fetches a DMG in pieces). */
function firstChunk(request) {
  const range = request.headers.get('range');
  return !range || /^bytes=0-/.test(range);
}

/** One anonymous `relay_downloaded` per download in the app's PostHog project: the file name, no IP, no device. */
function countDownload(env, file) {
  if (!env.POSTHOG_KEY) return Promise.resolve();
  return fetch(`${env.POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: env.POSTHOG_KEY,
      event: 'relay_downloaded',
      distinct_id: crypto.randomUUID(),
      properties: { file, $lib: 'pane-site', $process_person_profile: false, $geoip_disable: true },
    }),
  }).then(() => undefined, () => undefined);
}
