import { describe, expect, it } from 'vitest';
import {
  createAndPersistDynastySave,
  createMemoryDynastySaveStore,
  loadDynastySave,
  persistDynastySave,
  resetDynastySave,
} from '../src/dynasty/DynastySaveRepository';
import {
  DYNASTY_ACTIVE_SAVE_KEY,
  DYNASTY_SAVE_SCHEMA_VERSION,
  DYNASTY_SEASON_CORE_VERSION,
  type StoredDynastySaveRecord,
} from '../src/dynasty/DynastyTypes';
import { validateDynastySaveData } from '../src/dynasty/DynastyValidation';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';

describe('dynasty save repository', () => {
  it('creates, persists, and reloads the active dynasty save', async () => {
    const league = generateLeagueData({ seed: 'dynasty-save-league' });
    const store = createMemoryDynastySaveStore();
    const created = await createAndPersistDynastySave({
      createdAt: '2026-06-24T10:00:00.000Z',
      now: () => new Date('2026-06-24T10:05:00.000Z'),
      seed: 'dynasty-save',
      store,
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const loaded = await loadDynastySave({ store });

    expect(created.source).toBe('created');
    expect(created.warning).toBeNull();
    expect(created.save.updatedAt).toBe('2026-06-24T10:05:00.000Z');
    expect(loaded.source).toBe('indexedDB');
    expect(loaded.warning).toBeNull();
    expect(loaded.save).toEqual(created.save);
    expect(validateDynastySaveData(created.save)).toEqual([]);
  });

  it('hydrates missing season stats from older active saves', async () => {
    const league = generateLeagueData({ seed: 'dynasty-save-league' });
    const created = await createAndPersistDynastySave({
      createdAt: '2026-06-24T10:00:00.000Z',
      seed: 'dynasty-save-legacy-stats',
      store: null,
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const [week] = created.save.currentSeason.weeks;
    const [game] = week!.games;
    const legacySave = {
      ...created.save,
      currentSeason: {
        ...created.save.currentSeason,
        teamStats: undefined,
        weeks: [
          {
            ...week!,
            games: [
              {
                ...game!,
                result: {
                  awayScore: 21,
                  homeScore: 17,
                  winnerTeamId: game!.awayTeamId,
                },
                status: 'final',
              },
              ...week!.games.slice(1),
            ],
          },
          ...created.save.currentSeason.weeks.slice(1),
        ],
      },
    } as unknown as typeof created.save;
    const store = createMemoryDynastySaveStore({
      key: DYNASTY_ACTIVE_SAVE_KEY,
      modeVersion: DYNASTY_SEASON_CORE_VERSION,
      payload: legacySave,
      savedAt: legacySave.updatedAt,
      schemaVersion: DYNASTY_SAVE_SCHEMA_VERSION,
    });
    const loaded = await loadDynastySave({ store });

    expect(loaded.warning).toBeNull();
    expect(loaded.save?.currentSeason.teamStats).toHaveLength(6);
    expect(loaded.save?.currentSeason.teamStats.find((stats) =>
      stats.teamId === game!.awayTeamId)).toMatchObject({
      gamesPlayed: 1,
      pointsAgainst: 17,
      pointsFor: 21,
    });
    expect(loaded.save?.currentSeason.weeks[0]?.games[0]?.result?.awayStats.offensiveYards)
      .toBeGreaterThan(0);
  });

  it('persists an updated save timestamp and clears it on reset', async () => {
    const league = generateLeagueData({ seed: 'dynasty-save-league' });
    const store = createMemoryDynastySaveStore();
    const created = await createAndPersistDynastySave({
      createdAt: '2026-06-24T10:00:00.000Z',
      now: () => new Date('2026-06-24T10:00:00.000Z'),
      seed: 'dynasty-save-reset',
      store,
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const persisted = await persistDynastySave(
      {
        ...created.save,
        currentWeekIndex: 1,
      },
      {
        now: () => new Date('2026-06-24T11:00:00.000Z'),
        store,
      },
    );

    expect(persisted.save.currentWeekIndex).toBe(1);
    expect(persisted.save.updatedAt).toBe('2026-06-24T11:00:00.000Z');
    expect((await loadDynastySave({ store })).save?.currentWeekIndex).toBe(1);

    await resetDynastySave({ store });
    const loadedAfterReset = await loadDynastySave({ store });
    expect(loadedAfterReset).toMatchObject({
      save: null,
      source: 'none',
      warning: null,
    });
  });

  it('ignores stale or corrupt dynasty save records', async () => {
    const league = generateLeagueData({ seed: 'dynasty-save-league' });
    const created = await createAndPersistDynastySave({
      createdAt: '2026-06-24T10:00:00.000Z',
      seed: 'dynasty-save-corrupt',
      store: null,
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const staleRecord: StoredDynastySaveRecord = {
      key: DYNASTY_ACTIVE_SAVE_KEY,
      modeVersion: DYNASTY_SEASON_CORE_VERSION,
      payload: {
        ...created.save,
        schemaVersion: 0 as typeof DYNASTY_SAVE_SCHEMA_VERSION,
      },
      savedAt: '2026-06-24T10:00:00.000Z',
      schemaVersion: 0 as typeof DYNASTY_SAVE_SCHEMA_VERSION,
    };
    const store = createMemoryDynastySaveStore(staleRecord);
    const loaded = await loadDynastySave({ store });

    expect(loaded.save).toBeNull();
    expect(loaded.source).toBe('none');
    expect(loaded.warning).toContain('Unsupported dynasty save version');
  });

  it('keeps a valid in-memory save when IndexedDB is unavailable', async () => {
    const league = generateLeagueData({ seed: 'dynasty-save-league' });
    const created = await createAndPersistDynastySave({
      createdAt: '2026-06-24T10:00:00.000Z',
      now: () => new Date('2026-06-24T10:00:00.000Z'),
      seed: 'dynasty-memory',
      store: null,
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });
    const loaded = await loadDynastySave({ store: null });

    expect(created.save.userTeamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(created.source).toBe('memoryFallback');
    expect(created.warning).toContain('unavailable');
    expect(loaded).toMatchObject({
      save: null,
      source: 'memoryFallback',
    });
  });

  it('keeps a valid in-memory save when storage writes fail', async () => {
    const league = generateLeagueData({ seed: 'dynasty-save-league' });
    const created = await createAndPersistDynastySave({
      createdAt: '2026-06-24T10:00:00.000Z',
      now: () => new Date('2026-06-24T10:00:00.000Z'),
      seed: 'dynasty-storage-failure',
      store: {
        get: async () => null,
        put: async () => {
          throw new Error('quota exceeded');
        },
        reset: async () => undefined,
      },
      teams: league.teams,
      userTeamId: DEFAULT_USER_TEAM_ID,
    });

    expect(created.save.userTeamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(created.source).toBe('memoryFallback');
    expect(created.warning).toContain('quota exceeded');
    expect(validateDynastySaveData(created.save)).toEqual([]);
  });
});
