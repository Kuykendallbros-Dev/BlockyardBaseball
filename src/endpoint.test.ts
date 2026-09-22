import { describe, expect, it } from 'vitest';
import { DIRECT_SERVER_URL, resolveServerUrl } from './endpoint.ts';

const HTTPS = { protocol: 'https:', host: 'sloppycards.com' };
const HTTP = { protocol: 'http:', host: '138.197.112.139' };
const LOCAL = { protocol: 'http:', host: 'localhost:5173' };

describe('resolveServerUrl', () => {
  it('lets an explicit build-time URL override everything', () => {
    expect(resolveServerUrl(HTTPS, 'ws://localhost:8080', '/')).toBe('ws://localhost:8080');
    expect(resolveServerUrl(HTTP, 'wss://example.test/ws', '/')).toBe('wss://example.test/ws');
  });

  it('uses a same-origin wss path under the app base on an HTTPS page', () => {
    expect(
      resolveServerUrl(HTTPS, undefined, '/games/sloppycardsports/blockyardbaseball/'),
    ).toBe('wss://sloppycards.com/games/sloppycardsports/blockyardbaseball/ws');
  });

  it('tolerates a base path missing its trailing slash', () => {
    expect(
      resolveServerUrl(HTTPS, undefined, '/games/sloppycardsports/blockyardbaseball'),
    ).toBe('wss://sloppycards.com/games/sloppycardsports/blockyardbaseball/ws');
  });

  it('handles an app mounted at the site root', () => {
    expect(resolveServerUrl(HTTPS, undefined, '/')).toBe('wss://sloppycards.com/ws');
  });

  it('keeps the port when the HTTPS host carries one', () => {
    expect(resolveServerUrl({ protocol: 'https:', host: 'example.test:8443' }, undefined, '/')).toBe(
      'wss://example.test:8443/ws',
    );
  });

  it('connects straight to the droplet from a plain-HTTP page', () => {
    // No TLS proxy in front of the API box there, and no mixed-content rule
    // to violate, so the direct connection is correct rather than a fallback.
    expect(resolveServerUrl(HTTP, undefined, '/')).toBe(DIRECT_SERVER_URL);
  });

  it('connects straight to the droplet from local dev', () => {
    expect(resolveServerUrl(LOCAL, undefined, '/')).toBe(DIRECT_SERVER_URL);
  });

  it('treats an empty env value as unset rather than as a URL', () => {
    expect(resolveServerUrl(HTTP, '', '/')).toBe(DIRECT_SERVER_URL);
  });
});
