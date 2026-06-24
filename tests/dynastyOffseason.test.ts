import { describe, expect, it } from 'vitest';
import {
  DYNASTY_OFFSEASON_DEPARTURE_PREVIEW_COUNT,
  createDynastyOffseasonDeparturePreview,
  createDynastyOffseasonIncomingClassPreview,
  createDynastyOffseasonNextSeasonShell,
  createDynastyOffseasonRosterReview,
} from '../src/dynasty/DynastyOffseason';
import { createDynastySigningClassPreview } from '../src/dynasty/DynastyRecruiting';
import { createDynastySeasonCore } from '../src/dynasty/DynastySchedule';
import {
  advanceDynastyWeek,
  simulateCurrentDynastyUserGame,
  simulateCurrentDynastyWeekNonUserGames,
} from '../src/dynasty/DynastyWeekAdvance';
import { generateLeagueData } from '../src/league/LeagueGenerator';
import { getTeamRosterOrDefault } from '../src/roster/RosterRegistry';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';

describe('dynasty offseason departures', () => {
  it('creates a deterministic read-only departure preview from the user roster', () => {
    const save = createSave('dynasty-offseason-departures');
    const beforeRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const first = createDynastyOffseasonDeparturePreview({ save });
    const second = createDynastyOffseasonDeparturePreview({ save });
    const alternate = createDynastyOffseasonDeparturePreview({
      save: createSave('dynasty-offseason-departures-alt'),
    });
    const afterRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const rosterIds = new Set(beforeRoster.players.map((player) => player.id));

    expect(first).toEqual(second);
    expect(first).not.toEqual(alternate);
    expect(first.teamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(first.seasonYear).toBe(save.currentSeason.year);
    expect(first.seasonComplete).toBe(false);
    expect(first.summaryLabel).toBe('6 departure candidates | preview only');
    expect(first.departureCandidates).toHaveLength(DYNASTY_OFFSEASON_DEPARTURE_PREVIEW_COUNT);
    expect(new Set(first.departureCandidates.map((candidate) => candidate.playerId)).size)
      .toBe(first.departureCandidates.length);
    expect(first.departureCandidates.every((candidate) =>
      rosterIds.has(candidate.playerId) &&
      candidate.playerName.length > 0 &&
      candidate.departureRisk >= 0 &&
      candidate.departureRisk <= 100 &&
      candidate.overall >= 0 &&
      candidate.overall <= 99 &&
      candidate.reasonLabel.length > 0 &&
      candidate.rosterStatusLabel.length > 0)).toBe(true);
    for (let index = 1; index < first.departureCandidates.length; index += 1) {
      expect(first.departureCandidates[index - 1]!.departureRisk)
        .toBeGreaterThanOrEqual(first.departureCandidates[index]!.departureRisk);
    }
    expect(afterRoster.players.map((player) => [player.id, player.ratings])).toEqual(
      beforeRoster.players.map((player) => [player.id, player.ratings]),
    );
  });

  it('connects the recruiting signing preview to an offseason incoming class without mutating rosters', () => {
    const save = createSave('dynasty-offseason-incoming-class');
    const beforeRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const first = createDynastyOffseasonIncomingClassPreview({ save });
    const second = createDynastyOffseasonIncomingClassPreview({ save });
    const signingPreview = createDynastySigningClassPreview({ save });
    const afterRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const activeRosterPlayerIds = new Set(beforeRoster.players.map((player) => player.id));

    expect(first).toEqual(second);
    expect(first.teamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(first.seasonYear).toBe(save.currentSeason.year);
    expect(first.seasonComplete).toBe(false);
    expect(first.signingClassPreview).toEqual(signingPreview);
    expect(first.summaryLabel).toBe(`${signingPreview.projectedSignees.length} incoming prospects | preview only`);
    expect(first.incomingCandidates).toHaveLength(signingPreview.projectedSignees.length);
    expect(first.currentRosterCount).toBe(beforeRoster.players.length);
    expect(first.projectedRosterCount).toBe(beforeRoster.players.length + first.incomingCandidates.length);
    expect(first.addressedNeedCount).toBe(signingPreview.addressedNeedCount);
    expect(first.classFitScore).toBe(signingPreview.classFitScore);
    expect(new Set(first.incomingCandidates.map((candidate) => candidate.prospectId)).size)
      .toBe(first.incomingCandidates.length);
    expect(first.incomingCandidates.every((candidate) =>
      candidate.fitLabel.length > 0 &&
      candidate.projectedGrade >= 58 &&
      candidate.projectedGrade <= 91 &&
      candidate.rosterActionLabel === 'Preview only' &&
      candidate.room.length > 0 &&
      candidate.signingConfidence >= 0 &&
      candidate.signingConfidence <= 100 &&
      candidate.sourceLabel === `${candidate.starRating}-star ${candidate.room}` &&
      candidate.starRating >= 1 &&
      candidate.starRating <= 5 &&
      !activeRosterPlayerIds.has(candidate.prospectId))).toBe(true);
    expect(first.incomingCandidates.map((candidate) => candidate.prospectId)).toEqual(
      signingPreview.projectedSignees.map((signee) => signee.prospectId),
    );
    expect(afterRoster.players.map((player) => player.id)).toEqual(
      beforeRoster.players.map((player) => player.id),
    );
    expect(afterRoster.players.map((player) => [player.id, player.ratings])).toEqual(
      beforeRoster.players.map((player) => [player.id, player.ratings]),
    );
  });

  it('summarizes offseason roster balance by room without changing roster data', () => {
    const save = createSave('dynasty-offseason-roster-review');
    const beforeRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const departurePreview = createDynastyOffseasonDeparturePreview({ save });
    const incomingClassPreview = createDynastyOffseasonIncomingClassPreview({ save });
    const first = createDynastyOffseasonRosterReview({ save });
    const second = createDynastyOffseasonRosterReview({ save });
    const afterRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);

    expect(first).toEqual(second);
    expect(first.teamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(first.seasonYear).toBe(save.currentSeason.year);
    expect(first.seasonComplete).toBe(false);
    expect(first.departurePreview).toEqual(departurePreview);
    expect(first.incomingClassPreview).toEqual(incomingClassPreview);
    expect(first.reviewRows.map((row) => row.room)).toEqual([
      'Quarterbacks',
      'Backfield',
      'Receivers',
      'Line',
      'Front Seven',
      'Secondary',
      'Specialists',
    ]);
    expect(first.totalCurrentRosterCount).toBe(beforeRoster.players.length);
    expect(first.totalDepartureCandidateCount).toBe(departurePreview.departureCandidates.length);
    expect(first.totalIncomingCandidateCount).toBe(incomingClassPreview.incomingCandidates.length);
    expect(first.totalProjectedRosterCount)
      .toBe(first.totalCurrentRosterCount - first.totalDepartureCandidateCount + first.totalIncomingCandidateCount);
    expect(first.summaryLabel).toBe(
      `${first.totalProjectedRosterCount} projected roster | ${first.reviewRows.filter((row) => row.positionGap > 0).length} rooms with gaps`,
    );
    expect(first.reviewRows.every((row) =>
      row.averageOverall >= 0 &&
      row.averageOverall <= 99 &&
      row.currentRosterCount > 0 &&
      row.returningRosterCount === row.currentRosterCount - row.departureCandidateCount &&
      row.projectedRosterCount === row.returningRosterCount + row.incomingCandidateCount &&
      row.positionGap === Math.max(0, row.targetRosterCount - row.projectedRosterCount) &&
      row.summaryLabel === `${row.room}: ${row.returningRosterCount} returning, ${row.departureCandidateCount} departure candidates, ${row.incomingCandidateCount} incoming` &&
      row.weakestOverall >= 0 &&
      row.weakestOverall <= 99)).toBe(true);
    expect(first.reviewRows.some((row) => row.gapLabel.includes('below target'))).toBe(true);
    expect(first.reviewRows.reduce((sum, row) => sum + row.currentRosterCount, 0))
      .toBe(first.totalCurrentRosterCount);
    expect(first.reviewRows.reduce((sum, row) => sum + row.departureCandidateCount, 0))
      .toBe(first.totalDepartureCandidateCount);
    expect(first.reviewRows.reduce((sum, row) => sum + row.incomingCandidateCount, 0))
      .toBe(first.totalIncomingCandidateCount);
    expect(afterRoster.players.map((player) => [player.id, player.ratings])).toEqual(
      beforeRoster.players.map((player) => [player.id, player.ratings]),
    );
  });

  it('marks departure previews as season-complete only after the final week is advanced', () => {
    const completeSave = createCompletedSave('dynasty-offseason-complete-departures');
    const preview = createDynastyOffseasonDeparturePreview({ save: completeSave });

    expect(completeSave.status).toBe('complete');
    expect(preview.seasonComplete).toBe(true);
    expect(preview.summaryLabel).toBe('6 departure candidates | season complete');
    expect(preview.departureCandidates.some((candidate) =>
      candidate.reason === 'draftInterest' ||
      candidate.reason === 'eligibility' ||
      candidate.reason === 'roleChurn')).toBe(true);
  });

  it('marks incoming class previews as season-complete only after the final week is advanced', () => {
    const completeSave = createCompletedSave('dynasty-offseason-complete-incoming');
    const preview = createDynastyOffseasonIncomingClassPreview({ save: completeSave });

    expect(completeSave.status).toBe('complete');
    expect(preview.seasonComplete).toBe(true);
    expect(preview.summaryLabel).toBe(`${preview.incomingCandidates.length} incoming prospects | season complete`);
    expect(preview.incomingCandidates.every((candidate) =>
      candidate.rosterActionLabel === 'Ready for offseason review')).toBe(true);
  });

  it('creates a next-season schedule shell and preserves completed-season history without mutating the save', () => {
    const completeSave = createCompletedSave('dynasty-offseason-next-season');
    const beforeSeason = structuredClone(completeSave.currentSeason);
    const beforeRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);
    const shell = createDynastyOffseasonNextSeasonShell({ save: completeSave });
    const rosterReview = createDynastyOffseasonRosterReview({ save: completeSave });
    const userRecord = completeSave.currentSeason.standings.find((row) =>
      row.teamId === DEFAULT_USER_TEAM_ID)!;
    const afterRoster = getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID);

    expect(completeSave.status).toBe('complete');
    expect(shell.teamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(shell.seasonComplete).toBe(true);
    expect(shell.nextSeasonYear).toBe(completeSave.currentSeason.year + 1);
    expect(shell.summaryLabel).toBe(`${shell.nextSeasonYear} schedule shell | ${completeSave.currentSeason.year} history preserved`);
    expect(shell.rosterReview).toEqual(rosterReview);
    expect(shell.currentSeasonHistory.seasonComplete).toBe(true);
    expect(shell.currentSeasonHistory.seasonId).toBe(completeSave.currentSeason.seasonId);
    expect(shell.currentSeasonHistory.year).toBe(completeSave.currentSeason.year);
    expect(shell.currentSeasonHistory.userTeamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(shell.currentSeasonHistory.userRecordLabel).toBe(`${userRecord.wins}-${userRecord.losses}`);
    expect(shell.currentSeasonHistory.teamRows).toHaveLength(completeSave.currentSeason.teamIds.length);
    expect(shell.currentSeasonHistory.teamRows.map((row) => row.rank))
      .toEqual(Array.from({ length: completeSave.currentSeason.teamIds.length }, (_, index) => index + 1));
    expect(shell.currentSeasonHistory.championTeamId).toBe(shell.currentSeasonHistory.teamRows[0]!.teamId);
    expect(shell.currentSeasonHistory.championRecordLabel)
      .toBe(`${shell.currentSeasonHistory.teamRows[0]!.wins}-${shell.currentSeasonHistory.teamRows[0]!.losses}`);
    expect(shell.currentSeasonHistory.teamRows.every((row) =>
      row.gamesPlayed === row.wins + row.losses &&
      row.pointsMargin === row.pointsFor - row.pointsAgainst)).toBe(true);
    expect(shell.nextSeason.year).toBe(shell.nextSeasonYear);
    expect(shell.nextSeason.seasonId).not.toBe(completeSave.currentSeason.seasonId);
    expect(shell.nextSeason.teamIds).toEqual(completeSave.currentSeason.teamIds);
    expect(shell.nextSeason.weeks).toHaveLength(completeSave.currentSeason.weeks.length);
    expect(shell.nextSeason.weeks.flatMap((week) => week.games).every((game) =>
      game.status === 'scheduled' && game.result === null)).toBe(true);
    expect(shell.nextSeason.standings.every((row) =>
      row.wins === 0 &&
      row.losses === 0 &&
      row.pointsFor === 0 &&
      row.pointsAgainst === 0)).toBe(true);
    expect(shell.nextSeason.teamStats.every((row) => row.gamesPlayed === 0)).toBe(true);
    expect(completeSave.currentSeason).toEqual(beforeSeason);
    expect(afterRoster.players.map((player) => [player.id, player.ratings])).toEqual(
      beforeRoster.players.map((player) => [player.id, player.ratings]),
    );
  });
});

function createSave(seed: string) {
  const league = generateLeagueData({ seed: 'dynasty-offseason-league' });
  return createDynastySeasonCore({
    createdAt: '2026-06-24T12:00:00.000Z',
    seed,
    teams: league.teams,
    userTeamId: DEFAULT_USER_TEAM_ID,
  });
}

function createCompletedSave(seed: string) {
  let save = createSave(seed);
  while (save.status !== 'complete') {
    save = simulateCurrentDynastyWeekNonUserGames(save).save;
    save = simulateCurrentDynastyUserGame(save).save;
    save = advanceDynastyWeek(save).save;
  }
  return save;
}
