import { describe, expect, it } from 'vitest';
import { createDynastyProgressionPreview } from '../src/dynasty/DynastyProgressionPreview';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import {
  simulateCurrentDynastyUserGame,
  simulateCurrentDynastyWeekNonUserGames,
} from '../src/dynasty/DynastyWeekAdvance';
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
    expect(first.rows[0]?.performancePoints).toBeGreaterThan(0);
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
    expect('OVR' in quarterback.ratings).toBe(false);
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
