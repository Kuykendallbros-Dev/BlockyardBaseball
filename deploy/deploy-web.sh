#!/usr/bin/env bash
# Pull-from-main deploy for the BlockyardBaseball-web droplet.
# Run on the box: bash /srv/BlockyardBaseball/deploy/deploy-web.sh
set -euo pipefail
cd /srv/BlockyardBaseball
git fetch origin main
git reset --hard origin/main
npm ci
npm run build
echo "Deployed $(git rev-parse --short HEAD)"
