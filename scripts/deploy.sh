#!/bin/bash
# Deploys the site. The stylesheet link carries a content hash so a browser or the edge cache never pairs
# new HTML with an old style.css (that mismatch looked like "visual glitches" on 4 Nov 2026).
set -euo pipefail
cd "$(dirname "$0")/.."
hash=$(shasum -a 256 style.css | cut -c1-8)
for f in index.html relay.html support.html privacy.html review/index.html; do
  [ -f "$f" ] || continue
  sed -i '' -E "s#href=\"(\.\./)?style\.css(\?v=[0-9a-f]+)?\"#href=\"\1style.css?v=$hash\"#" "$f"
done
npx wrangler deploy "$@"
