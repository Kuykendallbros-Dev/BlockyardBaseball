/**
 * Where the client finds the match server, and the one place that decides it.
 *
 * The project's home is `sloppycards.com/games/sloppycardsports/blockyardbaseball`.
 * That site is already served over HTTPS, and a browser refuses a plain `ws://`
 * connection from an HTTPS page as mixed content — which is exactly what
 * blocked online play on the HTTPS builds. Rather than buying a second domain
 * and a second certificate for the API droplet, the match server is reached
 * **through the same origin**: nginx on the sloppycards box proxies a `ws`
 * path straight to the API droplet's port 8080. Same origin, existing
 * certificate, no new DNS record, no new firewall rule.
 *
 * `resolveServerUrl` is pure so the three cases below are actually tested
 * rather than reasoned about.
 */

/** The path the sloppycards nginx proxies to the match server. */
export const WS_PATH_SUFFIX = 'ws';

/**
 * Where the match server is reachable directly, without a TLS proxy in front.
 * Used for local dev and for the plain-HTTP web droplet, neither of which has
 * a mixed-content problem to solve.
 */
export const DIRECT_SERVER_URL = 'ws://104.236.66.46:8080';

export interface PageLocation {
  /** e.g. `'https:'` */
  protocol: string;
  /** host and port, e.g. `'sloppycards.com'` */
  host: string;
}

/**
 * Decide the match-server URL.
 *
 * 1. An explicit `VITE_MATCH_SERVER_URL` always wins — that is the escape
 *    hatch for pointing a build at a local server or a future dedicated
 *    endpoint, and the single thing to change if the hosting moves.
 * 2. On an HTTPS page, connect over `wss://` to this same origin, under the
 *    app's own base path. This is the sloppycards deployment.
 * 3. Otherwise — local dev, or the plain-HTTP droplet — go straight to the
 *    droplet. There is no proxy in front of it there, and no mixed-content
 *    rule to violate.
 *
 * `basePath` is Vite's `BASE_URL`, so the proxied path automatically follows
 * wherever the app is mounted instead of being hardcoded twice.
 */
export function resolveServerUrl(
  location: PageLocation,
  envUrl: string | undefined,
  basePath: string,
): string {
  if (envUrl) return envUrl;

  if (location.protocol === 'https:') {
    const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
    return `wss://${location.host}${base}${WS_PATH_SUFFIX}`;
  }

  return DIRECT_SERVER_URL;
}

/** `resolveServerUrl` applied to the real page. */
export function matchServerUrl(): string {
  return resolveServerUrl(
    window.location,
    import.meta.env?.VITE_MATCH_SERVER_URL as string | undefined,
    import.meta.env?.BASE_URL ?? '/',
  );
}
