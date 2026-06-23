import { describe, expect, it } from 'vitest';
import {
  createRuntimeMatchSeed,
  normalizeMatchSeed,
  parseMatchSeedOverride,
} from '../src/match/MatchSeed';
import { DEFAULT_MATCH_RULES } from '../src/match/MatchTypes';

describe('match seed resolution', () => {
  it('honors explicit development seed overrides', () => {
    expect(parseMatchSeedOverride(new URLSearchParams('matchSeed=12345'))).toBe(12345);
    expect(parseMatchSeedOverride(new URLSearchParams('seed=67890'))).toBe(67890);
    expect(parseMatchSeedOverride(new URLSearchParams('matchSeed=0'))).toBe(0);
  });

  it('ignores missing or invalid seed overrides', () => {
    expect(parseMatchSeedOverride(new URLSearchParams())).toBeNull();
    expect(parseMatchSeedOverride(new URLSearchParams('matchSeed='))).toBeNull();
    expect(parseMatchSeedOverride(new URLSearchParams('matchSeed=not-a-number'))).toBeNull();
  });

  it('normalizes seed values into unsigned integer seeds', () => {
    expect(normalizeMatchSeed(-42.8)).toBe(42);
    expect(normalizeMatchSeed(Number.NaN)).toBe(DEFAULT_MATCH_RULES.seed);
  });

  it('creates a fresh deterministic seed for each runtime match sequence', () => {
    const seeds = Array.from({ length: 8 }, (_, index) => createRuntimeMatchSeed({
      entropy: 99125,
      nowMs: 202606221234,
      sequenceIndex: index,
    }));

    expect(new Set(seeds).size).toBe(seeds.length);
    expect(seeds).not.toContain(DEFAULT_MATCH_RULES.seed);
  });
});
