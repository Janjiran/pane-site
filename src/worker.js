// Static site plus `/download/<file>` served from the R2 bucket (the notarized Pane Relay DMG, uploaded
// by pane-agent/scripts/release.sh). Everything else is a static asset.
export default {
  async fetch(request, env) {
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
