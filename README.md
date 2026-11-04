# pane-site

Public website for **Pane: Remote Desktop for Mac** (iOS / iPadOS VNC & Screen Sharing client).

Static HTML, no build step. Served by a Cloudflare Worker (`npx wrangler deploy`; `src/worker.js` also serves `/download/*` from the `pane-downloads` R2 bucket). GitHub Pages still serves the frozen `github-pages` branch for links baked into older app builds; `main` is not published there anymore.

- https://pane-site.jiranjan03.workers.dev/ — landing (GitHub Pages copy: https://janjiran.github.io/pane-site/)
- https://janjiran.github.io/pane-site/privacy.html — privacy policy
- https://janjiran.github.io/pane-site/support.html — support
- https://janjiran.github.io/pane-site/review/ — App Review demo videos (keep online until the version is approved)

Edit the `.html` files directly, commit, and `npx wrangler deploy`.
