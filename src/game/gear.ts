/**
 * Gear catalog — Phase 3's essential path. A handful of items, each a flat
 * bonus on one attribute plus a coin price. `applyGear` layers the bonus on
 * top of whatever `attributesForLevel` already produced. No cosmetics, no
 * saved loadout yet — see the Phase 3 enhancement backlog.
 */

import type { Attributes } from './attributes.ts';

export type GearSlot = 'bat' | 'grip' | 'cleats';

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  attribute: keyof Attributes;
  /** Added straight to the attribute stat (0..1 scale), then clamped. */
  bonus: number;
  price: number;
}

export const GEAR_CATALOG: readonly GearItem[] = [
  { id: 'heavy-bat', name: 'Heavy Bat', slot: 'bat', attribute: 'power', bonus: 0.15, price: 150 },
  { id: 'grip-tape', name: 'Grip Tape', slot: 'grip', attribute: 'contact', bonus: 0.15, price: 150 },
  { id: 'turf-cleats', name: 'Turf Cleats', slot: 'cleats', attribute: 'speed', bonus: 0.15, price: 150 },
];

export function findGear(id: string): GearItem | undefined {
  return GEAR_CATALOG.find((item) => item.id === id);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Layer one equipped item's bonus onto a base set of attributes. `null` = nothing equipped. */
export function applyGear(attributes: Attributes, item: GearItem | null | undefined): Attributes {
  if (!item) return attributes;
  return { ...attributes, [item.attribute]: clamp01(attributes[item.attribute] + item.bonus) };
}
