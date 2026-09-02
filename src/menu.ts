/**
 * The Quick Play menu shell — a title card with two team-name fields and a play
 * button, layered over the 3D scene. Pure DOM; the scene owns when it shows and
 * what happens on play.
 */

import type { TeamNames } from './game/scoreboard.ts';

export interface Menu {
  readonly element: HTMLElement;
  show: () => void;
  hide: () => void;
  /** Current team names, trimmed, with fallbacks. */
  names: () => TeamNames;
  /** Register the handler fired by the play button. */
  onPlay: (handler: () => void) => void;
}

export function createMenu(container: HTMLElement): Menu {
  const root = document.createElement('div');
  root.className = 'menu';
  root.innerHTML = `
    <h1 class="menu-title">Blockyard Baseball</h1>
    <p class="menu-sub">Quick Play</p>
    <div class="menu-teams">
      <label>Away <input class="menu-away" maxlength="10" value="Away" spellcheck="false" /></label>
      <label>Home <input class="menu-home" maxlength="10" value="Home" spellcheck="false" /></label>
    </div>
    <button class="menu-play" type="button">Play ball</button>
    <p class="menu-hint">space to swing &nbsp;·&nbsp; esc to pause</p>
  `;
  container.appendChild(root);

  const away = root.querySelector<HTMLInputElement>('.menu-away');
  const home = root.querySelector<HTMLInputElement>('.menu-home');
  const play = root.querySelector<HTMLButtonElement>('.menu-play');
  if (!away || !home || !play) throw new Error('menu: markup missing');

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
    onPlay: (h) => {
      handler = h;
    },
  };
}
