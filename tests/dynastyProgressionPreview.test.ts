import { describe, expect, it } from 'vitest';
import {
  approveCurrentDynastyWeekProgression,
  createDynastyProgressionPreview,
} from '../src/dynasty/DynastyProgressionPreview';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import {
  simulateCurrentDynastyUserGame,
  simulateCurrentDynastyWeekNonUserGames,
} from '../src/dynasty/DynastyWeekAdvance';
import { validateDynastySaveData } from '../src/dynasty/DynastyValidation';
import { calculateOverallRating } from '../src/ratings/OverallRatingCalculator';
import { getTeamRosterOrDefault } from '../src/roster/RosterRegistry';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';

describe('dynasty progression preview', () => {
  it('creates deterministic bounded presentation-only performance points', () => {
    const save = simulateCurrentDynastyUserGame(simulateCurrentDynastyWeekNonUserGames(
      createSave('dynasty-progression-preview'),
    ).save).save;
    const first = createDynastyProgressionPreview({ save });
    const second = createDynastyProgressionPreview({ save });

    expect(first).toEqual(second);
    expect(first.rows).toHaveLength(32);
    expect(first.summaryLabel).toContain('presentation-only points');
    expect(first.rows.every((row) =>
      row.performancePoints >= 0 &&
      row.performancePoints <= 100)).toBe(true);
    expect(first.rows.every((row) =>
      row.projectedOverall >= row.currentOverall &&
      row.projectedOverallDelta >= 0 &&
      row.projectedOverallDelta <= 3 &&
      row.ratingDeltas.length <= 3 &&
      row.ratingDeltas.every((delta) =>
        delta.delta === 1 &&
        delta.projectedValue === delta.currentValue + 1 &&
        delta.projectedValue <= 99))).toBe(true);
    expect(first.rows[0]?.performancePoints).toBeGreaterThan(0);
    expect(first.rows.some((row) => row.ratingDeltas.length > 0)).toBe(true);
    expect(first.trainingSummary.length).toBeGreaterThanOrEqual(6);
    expect(first.trainingSummary.every((row) =>
      row.averagePoints >= 0 &&
      row.averagePoints <= 100 &&
      row.playerCount > 0 &&
      row.totalPoints >= row.averagePoints)).toBe(true);
  });

  it('reports current overall without mutating roster ratings', () => {
    const save = simulateCurrentDynastyUserGame(simulateCurrentDynastyWeekNonUserGames(
      createSave('dynasty-progression-overall'),
    ).save).save;
    const roster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const preview = createDynastyProgressionPreview({ save });
    const quarterback = roster.players.find((player) => player.footballPosition === 'QB')!;
    const quarterbackPreview = preview.rows.find((row) => row.playerId === quarterback.id)!;

    expect(quarterbackPreview.currentOverall).toBe(
      calculateOverallRating(quarterback.footballPosition, quarterback.ratings),
    );
    expect(quarterbackPreview.projectedOverall).toBeGreaterThanOrEqual(quarterbackPreview.currentOverall);
    expect('OVR' in quarterback.ratings).toBe(false);
  });

  it('groups training summaries by position room and archetype focus', () => {
    const save = simulateCurrentDynastyUserGame(simulateCurrentDynastyWeekNonUserGames(
      createSave('dynasty-training-summary'),
    ).save).save;
    const preview = createDynastyProgressionPreview({ save });
    const rooms = preview.trainingSummary.map((row) => row.room);

    expect(rooms).toEqual(expect.arrayContaining([
      'Backfield',
      'Front Seven',
      'Line',
      'Quarterbacks',
      'Receivers',
      'Secondary',
      'Specialists',
    ]));
    expect(preview.trainingSummary[0]?.focusLabel).toMatch(/ focus$/);
    expect(preview.trainingSummary[0]?.leaderName).toMatch(/\w+ \w+/);
  });

  it('persists approved current-week progression applications without mutating roster ratings', () => {
    const save = createCompletedCurrentWeekSave('dynasty-progression-approve');
    const result = approveCurrentDynastyWeekProgression({
      appliedAt: '2026-06-24T13:00:00.000Z',
      save,
    });

    expect(result.approved).toBe(true);
    expect(result.applications.length).toBeGreaterThan(0);
    expect(result.save.currentSeason.progressionApplications).toHaveLength(result.applications.length);
    expect(result.applications.every((application) =>
      application.appliedAt === '2026-06-24T13:00:00.000Z' &&
      application.teamId === DEFAULT_USER_TEAM_ID &&
      application.weekIndex === save.currentWeekIndex &&
      application.ratingDeltas.length > 0 &&
      application.ratingDeltas.length <= 3 &&
      application.projectedOverall >= application.currentOverall)).toBe(true);
    expect(validateDynastySaveData(result.save)).toEqual([]);

    const roster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const firstApplication = result.applications[0]!;
    const player = roster.players.find((rosterPlayer) => rosterPlayer.id === firstApplication.playerId)!;
    expect(calculateOverallRating(player.footballPosition, player.ratings))
      .toBe(firstApplication.currentOverall);
  });

  it('does not approve progression before the current week is complete or after it was already saved', () => {
    const pending = approveCurrentDynastyWeekProgression({ save: createSave('dynasty-progression-pending') });
    const completed = createCompletedCurrentWeekSave('dynasty-progression-duplicate');
    const first = approveCurrentDynastyWeekProgression({ save: completed });
    const duplicate = approveCurrentDynastyWeekProgression({ save: first.save });

    expect(pending.approved).toBe(false);
    expect(pending.applications).toEqual([]);
    expect(pending.save.currentSeason.progressionApplications).toEqual([]);
    expect(first.approved).toBe(true);
    expect(duplicate.approved).toBe(false);
    expect(duplicate.applications).toEqual([]);
    expect(duplicate.save.currentSeason.progressionApplications)
      .toHaveLength(first.save.currentSeason.progressionApplications.length);
  });
});

function createSave(seed: string) {
  const league = generateLeagueData({ seed: 'dynasty-progression-league' });
  return createDynastySeasonCore({
    createdAt: '2026-06-24T12:00:00.000Z',
    seed,
    teams: league.teams,
    userTeamId: DEFAULT_USER_TEAM_ID,
  });
}

function createCompletedCurrentWeekSave(seed: string) {
  return simulateCurrentDynastyUserGame(simulateCurrentDynastyWeekNonUserGames(
    createSave(seed),
  ).save).save;
}
