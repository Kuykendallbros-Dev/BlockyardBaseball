// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createMenu } from './menu.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createMenu', () => {
  it('mounts a hidden-toggleable menu into the container', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const menu = createMenu(host);

    expect(host.querySelector('.menu')).toBe(menu.element);
    menu.hide();
    expect(menu.element.hidden).toBe(true);
    menu.show();
    expect(menu.element.hidden).toBe(false);
  });

  it('reads trimmed team names with fallbacks', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const menu = createMenu(host);

    const away = host.querySelector<HTMLInputElement>('.menu-away');
    const home = host.querySelector<HTMLInputElement>('.menu-home');
    if (!away || !home) throw new Error('inputs missing');

    away.value = '  Sluggers  ';
    home.value = '   ';
    expect(menu.names()).toEqual({ away: 'Sluggers', home: 'Home' });
  });

  it('fires the play handler when the button is clicked', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const menu = createMenu(host);

    let played = 0;
    menu.onPlay(() => {
      played += 1;
    });
    host.querySelector<HTMLButtonElement>('.menu-play')?.click();
    expect(played).toBe(1);
  });
});
