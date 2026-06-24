import { describe, expect, it } from 'vitest';
import {
  DYNASTY_RECRUITING_PITCH_STYLES,
  DYNASTY_RECRUITING_PROSPECT_COUNT,
  createDynastyRecruitingBoard,
  createDynastyRecruitingTeamNeeds,
} from '../src/dynasty/DynastyRecruiting';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { STARTER_TEAM_ROSTERS } from '../src/roster/RosterRegistry';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';

describe('dynasty recruiting-lite board', () => {
  it('creates a deterministic fictional prospect pool from the save seed', () => {
    const first = createDynastyRecruitingBoard({ save: createSave('dynasty-recruiting-board') });
    const second = createDynastyRecruitingBoard({ save: createSave('dynasty-recruiting-board') });
    const alternate = createDynastyRecruitingBoard({ save: createSave('dynasty-recruiting-board-alt') });

    expect(first).toEqual(second);
    expect(first).not.toEqual(alternate);
    expect(first.summaryLabel).toBe('18 fictional prospects | deterministic board');
    expect(first.pitchStyles).toEqual(DYNASTY_RECRUITING_PITCH_STYLES);
    expect(first.prospects).toHaveLength(DYNASTY_RECRUITING_PROSPECT_COUNT);
    expect(first.teamNeeds).toHaveLength(7);
    expect(new Set(first.prospects.map((prospect) => prospect.id)).size)
      .toBe(DYNASTY_RECRUITING_PROSPECT_COUNT);
    expect(first.prospects.map((prospect) => prospect.nationalRank))
      .toEqual(Array.from({ length: DYNASTY_RECRUITING_PROSPECT_COUNT }, (_, index) => index + 1));
    expect(first.prospects.every((prospect) =>
      prospect.displayName === `${prospect.firstName} ${prospect.lastName}` &&
      prospect.id.startsWith('dynasty-prospect-') &&
      prospect.overallGrade >= 58 &&
      prospect.overallGrade <= 91 &&
      prospect.starRating >= 1 &&
      prospect.starRating <= 5)).toBe(true);
  });

  it('includes every dynasty team with bounded three-style pitch fit scores', () => {
    const save = createSave('dynasty-recruiting-interest');
    const board = createDynastyRecruitingBoard({ save });
    const teamIds = [...save.currentSeason.teamIds].sort();

    for (const prospect of board.prospects) {
      expect(prospect.interest).toHaveLength(teamIds.length);
      expect([...prospect.interest].sort((a, b) => a.teamId.localeCompare(b.teamId)).map((row) => row.teamId))
        .toEqual(teamIds);
      for (const interest of prospect.interest) {
        expect(interest.score).toBeGreaterThanOrEqual(35);
        expect(interest.score).toBeLessThanOrEqual(95);
        expect(Object.keys(interest.pitchFit).sort()).toEqual([...DYNASTY_RECRUITING_PITCH_STYLES].sort());
        expect(Object.values(interest.pitchFit).every((value) => value >= 35 && value <= 95)).toBe(true);
      }
      expect(prospect.interest[0]!.score).toBeGreaterThanOrEqual(prospect.interest.at(-1)!.score);
    }
  });

  it('derives compact team needs from roster composition and ratings', () => {
    const save = createSave('dynasty-recruiting-needs');
    const first = createDynastyRecruitingTeamNeeds({ save });
    const second = createDynastyRecruitingTeamNeeds({ save });
    const alternateTeam = save.currentSeason.teamIds.find((teamId) => teamId !== DEFAULT_USER_TEAM_ID)!;
    const alternate = createDynastyRecruitingTeamNeeds({ save, teamId: alternateTeam });

    expect(first).toEqual(second);
    expect(first).not.toEqual(alternate);
    expect(first.map((need) => need.room).sort()).toEqual([
      'Backfield',
      'Front Seven',
      'Line',
      'Quarterbacks',
      'Receivers',
      'Secondary',
      'Specialists',
    ]);
    expect(first.every((need) =>
      need.averageOverall >= 0 &&
      need.averageOverall <= 99 &&
      need.weakestOverall >= 0 &&
      need.weakestOverall <= 99 &&
      need.priorityScore >= 0 &&
      need.priorityScore <= 100 &&
      need.rosterCount > 0 &&
      need.targetRosterCount > 0 &&
      need.starterCount > 0 &&
      need.summaryLabel.includes(`${need.rosterCount}/${need.targetRosterCount} rostered`))).toBe(true);
    for (let index = 1; index < first.length; index += 1) {
      expect(first[index - 1]!.priorityScore).toBeGreaterThanOrEqual(first[index]!.priorityScore);
    }
    expect(first.find((need) => need.room === 'Quarterbacks')).toMatchObject({
      positions: ['QB'],
      rosterCount: 1,
      starterCount: 1,
      targetRosterCount: 2,
    });
    expect(first.find((need) => need.room === 'Line')?.positions).toEqual(['C', 'LG', 'LT', 'RG', 'RT', 'LS']);
  });

  it('does not change current roster size constraints while generating prospects', () => {
    const beforeSizes = STARTER_TEAM_ROSTERS.map((roster) => roster.players.length);
    const board = createDynastyRecruitingBoard({ save: createSave('dynasty-recruiting-roster-safety') });
    const afterSizes = STARTER_TEAM_ROSTERS.map((roster) => roster.players.length);

    expect(board.prospects).toHaveLength(18);
    expect(beforeSizes).toEqual([32, 32, 32, 32, 32, 32]);
    expect(afterSizes).toEqual(beforeSizes);
  });
});

function createSave(seed: string) {
  const league = generateLeagueData({ seed: 'dynasty-recruiting-league' });
  return createDynastySeasonCore({
    createdAt: '2026-06-24T12:00:00.000Z',
    seed,
    teams: league.teams,
    userTeamId: DEFAULT_USER_TEAM_ID,
  });
}
