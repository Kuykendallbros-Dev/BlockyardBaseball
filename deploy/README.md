# Deploy — BlockyardBaseball-web droplet

GitHub `main` is the source of truth, not the droplet. The box only ever
pulls; nothing is edited in place there.

- **Box:** `BlockyardBaseball-web` (DigitalOcean, nyc3), nginx serving the
  Vite build from `/srv/BlockyardBaseball/dist`, config at
  `/etc/nginx/sites-available/blockyardbaseball` (mirrors `nginx-web.conf`
  in this folder — update both if it changes).
- **Redeploy:** `ssh root@<web-droplet-ip> 'bash /srv/BlockyardBaseball/deploy/deploy-web.sh'`
  after merging to `main` — pulls, rebuilds, done (nginx serves the rebuilt
  `dist/` directly, no restart needed for content-only changes).
- **First-time box setup** (already done once): `apt-get install nginx git
  nodejs`, clone this repo to `/srv/BlockyardBaseball`, copy
  `nginx-web.conf` to `/etc/nginx/sites-available/blockyardbaseball`, symlink
  it into `sites-enabled`, `systemctl restart nginx`.
- GitHub Pages (`kuykendallbros-dev.github.io/BlockyardBaseball`) is still
  live in parallel for now; not torn down as part of this change.
