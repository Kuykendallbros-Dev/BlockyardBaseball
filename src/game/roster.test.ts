import { describe, expect, it } from 'vitest';
import {
  BENCH_SIZE,
  BULLPEN_SIZE,
  LINEUP_SIZE,
  ROSTER_SIZE,
  ROTATION_SIZE,
  makeBaselineTeam,
  makeTeam,
} from './roster.ts';

/** Mulberry32 — deterministic, reproducible per seed. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('makeTeam', () => {
  it('builds a full roster of the advertised size', () => {
    const team = makeTeam('Blockyard', rng(1));
    expect(team.lineup).toHaveLength(LINEUP_SIZE);
    expect(team.bench).toHaveLength(BENCH_SIZE);
    expect(team.rotation).toHaveLength(ROTATION_SIZE);
    expect(team.bullpen).toHaveLength(BULLPEN_SIZE);
    const total =
      team.lineup.length + team.bench.length + team.rotation.length + team.bullpen.length;
    expect(total).toBe(ROSTER_SIZE);
  });

  it('fields nine distinct positions with a designated hitter', () => {
    const positions = makeTeam('Blockyard', rng(2)).lineup.map((p) => p.position);
    expect(new Set(positions).size).toBe(LINEUP_SIZE);
    expect(positions).toContain('DH');
    // The pitcher does not bat — that is the whole point of the DH.
    expect(positions).not.toContain('P');
  });

  it('is deterministic for a given seed', () => {
    const a = makeTeam('Blockyard', rng(7));
    const b = makeTeam('Blockyard', rng(7));
    expect(a).toEqual(b);
  });

  it('gives every pitcher ratings and every batter none', () => {
    const team = makeTeam('Blockyard', rng(3));
    for (const p of [...team.rotation, ...team.bullpen]) {
      expect(p.pitching).not.toBeNull();
      expect(p.position).toBe('P');
    }
    for (const p of team.lineup) expect(p.pitching).toBeNull();
  });

  it('gives starters more stamina than relievers', () => {
    const team = makeTeam('Blockyard', rng(4));
    const starter = team.rotation[0].pitching;
    const reliever = team.bullpen[0].pitching;
    expect(starter?.stamina ?? 0).toBeGreaterThan(reliever?.stamina ?? 0);
  });

  it('bats its best hitters in the middle of the order', () => {
    // Averaged over many clubs so one unlucky draw does not decide it.
    let middle = 0;
    let bottom = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const lineup = makeTeam('Blockyard', rng(seed)).lineup;
      middle += lineup[3].attributes.power;
      bottom += lineup[8].attributes.power;
    }
    expect(middle).toBeGreaterThan(bottom);
  });
});

describe('makeBaselineTeam', () => {
  it('needs no randomness and still fills every slot', () => {
    const team = makeBaselineTeam('Baseline');
    expect(team.lineup).toHaveLength(LINEUP_SIZE);
    expect(team.bullpen).toHaveLength(BULLPEN_SIZE);
    expect(team.rotation[0].pitching?.stamina).toBeGreaterThan(0);
  });
});
