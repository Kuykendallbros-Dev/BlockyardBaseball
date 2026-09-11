/**
 * The Quick Play menu shell — a title card with two team-name fields and a play
 * button, layered over the 3D scene. Pure DOM; the scene owns when it shows and
 * what happens on play.
 */

import { MAX_LEVEL, MIN_LEVEL } from './game/attributes.ts';
import { GEAR_CATALOG } from './game/gear.ts';
import type { TeamNames } from './game/scoreboard.ts';

/** Midpoint of the level range — an average, baseline-attribute player. */
const DEFAULT_LEVEL = Math.round((MIN_LEVEL + MAX_LEVEL) / 2);
const NO_GEAR = '';

export interface Menu {
  readonly element: HTMLElement;
  show: () => void;
  hide: () => void;
  /** Current team names, trimmed, with fallbacks. */
  names: () => TeamNames;
  /** Chosen level for the human batter, clamped to [MIN_LEVEL, MAX_LEVEL]. */
  level: () => number;
  /** Chosen gear item id, or `''` for none equipped. */
  gearChoice: () => string;
  /** Update the displayed coin balance. */
  setWallet: (balance: number) => void;
  /** Register the handler fired by the play button. */
  onPlay: (handler: () => void) => void;
}

export function createMenu(container: HTMLElement): Menu {
  const root = document.createElement('div');
  root.className = 'menu';
  const gearOptions = GEAR_CATALOG.map(
    (item) => `<option value="${item.id}">${item.name} — ${item.price}c</option>`,
  ).join('');
  root.innerHTML = `
    <h1 class="menu-title">Blockyard Baseball</h1>
    <p class="menu-sub">Quick Play</p>
    <div class="menu-teams">
      <label>Away <input class="menu-away" maxlength="10" value="Away" spellcheck="false" /></label>
      <label>Home <input class="menu-home" maxlength="10" value="Home" spellcheck="false" /></label>
      <label>Your level
        <input class="menu-level" type="number" min="${MIN_LEVEL}" max="${MAX_LEVEL}" value="${DEFAULT_LEVEL}" />
      </label>
    </div>
    <div class="menu-loadout">
      <p class="menu-wallet">Coins: 0</p>
      <label>Gear
        <select class="menu-gear">
          <option value="${NO_GEAR}">None</option>
          ${gearOptions}
        </select>
      </label>
    </div>
    <button class="menu-play" type="button">Play ball</button>
    <p class="menu-hint">space to swing &nbsp;·&nbsp; esc to pause</p>
  `;
  container.appendChild(root);

  const away = root.querySelector<HTMLInputElement>('.menu-away');
  const home = root.querySelector<HTMLInputElement>('.menu-home');
  const level = root.querySelector<HTMLInputElement>('.menu-level');
  const gear = root.querySelector<HTMLSelectElement>('.menu-gear');
  const wallet = root.querySelector<HTMLElement>('.menu-wallet');
  const play = root.querySelector<HTMLButtonElement>('.menu-play');
  if (!away || !home || !level || !gear || !wallet || !play) {
    throw new Error('menu: markup missing');
  }

  let handler: () => void = () => {};
  play.addEventListener('click', () => {
    handler();
  });

  return {
    element: root,
    show: () => {
      root.hidden = false;
    },
    hide: () => {
      root.hidden = true;
    },
    names: () => ({
      away: away.value.trim() || 'Away',
      home: home.value.trim() || 'Home',
    }),
    level: () => {
      const n = Number.parseInt(level.value, 10);
      if (Number.isNaN(n)) return DEFAULT_LEVEL;
      return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n));
    },
    gearChoice: () => gear.value,
    setWallet: (balance) => {
      wallet.textContent = `Coins: ${balance}`;
    },
    onPlay: (h) => {
      handler = h;
    },
  };
}
