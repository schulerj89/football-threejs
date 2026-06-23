import { describe, expect, it } from 'vitest';
import { createGameStatsModel } from '../src/stats/GameStatsModel';
import { applyGameStatsEvent } from '../src/stats/GameStatsReducer';
import { createOpponentDriveStats } from '../src/stats/OpponentDriveStatsAdapter';
import { simulateOpponentDrive } from '../src/match/OpponentDriveSimulator';
import { createOwnYardLinePosition } from '../src/match/FieldPositionModel';
import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
} from '../src/teams/TeamRegistry';
import { getTeamRosterOrDefault } from '../src/roster/RosterRegistry';

describe('event-driven game stats', () => {
  it('records a designed rush for the actual ball carrier', () => {
    const stats = createGameStatsModel();

    applyGameStatsEvent(stats, {
      carrierRosterId: 'user-rb',
      defense: 'opponent',
      downBefore: 1,
      firstDown: false,
      id: 'play:1',
      offense: 'user',
      passAttemptAlreadyRecorded: false,
      passAttempted: false,
      passCompleted: false,
      passerRosterId: 'user-qb',
      playKind: 'run',
      receiverRosterId: null,
      resultType: 'tackle',
      sackerRosterId: null,
      tacklerRosterId: 'opponent-lb',
      targetRosterId: null,
      touchdown: false,
      type: 'playEnded',
      yardsGained: 7,
      yardsToFirstDownBefore: 10,
    });

    expect(stats.snapshot.teams.user).toMatchObject({
      offensivePlays: 1,
      rushingAttempts: 1,
      rushingYards: 7,
      totalYards: 7,
    });
    expect(stats.snapshot.players['user-rb']).toMatchObject({
      rosterPlayerId: 'user-rb',
      rushingAttempts: 1,
      rushingYards: 7,
    });
    expect(stats.snapshot.players['opponent-lb']).toMatchObject({
      tackles: 1,
    });
  });

  it('records a released pass, completion, yards after catch, and duplicate suppression once', () => {
    const stats = createGameStatsModel();
    const release = {
      id: 'play:2:pass',
      offense: 'user' as const,
      passerRosterId: 'user-qb',
      targetRosterId: 'user-wr',
      type: 'passReleased' as const,
    };
    const result = {
      carrierRosterId: null,
      defense: 'opponent' as const,
      downBefore: 3,
      firstDown: true,
      id: 'play:2:result',
      offense: 'user' as const,
      passAttemptAlreadyRecorded: true,
      passAttempted: true,
      passCompleted: true,
      passerRosterId: 'user-qb',
      playKind: 'pass' as const,
      receiverRosterId: 'user-wr',
      resultType: 'tackle' as const,
      sackerRosterId: null,
      tacklerRosterId: 'opponent-cb',
      targetRosterId: 'user-wr',
      touchdown: false,
      type: 'playEnded' as const,
      yardsGained: 24,
      yardsToFirstDownBefore: 8,
    };

    applyGameStatsEvent(stats, release);
    applyGameStatsEvent(stats, result);
    applyGameStatsEvent(stats, result);

    expect(stats.snapshot.duplicateSuppressionCount).toBe(1);
    expect(stats.snapshot.teams.user).toMatchObject({
      completions: 1,
      firstDowns: 1,
      offensivePlays: 1,
      passingAttempts: 1,
      passingYards: 24,
      thirdDownAttempts: 1,
      thirdDownConversions: 1,
    });
    expect(stats.snapshot.players['user-qb']).toMatchObject({
      attempts: 1,
      completions: 1,
      passingYards: 24,
    });
    expect(stats.snapshot.players['user-wr']).toMatchObject({
      receptions: 1,
      receivingYards: 24,
      targets: 1,
    });
  });

  it('records an incomplete pass as one attempt and no completion', () => {
    const stats = createGameStatsModel();

    applyGameStatsEvent(stats, {
      carrierRosterId: null,
      defense: 'opponent',
      downBefore: 2,
      firstDown: false,
      id: 'play:3',
      offense: 'user',
      passAttemptAlreadyRecorded: false,
      passAttempted: true,
      passCompleted: false,
      passerRosterId: 'user-qb',
      playKind: 'pass',
      receiverRosterId: null,
      resultType: 'incomplete',
      sackerRosterId: null,
      tacklerRosterId: null,
      targetRosterId: 'user-slot',
      touchdown: false,
      type: 'playEnded',
      yardsGained: 0,
      yardsToFirstDownBefore: 6,
    });

    expect(stats.snapshot.teams.user.passingAttempts).toBe(1);
    expect(stats.snapshot.teams.user.completions).toBe(0);
    expect(stats.snapshot.players['user-qb'].attempts).toBe(1);
    expect(stats.snapshot.players['user-slot'].targets).toBe(1);
  });

  it('records sacks without converting them into rushing attempts', () => {
    const stats = createGameStatsModel();

    applyGameStatsEvent(stats, {
      carrierRosterId: null,
      defense: 'opponent',
      downBefore: 4,
      firstDown: false,
      id: 'play:4',
      offense: 'user',
      passAttemptAlreadyRecorded: false,
      passAttempted: false,
      passCompleted: false,
      passerRosterId: 'user-qb',
      playKind: 'pass',
      receiverRosterId: null,
      resultType: 'sack',
      sackerRosterId: 'opponent-edge',
      tacklerRosterId: null,
      targetRosterId: null,
      touchdown: false,
      type: 'playEnded',
      yardsGained: -6,
      yardsToFirstDownBefore: 3,
    });

    expect(stats.snapshot.teams.user.rushingAttempts).toBe(0);
    expect(stats.snapshot.teams.user.sacksAllowed).toBe(1);
    expect(stats.snapshot.teams.opponent.sacksMade).toBe(1);
    expect(stats.snapshot.players['user-qb'].sacksTaken).toBe(1);
    expect(stats.snapshot.players['opponent-edge']).toMatchObject({
      sacks: 1,
      tackles: 1,
    });
  });

  it('records kickoff touchbacks and returns separately', () => {
    const stats = createGameStatsModel();

    applyGameStatsEvent(stats, {
      id: 'kickoff:1',
      kickerRosterId: 'opponent-k',
      kickingTeam: 'opponent',
      receivingTeam: 'user',
      returnTouchdown: false,
      returnYards: 0,
      returnerRosterId: null,
      touchback: true,
      type: 'kickoffResult',
    });
    applyGameStatsEvent(stats, {
      id: 'kickoff:2',
      kickerRosterId: 'opponent-k',
      kickingTeam: 'opponent',
      receivingTeam: 'user',
      returnTouchdown: true,
      returnYards: 91,
      returnerRosterId: 'user-kr',
      touchback: false,
      type: 'kickoffResult',
    });

    expect(stats.snapshot.teams.user.kickoffReturns).toBe(1);
    expect(stats.snapshot.teams.user.kickoffReturnYards).toBe(91);
    expect(stats.snapshot.teams.user.points).toBe(6);
    expect(stats.snapshot.players['opponent-k']).toMatchObject({
      kickoffs: 2,
      touchbacks: 1,
    });
    expect(stats.snapshot.players['user-kr']).toMatchObject({
      longestReturn: 91,
      returnTouchdowns: 1,
      returns: 1,
    });
  });

  it('keeps simulated opponent production valid and roster-bound', () => {
    const stats = createGameStatsModel();
    const summary = simulateOpponentDrive({
      difficulty: 'pro',
      driveNumber: 2,
      opponentOffensiveRating: 76,
      quarter: 1,
      remainingSeconds: 120,
      seed: 20260622,
      startingFieldPosition: createOwnYardLinePosition(25),
      userDefensiveRating: 72,
    });
    const simulatedStats = createOpponentDriveStats({
      opponentRoster: getTeamRosterOrDefault(DEFAULT_OPPONENT_TEAM_ID),
      seed: 20260622,
      summary,
      userRoster: getTeamRosterOrDefault(DEFAULT_USER_TEAM_ID),
    });

    applyGameStatsEvent(stats, {
      id: `opponent:${summary.id}`,
      stats: simulatedStats,
      team: 'opponent',
      type: 'opponentDrive',
    });

    expect(stats.snapshot.teams.opponent.totalYards).toBe(summary.yards);
    expect(stats.snapshot.teams.opponent.completions)
      .toBeLessThanOrEqual(stats.snapshot.teams.opponent.passingAttempts);
    expect(stats.snapshot.teams.opponent.passingYards).toBe(
      Object.values(stats.snapshot.players)
        .filter((player) => player.team === 'opponent')
        .reduce((total, player) => total + player.receivingYards, 0),
    );
    expect(stats.snapshot.invariantFailures).toEqual([]);
  });
});

