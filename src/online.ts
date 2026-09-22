/**
 * Client half of the online match protocol (P5-2b). Owns the connection
 * lifecycle and the message state machine; knows nothing about Three.js or
 * the DOM, so `online.test.ts` drives it with a fake socket.
 *
 * The wire types below mirror `BlockYardAPI/src/protocol.ts`, which is the
 * source of truth — the match server lives in its own repo per the infra
 * SOP's one-repo-per-service rule, so the two can't share a module. Keep them
 * in step by hand; a mismatch shows up as an ignored message, not a crash.
 */

import type { PitchOutcome } from './game/atbat.ts';
import type { GameState } from './game/game.ts';
import type { Pitch } from './game/pitching.ts';
import type { BattingSide } from './game/scoreboard.ts';
import { matchServerUrl } from './endpoint.ts';

/** Which dugout this client is batting from. */
export type Side = BattingSide;

export interface PlayerSummary {
  name: string;
  rating: number;
}

export type ClientMessage =
  | { type: 'join'; name: string; rating: number }
  | { type: 'swing'; timingError: number }
  | { type: 'take' };

export type ServerMessage =
  | { type: 'waiting' }
  | {
      type: 'matchStart';
      side: Side;
      you: PlayerSummary;
      opponent: PlayerSummary;
      game: GameState;
    }
  | { type: 'pitch'; pitch: Pitch; battingSide: Side }
  | { type: 'result'; outcome: PitchOutcome; game: GameState; nextBatter: Side }
  | {
      type: 'matchEnd';
      score: { away: number; home: number };
      winner: Side;
      ratings: { away: number; home: number };
    }
  | { type: 'error'; message: string };

/**
 * Where the match server lives. See `./endpoint.ts` — on an HTTPS page this
 * resolves to a same-origin `wss://` path that the site's nginx proxies to the
 * match server, which is what makes online play work without a second domain
 * or certificate. On plain HTTP it connects to the droplet directly.
 */
export function defaultServerUrl(): string {
  return matchServerUrl();
}

/**
 * The minimum of the `WebSocket` surface this client uses. Narrowing it to an
 * interface is what lets the tests substitute a fake and drive the protocol
 * deterministically, with no server and no real socket.
 */
export interface SocketLike {
  send: (data: string) => void;
  close: () => void;
  onopen: ((this: unknown, ev: unknown) => unknown) | null;
  onclose: ((this: unknown, ev: unknown) => unknown) | null;
  onerror: ((this: unknown, ev: unknown) => unknown) | null;
  onmessage: ((this: unknown, ev: { data: unknown }) => unknown) | null;
}

/**
 * Connection/match status, in the order a happy path moves through it:
 * `idle` -> `connecting` -> `queued` (paired opponent pending) -> `playing`
 * -> `finished`. `error` is terminal for the attempt and carries a reason.
 */
export type OnlineStatus = 'idle' | 'connecting' | 'queued' | 'playing' | 'finished' | 'error';

export interface MatchEndSummary {
  score: { away: number; home: number };
  winner: Side;
  ratings: { away: number; home: number };
}

/** Callbacks the scene supplies to drive rendering off server messages. */
export interface OnlineHandlers {
  onStatus?: (status: OnlineStatus, detail?: string) => void;
  onMatchStart?: (info: {
    side: Side;
    you: PlayerSummary;
    opponent: PlayerSummary;
    game: GameState;
  }) => void;
  onPitch?: (pitch: Pitch, battingSide: Side, youAreBatting: boolean) => void;
  onResult?: (outcome: PitchOutcome, game: GameState, nextBatter: Side) => void;
  onMatchEnd?: (summary: MatchEndSummary) => void;
}

export interface OnlineClient {
  /** Open the socket and queue for a match. */
  connect: (name: string, rating: number) => void;
  /** Report a swing on the pending pitch. No-op unless this client is batting. */
  swing: (timingError: number) => void;
  /** Take the pending pitch. No-op unless this client is batting. */
  take: () => void;
  /** Close the socket and reset to `idle`. Safe to call when already closed. */
  disconnect: () => void;
  status: () => OnlineStatus;
  /** This client's side, once a match has started. */
  side: () => Side | null;
  /** True while a pitch is in flight and this client is the one batting. */
  awaitingDecision: () => boolean;
}

export interface OnlineClientOptions {
  url?: string;
  /** Defaults to a real `WebSocket`; tests pass a fake. */
  createSocket?: (url: string) => SocketLike;
  handlers?: OnlineHandlers;
}

function defaultSocket(url: string): SocketLike {
  return new WebSocket(url) as unknown as SocketLike;
}

export function createOnlineClient(options: OnlineClientOptions = {}): OnlineClient {
  const url = options.url ?? defaultServerUrl();
  const createSocket = options.createSocket ?? defaultSocket;
  const handlers = options.handlers ?? {};

  let socket: SocketLike | null = null;
  let status: OnlineStatus = 'idle';
  let mySide: Side | null = null;
  let pendingDecision = false;
  let credentials: { name: string; rating: number } | null = null;

  function setStatus(next: OnlineStatus, detail?: string): void {
    status = next;
    handlers.onStatus?.(next, detail);
  }

  function send(message: ClientMessage): void {
    socket?.send(JSON.stringify(message));
  }

  function handle(message: ServerMessage): void {
    switch (message.type) {
      case 'waiting':
        setStatus('queued');
        return;

      case 'matchStart':
        mySide = message.side;
        pendingDecision = false;
        setStatus('playing');
        handlers.onMatchStart?.({
          side: message.side,
          you: message.you,
          opponent: message.opponent,
          game: message.game,
        });
        return;

      case 'pitch': {
        // Both clients are told about every pitch; only the batting one may
        // answer it. The other side renders it as the opponent's at-bat.
        const youAreBatting = message.battingSide === mySide;
        pendingDecision = youAreBatting;
        handlers.onPitch?.(message.pitch, message.battingSide, youAreBatting);
        return;
      }

      case 'result':
        pendingDecision = false;
        handlers.onResult?.(message.outcome, message.game, message.nextBatter);
        return;

      case 'matchEnd':
        pendingDecision = false;
        setStatus('finished');
        handlers.onMatchEnd?.({
          score: message.score,
          winner: message.winner,
          ratings: message.ratings,
        });
        return;

      case 'error':
        // A protocol-level complaint ("not your turn to bat") is informational
        // and does not tear the match down — the server keeps the match alive,
        // so the client does too.
        handlers.onStatus?.(status, message.message);
        return;
    }
  }

  function connect(name: string, rating: number): void {
    if (socket) return; // already connected or connecting
    credentials = { name, rating };
    setStatus('connecting');

    const ws = createSocket(url);
    socket = ws;

    ws.onopen = () => {
      if (credentials) send({ type: 'join', ...credentials });
    };

    ws.onmessage = (ev) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return; // a malformed frame is ignored, not fatal
      }
      handle(message);
    };

    ws.onerror = () => {
      setStatus('error', 'could not reach the match server');
    };

    ws.onclose = () => {
      socket = null;
      pendingDecision = false;
      // A close after the match ended is the normal teardown; a close at any
      // other point means the connection dropped. Reconnect is a deferred
      // backlog item, so this only reports — it does not retry.
      if (status !== 'finished' && status !== 'error') {
        setStatus('error', 'connection lost');
      }
    };
  }

  function swing(timingError: number): void {
    if (!pendingDecision) return;
    pendingDecision = false;
    send({ type: 'swing', timingError });
  }

  function take(): void {
    if (!pendingDecision) return;
    pendingDecision = false;
    send({ type: 'take' });
  }

  function disconnect(): void {
    const ws = socket;
    socket = null;
    pendingDecision = false;
    mySide = null;
    credentials = null;
    if (ws) {
      ws.onclose = null; // an intentional close is not a dropped connection
      ws.close();
    }
    setStatus('idle');
  }

  return {
    connect,
    swing,
    take,
    disconnect,
    status: () => status,
    side: () => mySide,
    awaitingDecision: () => pendingDecision,
  };
}
