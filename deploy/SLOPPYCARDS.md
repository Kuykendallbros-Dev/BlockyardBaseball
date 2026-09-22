# Hosting Blockyard Baseball on sloppycards.com

**Decision (2026-09-22, Tracy):** the game lives at
`https://sloppycards.com/games/sloppycardsports/blockyardbaseball`.

## What is already true

- `sloppycards.com` is registered (through 2027) with DNS at GoDaddy
  (`ns31/ns32.domaincontrol.com`), resolving to **159.65.163.216**.
- That box runs a live Next.js site behind **nginx/1.24.0 (Ubuntu)** with
  working HTTPS.
- `/games` and the target path currently return 404 — nothing is there yet.
- The match server runs on a **separate** droplet, `BlockyardBaseball-API`
  (104.236.66.46), as the `blockyardapi` systemd service on port 8080. Its
  cloud firewall allows 22 and 8080 only; 80 and 443 are closed.

## The design, and why

The game is static files, so it is just an nginx `alias` under the path.

The interesting part is the match server. It speaks plain `ws://`, and a
browser on an HTTPS page refuses a plain `ws://` connection as mixed content —
that is precisely what blocked online play on every HTTPS build so far.

Rather than buy a second domain and run a second certificate on the API
droplet, **nginx on the sloppycards box proxies the WebSocket** at
`/games/sloppycardsports/blockyardbaseball/ws` straight through to
`104.236.66.46:8080`. The browser only ever sees `wss://sloppycards.com`,
reusing the certificate that already exists.

That means **no new domain, no new certificate, no DNS record, and no new
inbound port on the API droplet.** It also keeps everything same-origin.

## Deploy steps (needs access this machine does not have)

This machine holds only `~/.ssh/blockyard_do_ed25519`, which the sloppycards
box rejects. Steps 1–3 must be run by someone with access to 159.65.163.216.

1. **Place the build.** On the sloppycards box:

   ```bash
   git clone https://github.com/Kuykendallbros-Dev/BlockyardBaseball /srv/blockyardbaseball
   cd /srv/blockyardbaseball
   npm ci
   VITE_BASE_PATH=/games/sloppycardsports/blockyardbaseball/ npm run build
   ```

   The `VITE_BASE_PATH` variable is what makes the bundle request its own
   assets from that prefix. Leaving it off produces a build that 404s every
   asset.

2. **Add the nginx blocks** from [`sloppycards-nginx.conf`](./sloppycards-nginx.conf)
   to the existing HTTPS server block, then `nginx -t && systemctl reload nginx`.

3. **Verify:**

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' https://sloppycards.com/games/sloppycardsports/blockyardbaseball/
   ```

   Then open the page and use **Play online** from two browsers. The client
   resolves the socket URL itself (see `src/endpoint.ts`); nothing needs
   configuring at runtime.

## Where the endpoint is decided

One file: **`src/endpoint.ts`**.

- An explicit `VITE_MATCH_SERVER_URL` at build time always wins.
- Otherwise, on an HTTPS page it uses `wss://<host><base path>ws` — the
  proxy above.
- Otherwise (local dev, the plain-HTTP web droplet) it connects directly to
  `ws://104.236.66.46:8080`, where there is no mixed-content rule to violate.

So the existing GitHub Pages and web-droplet deploys keep working unchanged,
and the sloppycards deploy picks up `wss://` with no code edit.

## Still open

- **`staging.sloppycards.com` does not exist.** The standing deploy model puts
  development on `staging.<domain>` and production on the bare domain. Neither
  a staging subdomain nor a staging path has been set up for this project yet;
  worth deciding before this becomes the live URL.
- **The DigitalOcean API token on this machine is expired** (401). Not needed
  for the design above, but it does block any firewall or droplet change.
