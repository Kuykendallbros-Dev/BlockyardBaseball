import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOnlineClient,
  type ClientMessage,
  type OnlineClient,
  type OnlineHandlers,
  type ServerMessage,
  type SocketLike,
} from './online.ts';
import { newGame } from './game/game.ts';
import { rollPitch } from './game/pitching.ts';

/**
 * A stand-in for `WebSocket` that records what the client sent and lets a test
 * push server frames in by hand. Nothing here touches the network, so the
 * whole protocol state machine is exercised deterministically.
 */
class FakeSocket implements SocketLike {
  sent: ClientMessage[] = [];
  closed = false;
  onopen: ((this: unknown, ev: unknown) => unknown) | null = null;
  onclose: ((this: unknown, ev: unknown) => unknown) | null = null;
  onerror: ((this: unknown, ev: unknown) => unknown) | null = null;
  onmessage: ((this: unknown, ev: { data: unknown }) => unknown) | null = null;

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ClientMessage);
  }

  close(): void {
    this.closed = true;
    this.onclose?.call(this, {});
  }

  /** Simulate the socket finishing its handshake. */
  open(): void {
    this.onopen?.call(this, {});
  }

  /** Simulate a frame arriving from the server. */
  deliver(message: ServerMessage): void {
    this.onmessage?.call(this, { data: JSON.stringify(message) });
  }

  /** Simulate a malformed frame. */
  deliverRaw(data: string): void {
    this.onmessage?.call(this, { data });
  }
}

const PITCH = rollPitch(() => 0.5);

function matchStart(side: 'away' | 'home'): ServerMessage {
  return {
    type: 'matchStart',
    side,
    you: { name: 'You', rating: 1200 },
    opponent: { name: 'Them', rating: 1200 },
    game: newGame(),
  };
}

describe('createOnlineClient', () => {
  let socket: FakeSocket;
  let client: OnlineClient;
  let handlers: Required<OnlineHandlers>;

  beforeEach(() => {
    socket = new FakeSocket();
    handlers = {
      onStatus: vi.fn<Required<OnlineHandlers>['onStatus']>(),
      onMatchStart: vi.fn<Required<OnlineHandlers>['onMatchStart']>(),
      onPitch: vi.fn<Required<OnlineHandlers>['onPitch']>(),
      onResult: vi.fn<Required<OnlineHandlers>['onResult']>(),
      onMatchEnd: vi.fn<Required<OnlineHandlers>['onMatchEnd']>(),
    };
    client = createOnlineClient({
      url: 'ws://test',
      createSocket: () => socket,
      handlers,
    });
  });

  it('starts idle and sends join only once the socket opens', () => {
    expect(client.status()).toBe('idle');

    client.connect('Tracy', 1250);
    expect(client.status()).toBe('connecting');
    expect(socket.sent).toEqual([]);

    socket.open();
    expect(socket.sent).toEqual([{ type: 'join', name: 'Tracy', rating: 1250 }]);
  });

  it('reports queued while waiting for an opponent', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver({ type: 'waiting' });

    expect(client.status()).toBe('queued');
    expect(handlers.onStatus).toHaveBeenCalledWith('queued', undefined);
  });

  it('records which side this client is on at match start', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('home'));

    expect(client.status()).toBe('playing');
    expect(client.side()).toBe('home');
    expect(handlers.onMatchStart).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'home', opponent: { name: 'Them', rating: 1200 } }),
    );
  });

  it('only awaits a decision on pitches thrown to this client', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('home'));

    socket.deliver({ type: 'pitch', pitch: PITCH, battingSide: 'away' });
    expect(client.awaitingDecision()).toBe(false);
    expect(handlers.onPitch).toHaveBeenLastCalledWith(PITCH, 'away', false);

    socket.deliver({ type: 'pitch', pitch: PITCH, battingSide: 'home' });
    expect(client.awaitingDecision()).toBe(true);
    expect(handlers.onPitch).toHaveBeenLastCalledWith(PITCH, 'home', true);
  });

  it('ignores a swing or take when it is not this client turn to bat', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('home'));
    socket.deliver({ type: 'pitch', pitch: PITCH, battingSide: 'away' });
    socket.sent.length = 0;

    client.swing(0.02);
    client.take();
    expect(socket.sent).toEqual([]);
  });

  it('sends exactly one decision per pitch, ignoring the second', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('away'));
    socket.deliver({ type: 'pitch', pitch: PITCH, battingSide: 'away' });
    socket.sent.length = 0;

    client.swing(0.015);
    client.swing(0.015);
    client.take();

    expect(socket.sent).toEqual([{ type: 'swing', timingError: 0.015 }]);
    expect(client.awaitingDecision()).toBe(false);
  });

  it('clears the pending decision when the result comes back', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('away'));
    socket.deliver({ type: 'pitch', pitch: PITCH, battingSide: 'away' });

    const game = newGame();
    socket.deliver({
      type: 'result',
      outcome: { kind: 'called-strike' },
      game,
      nextBatter: 'away',
    });

    expect(client.awaitingDecision()).toBe(false);
    expect(handlers.onResult).toHaveBeenCalledWith({ kind: 'called-strike' }, game, 'away');
  });

  it('finishes on matchEnd and does not treat the following close as a drop', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('away'));
    socket.deliver({
      type: 'matchEnd',
      score: { away: 5, home: 3 },
      winner: 'away',
      ratings: { away: 1216, home: 1184 },
    });

    expect(client.status()).toBe('finished');
    expect(handlers.onMatchEnd).toHaveBeenCalledWith({
      score: { away: 5, home: 3 },
      winner: 'away',
      ratings: { away: 1216, home: 1184 },
    });

    socket.close();
    expect(client.status()).toBe('finished');
  });

  it('reports a mid-match disconnect as an error', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('away'));

    socket.close();
    expect(client.status()).toBe('error');
    expect(handlers.onStatus).toHaveBeenLastCalledWith('error', 'connection lost');
  });

  it('reports an unreachable server as an error', () => {
    client.connect('Tracy', 1250);
    socket.onerror?.call(socket, {});

    expect(client.status()).toBe('error');
    expect(handlers.onStatus).toHaveBeenLastCalledWith(
      'error',
      'could not reach the match server',
    );
  });

  it('surfaces a protocol error without ending the match', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('home'));
    socket.deliver({ type: 'error', message: 'not your turn to bat' });

    expect(client.status()).toBe('playing');
    expect(handlers.onStatus).toHaveBeenLastCalledWith('playing', 'not your turn to bat');
  });

  it('ignores a malformed frame', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('home'));

    expect(() => socket.deliverRaw('{not json')).not.toThrow();
    expect(client.status()).toBe('playing');
  });

  it('an intentional disconnect returns to idle, not error', () => {
    client.connect('Tracy', 1250);
    socket.open();
    socket.deliver(matchStart('home'));

    client.disconnect();

    expect(socket.closed).toBe(true);
    expect(client.status()).toBe('idle');
    expect(client.side()).toBeNull();
    expect(handlers.onStatus).toHaveBeenLastCalledWith('idle', undefined);
  });

  it('does not open a second socket while one is already live', () => {
    const created: FakeSocket[] = [];
    const multi = createOnlineClient({
      url: 'ws://test',
      createSocket: () => {
        const s = new FakeSocket();
        created.push(s);
        return s;
      },
    });

    multi.connect('Tracy', 1250);
    multi.connect('Tracy', 1250);

    expect(created).toHaveLength(1);
  });
});
