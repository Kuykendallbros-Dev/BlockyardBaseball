import { describe, expect, it } from 'vitest';
import { BASELINE_ATTRIBUTES } from './attributes.ts';
import { GEAR_CATALOG, applyGear, findGear } from './gear.ts';

describe('GEAR_CATALOG', () => {
  it('has one item per essential-path attribute', () => {
    const attributes = GEAR_CATALOG.map((item) => item.attribute).sort();
    expect(attributes).toEqual(['contact', 'power', 'speed']);
  });

  it('findGear looks up by id and returns undefined for an unknown one', () => {
    expect(findGear('heavy-bat')?.name).toBe('Heavy Bat');
    expect(findGear('nonexistent')).toBeUndefined();
  });
});

describe('applyGear', () => {
  it('returns the attributes unchanged when nothing is equipped', () => {
    expect(applyGear(BASELINE_ATTRIBUTES, null)).toEqual(BASELINE_ATTRIBUTES);
    expect(applyGear(BASELINE_ATTRIBUTES, undefined)).toEqual(BASELINE_ATTRIBUTES);
  });

  it('adds the bonus to only the item\'s attribute', () => {
    const item = findGear('heavy-bat');
    if (!item) throw new Error('heavy-bat missing from catalog');
    const result = applyGear(BASELINE_ATTRIBUTES, item);
    expect(result.power).toBeCloseTo(BASELINE_ATTRIBUTES.power + item.bonus);
    expect(result.contact).toBe(BASELINE_ATTRIBUTES.contact);
    expect(result.speed).toBe(BASELINE_ATTRIBUTES.speed);
  });

  it('clamps the bonus at 1', () => {
    const item = findGear('turf-cleats');
    if (!item) throw new Error('turf-cleats missing from catalog');
    const result = applyGear({ power: 0.5, contact: 0.5, speed: 0.95 }, item);
    expect(result.speed).toBe(1);
  });
});
