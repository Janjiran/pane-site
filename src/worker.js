// Static site plus `/download/<file>` served from the R2 bucket (the notarized Pane Relay DMG, uploaded
// by pane-agent/scripts/release.sh). Everything else is a static asset.
export default {
  async fetch(request, env) {
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
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('content-disposition', `attachment; filename="${match[1]}"`);
    headers.set('cache-control', 'public, max-age=300');
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  },
};
