import { describe, expect, it, vi } from 'vitest';
import {
  decodeLeagueData,
  encodeLeagueData,
  estimateEncodedLeagueBytes,
} from '../src/league/LeagueDataCodec';
import { initializeLeagueData, type LeagueDataStore } from '../src/league/LeagueDataRepository';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { LeagueBootController } from '../src/league/LeagueBootController';
import {
  LEAGUE_GENERATOR_VERSION,
  LEAGUE_RECORD_KEY,
  LEAGUE_SCHEMA_VERSION,
  type EncodedLeagueData,
  type StoredLeagueRecord,
} from '../src/league/LeagueTypes';
import {
  validateEncodedLeagueData,
  validateLeagueData,
} from '../src/league/LeagueValidation';

describe('league data foundation', () => {
  it('generates deterministic six-team league data for the same seed', () => {
    const first = encodeLeagueData(generateLeagueData({ seed: 'test-seed' }));
    const second = encodeLeagueData(generateLeagueData({ seed: 'test-seed' }));

    expect(first).toEqual(second);
    expect(first.teams).toHaveLength(6);
    expect(first.rosters).toHaveLength(6);
    expect(first.rosters.every((roster) => roster.players.length >= 24)).toBe(true);
    expect(validateEncodedLeagueData(first)).toEqual([]);
    expect(validateLeagueData(decodeLeagueData(first))).toEqual([]);
    expect(estimateEncodedLeagueBytes(first)).toBeLessThan(300 * 1024);
  });

  it('preserves ratings and roster identity through compact encode/decode', () => {
    const encoded = encodeLeagueData(generateLeagueData());
    const decoded = decodeLeagueData(encoded);
    const metro = decoded.rosters.find((roster) => roster.teamId === 'metro-meteors')!;
    const quarterback = metro.players.find((player) => player.footballPosition === 'QB')!;

    expect(quarterback.id).toBe('metro-meteors-qb-12');
    expect(quarterback.ratings.THA).toBeGreaterThan(0);
    expect(quarterback.ratings.THP).toBeGreaterThan(0);
    expect(new Set(metro.players.map((player) => player.id)).size).toBe(metro.players.length);
    expect(new Set(metro.players.map((player) => player.jerseyNumber)).size).toBe(metro.players.length);
  });

  it('first initialization stores one league and second initialization loads the same league', async () => {
    const bundled = encodeLeagueData(generateLeagueData());
    const store = createFakeStore();
    const first = await initializeLeagueData({
      fetchJson: async () => bundled,
      now: () => new Date('2026-01-02T03:04:05.000Z'),
      store,
    });
    const second = await initializeLeagueData({
      fetchJson: async () => bundled,
      store,
    });

    expect(first.source).toBe('bundled');
    expect(store.putCount).toBe(1);
    expect(second.source).toBe('indexedDB');
    expect(second.data.contentHash).toBe(first.data.contentHash);
  });

  it('schema changes regenerate the cache from the bundled payload', async () => {
    const bundled = encodeLeagueData(generateLeagueData());
    const store = createFakeStore({
      contentHash: bundled.contentHash,
      generatedAt: 'stale',
      generatorVersion: bundled.generatorVersion,
      key: LEAGUE_RECORD_KEY,
      payload: bundled,
      schemaVersion: LEAGUE_SCHEMA_VERSION - 1,
    });
    const result = await initializeLeagueData({
      fetchJson: async () => bundled,
      store,
    });

    expect(result.source).toBe('bundled');
    expect(store.putCount).toBe(1);
    expect((await store.get())?.schemaVersion).toBe(LEAGUE_SCHEMA_VERSION);
  });

  it('corrupted cache falls back safely to bundled data', async () => {
    const bundled = encodeLeagueData(generateLeagueData());
    const corrupted: EncodedLeagueData = {
      ...bundled,
      rosters: [],
    };
    const store = createFakeStore({
      contentHash: bundled.contentHash,
      generatedAt: 'bad',
      generatorVersion: bundled.generatorVersion,
      key: LEAGUE_RECORD_KEY,
      payload: corrupted,
      schemaVersion: bundled.schemaVersion,
    });
    const result = await initializeLeagueData({
      fetchJson: async () => bundled,
      store,
    });

    expect(result.source).toBe('bundled');
    expect(result.warning).toContain('League cache ignored');
    expect(result.data.rosters).toHaveLength(6);
  });

  it('IndexedDB unavailable falls back to in-memory bundled data', async () => {
    const bundled = encodeLeagueData(generateLeagueData());
    const result = await initializeLeagueData({
      fetchJson: async () => bundled,
      store: null,
    });

    expect(result.source).toBe('memoryFallback');
    expect(result.data.teams).toHaveLength(6);
  });

  it('loading threshold does not flash for fast initialization', async () => {
    const bundled = encodeLeagueData(generateLeagueData());
    const controller = new LeagueBootController({
      loadingThresholdMs: 150,
      repositoryOptions: {
        fetchJson: async () => bundled,
      },
      store: null,
    });

    await controller.start();

    expect(controller.getSnapshot()).toMatchObject({
      loadingVisible: false,
      status: 'ready',
      teamCount: 6,
    });
  });

  it('loading threshold displays while slow initialization is still pending', async () => {
    vi.useFakeTimers();
    const bundled = encodeLeagueData(generateLeagueData());
    let resolveFetch!: (data: EncodedLeagueData) => void;
    const controller = new LeagueBootController({
      loadingThresholdMs: 150,
      repositoryOptions: {
        fetchJson: async () => await new Promise<EncodedLeagueData>((resolve) => {
          resolveFetch = resolve;
        }),
      },
      store: null,
    });
    const started = controller.start();
    await vi.advanceTimersByTimeAsync(151);

    expect(controller.getSnapshot().loadingVisible).toBe(true);
    resolveFetch(bundled);
    await started;

    expect(controller.getSnapshot().loadingVisible).toBe(false);
    vi.useRealTimers();
  });

  it('records version metadata and validates all six teams', () => {
    const encoded = encodeLeagueData(generateLeagueData());
    const decoded = decodeLeagueData(encoded);
    const allPlayers = decoded.rosters.flatMap((roster) => roster.players);

    expect(encoded).toMatchObject({
      generatorVersion: LEAGUE_GENERATOR_VERSION,
      schemaVersion: LEAGUE_SCHEMA_VERSION,
    });
    expect(decoded.teams.map((team) => team.id).sort()).toEqual(
      decoded.rosters.map((roster) => roster.teamId).sort(),
    );
    expect(new Set(allPlayers.map((player) => player.id)).size).toBe(allPlayers.length);
  });
});

function createFakeStore(initial: StoredLeagueRecord | null = null): LeagueDataStore & {
  putCount: number;
} {
  let record = initial;
  let putCount = 0;
  return {
    get putCount() {
      return putCount;
    },
    get: async () => record,
    put: async (nextRecord) => {
      putCount += 1;
      record = nextRecord;
    },
    reset: async () => {
      record = null;
    },
  };
}
