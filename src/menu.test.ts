// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_LEVEL, MIN_LEVEL } from './game/attributes.ts';
import { GEAR_CATALOG } from './game/gear.ts';
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

  it('defaults to the midpoint level and clamps out-of-range input', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const menu = createMenu(host);
    const level = host.querySelector<HTMLInputElement>('.menu-level');
    if (!level) throw new Error('level input missing');

    expect(menu.level()).toBe(Math.round((MIN_LEVEL + MAX_LEVEL) / 2));

    level.value = String(MAX_LEVEL + 10);
    expect(menu.level()).toBe(MAX_LEVEL);

    level.value = String(MIN_LEVEL - 10);
    expect(menu.level()).toBe(MIN_LEVEL);

    level.value = 'not a number';
    expect(menu.level()).toBe(Math.round((MIN_LEVEL + MAX_LEVEL) / 2));
  });

  it('defaults to no gear, lists the catalog, and reads the chosen id', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const menu = createMenu(host);
    const gear = host.querySelector<HTMLSelectElement>('.menu-gear');
    if (!gear) throw new Error('gear select missing');

    expect(menu.gearChoice()).toBe('');
    expect(gear.options.length).toBe(GEAR_CATALOG.length + 1); // + "None"

    gear.value = GEAR_CATALOG[0].id;
    expect(menu.gearChoice()).toBe(GEAR_CATALOG[0].id);
  });

  it('displays the coin balance passed to setWallet', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const menu = createMenu(host);
    menu.setWallet(275);
    expect(host.querySelector('.menu-wallet')?.textContent).toContain('275');
  });

  it('displays the battle-pass progress passed to setPass', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const menu = createMenu(host);

    menu.setPass({ level: 3, intoLevel: 40, needed: 100, maxed: false });
    expect(host.querySelector('.menu-pass')?.textContent).toBe('Pass Lv 3 · 40/100');

    menu.setPass({ level: 10, intoLevel: 100, needed: 100, maxed: true });
    expect(host.querySelector('.menu-pass')?.textContent).toBe('Pass Lv 10 · MAX');
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
