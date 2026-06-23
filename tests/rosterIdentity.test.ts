import { describe, expect, it } from 'vitest';
import {
  BROADCAST_EXPERIENCE_SETTINGS,
} from '../src/config/GameExperienceSettings';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import {
  ELEVEN_ON_ELEVEN_PLAYER_IDS,
  FIVE_ON_FIVE_PLAYER_IDS,
  SEVEN_ON_SEVEN_PLAYER_IDS,
  type PlaybookId,
} from '../src/roster';
import {
  createActiveLineup,
  getActiveLineupGameplayIds,
  validateActiveLineup,
} from '../src/roster/ActiveLineup';
import {
  createGameplayRosterBinding,
  getRosterPlayerForGameplayId,
} from '../src/roster/GameplayRosterBinding';
import { createPlayerMovementProfileFromRosterPlayer } from '../src/playerMovementProfile';
import {
  STARTER_TEAM_ROSTERS,
  getTeamRosterOrDefault,
  validateStarterTeamRosters,
} from '../src/roster/RosterRegistry';
import {
  createRosterPlayer,
  validateRosterPlayer,
} from '../src/roster/RosterPlayer';
import {
  COLLEGE_SPECIAL_TEAMS_RULE_SPEC,
  resolveKickoffLineSpot,
  resolveReceivingRestrainingLineZ,
  resolveTouchbackSpot,
  resolveTryLineSpot,
} from '../src/specialTeams/CollegeSpecialTeamsRuleSpec';
import {
  createSpecialTeamsDepthChart,
  validateSpecialTeamsDepthChart,
  type SpecialTeamsDepthChart,
} from '../src/specialTeams/SpecialTeamsDepthChart';
import {
  resolveKickoffCoverageFormation,
  resolveKickoffReturnFormation,
  resolvePlaceKickDefenseFormation,
  resolvePlaceKickFormation,
  validateSpecialTeamsFormation,
} from '../src/specialTeams/SpecialTeamsFormations';
import { DEFAULT_TEAM_PROFILE_SETTINGS } from '../src/teams/TeamProfileStore';

describe('roster identity', () => {
  it('ships valid fictional starter team rosters with unique jersey numbers', () => {
    expect(STARTER_TEAM_ROSTERS).toHaveLength(6);

    for (const [index, issues] of validateStarterTeamRosters().entries()) {
      const errors = issues.filter((issue) => issue.severity === 'error');
      expect(errors, STARTER_TEAM_ROSTERS[index].teamId).toEqual([]);
    }

    for (const roster of STARTER_TEAM_ROSTERS) {
      expect(roster.offensiveStarterIds).toHaveLength(11);
      expect(roster.defensiveStarterIds).toHaveLength(11);
      expect(roster.players).toHaveLength(32);
      expect(roster.reserveIds).toHaveLength(7);
      expect(roster.players.filter((player) => player.footballPosition === 'K')).toHaveLength(1);
      expect(roster.players.filter((player) => player.footballPosition === 'P')).toHaveLength(1);
      expect(roster.players.filter((player) => player.footballPosition === 'LS')).toHaveLength(1);
      expect(new Set(roster.players.map((player) => player.id)).size).toBe(32);
      expect(new Set(roster.players.map((player) => player.jerseyNumber)).size).toBe(32);
      expect(roster.players.every((player) => player.jerseyNumber >= 0 && player.jerseyNumber <= 99)).toBe(true);
    }
  });

  it('treats position-number convention mismatches as warnings', () => {
    const player = createRosterPlayer(
      'test-team',
      'QB',
      77,
      'Test',
      'Signal',
      'fieldGeneral',
    );

    expect(validateRosterPlayer(player)).toEqual([
      expect.objectContaining({
        severity: 'warning',
      }),
    ]);
  });

  it.each([
    ['5v5', FIVE_ON_FIVE_PLAYER_IDS],
    ['7v7', SEVEN_ON_SEVEN_PLAYER_IDS],
    ['11v11', ELEVEN_ON_ELEVEN_PLAYER_IDS],
  ] as const)('resolves every %s gameplay slot to one roster identity', (playbookId, playerIds) => {
    const binding = createGameplayRosterBinding(playbookId, DEFAULT_TEAM_PROFILE_SETTINGS);

    expect(validateActiveLineup(
      binding.activeLineup,
      [binding.userRoster, binding.opponentRoster],
    )).toEqual([]);
    expect(getActiveLineupGameplayIds(playbookId)).toEqual([...playerIds]);

    for (const gameplayPlayerId of playerIds) {
      const rosterPlayer = getRosterPlayerForGameplayId(binding, gameplayPlayerId);
      expect(rosterPlayer, gameplayPlayerId).not.toBeNull();
      expect(rosterPlayer?.displayName).toMatch(/\w+ \w+/);
    }
  });

  it('does not replace gameplay player IDs with roster names', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    const snapshot = snapshotGameplayModel(gameplay);

    expect(new Set(snapshot.players.map((player) => player.id))).toEqual(
      new Set(ELEVEN_ON_ELEVEN_PLAYER_IDS),
    );
    expect(snapshot.players.some((player) => player.id.includes(' '))).toBe(false);
  });

  it('applies roster ratings to gameplay movement profiles without changing player IDs', () => {
    const binding = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const gameplay = createGameplayModel({ playbookId: '11v11', rosterBinding: binding });
    const runningBack = gameplay.players.find((player) => player.id === 'offense-rb');
    const rosterPlayer = getRosterPlayerForGameplayId(binding, 'offense-rb');

    expect(runningBack?.movement.source).toBe('ratings');
    expect(runningBack?.movement).toEqual(
      createPlayerMovementProfileFromRosterPlayer(rosterPlayer!),
    );
    expect(runningBack?.id).toBe('offense-rb');
  });

  it('keeps slot-to-roster identity stable across play changes and reloads', () => {
    const first = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const second = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);

    expect(first.activeLineup.bindings).toEqual(second.activeLineup.bindings);
    expect(getRosterPlayerForGameplayId(first, 'offense-rb')?.id).toBe(
      getRosterPlayerForGameplayId(second, 'offense-rb')?.id,
    );
  });

  it('binds user and opponent teams to the correct sides', () => {
    const settings = {
      ...BROADCAST_EXPERIENCE_SETTINGS.teamProfiles,
      opponentTeamId: 'summit-forge',
      userTeamId: 'bay-city-current',
    };
    const userRoster = getTeamRosterOrDefault(settings.userTeamId);
    const opponentRoster = getTeamRosterOrDefault(settings.opponentTeamId);
    const lineup = createActiveLineup('11v11' satisfies PlaybookId, userRoster, opponentRoster);

    expect(lineup.bindings.find((binding) => binding.gameplayPlayerId === 'offense-qb'))
      .toMatchObject({ rosterTeamId: 'bay-city-current', team: 'offense' });
    expect(lineup.bindings.find((binding) => binding.gameplayPlayerId === 'defense-safety'))
      .toMatchObject({ rosterTeamId: 'summit-forge', team: 'defense' });
  });

  it('resolves valid eleven-player special-teams depth-chart units for every team', () => {
    for (const roster of STARTER_TEAM_ROSTERS) {
      const chart = createSpecialTeamsDepthChart(roster);

      expect(validateSpecialTeamsDepthChart(chart, roster)).toEqual([]);
      expect([
        chart.kickoffCoverage.kickerId,
        ...chart.kickoffCoverage.leftCoverageIds,
        ...chart.kickoffCoverage.rightCoverageIds,
      ]).toHaveLength(11);
      expect(chart.kickoffCoverage.leftCoverageIds).toHaveLength(5);
      expect(chart.kickoffCoverage.rightCoverageIds).toHaveLength(5);
      expect([
        ...chart.kickoffReturn.returnerIds,
        ...chart.kickoffReturn.frontLineIds,
        ...chart.kickoffReturn.secondLineIds,
      ]).toHaveLength(11);
      expect(new Set(chart.kickoffReturn.returnerIds).size).toBe(2);
      expect([
        chart.placeKick.kickerId,
        chart.placeKick.holderId,
        chart.placeKick.longSnapperId,
        ...chart.placeKick.protectorIds,
      ]).toHaveLength(11);
      expect(new Set([
        chart.placeKick.kickerId,
        chart.placeKick.holderId,
        chart.placeKick.longSnapperId,
      ]).size).toBe(3);
      expect(chart.placeKickDefense.rusherIds).toHaveLength(11);
    }
  });

  it('reports missing and duplicate special-teams depth-chart IDs clearly', () => {
    const roster = STARTER_TEAM_ROSTERS[0]!;
    const chart = createSpecialTeamsDepthChart(roster);
    const invalid: SpecialTeamsDepthChart = {
      ...chart,
      kickoffCoverage: {
        ...chart.kickoffCoverage,
        leftCoverageIds: [
          chart.kickoffCoverage.leftCoverageIds[0]!,
          chart.kickoffCoverage.leftCoverageIds[0]!,
          ...chart.kickoffCoverage.leftCoverageIds.slice(2),
        ],
      },
      placeKick: {
        ...chart.placeKick,
        longSnapperId: 'missing-long-snapper',
      },
    };

    expect(validateSpecialTeamsDepthChart(invalid, roster).map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('duplicate roster player'),
        expect.stringContaining('missing roster player missing-long-snapper'),
      ]),
    );
  });

  it('centralizes college special-teams rule spots', () => {
    expect(COLLEGE_SPECIAL_TEAMS_RULE_SPEC).toMatchObject({
      kickoffYardLine: 35,
      maximumNonKickerDepthBehindKickingLineYards: 5,
      minimumKickingPlayersPerSideOfKicker: 4,
      receivingRestrainingLineDistanceYards: 10,
      safetyFreeKickYardLine: 20,
      touchbackReceivingYardLine: 25,
      tryLineYardsFromOpponentGoal: 3,
    });
    expect(resolveKickoffLineSpot(1)).toEqual({ x: 0, z: -15 });
    expect(resolveKickoffLineSpot(-1)).toEqual({ x: 0, z: 15 });
    expect(resolveReceivingRestrainingLineZ(1)).toBe(-5);
    expect(resolveReceivingRestrainingLineZ(-1)).toBe(5);
    expect(resolveTouchbackSpot(1)).toEqual({ x: 0, z: -25 });
    expect(resolveTouchbackSpot(-1)).toEqual({ x: 0, z: 25 });
    expect(resolveTryLineSpot(1)).toEqual({ x: 0, z: 47 });
    expect(resolveTryLineSpot(-1)).toEqual({ x: 0, z: -47 });
  });

  it('resolves special-teams formation contracts without activating gameplay', () => {
    const roster = STARTER_TEAM_ROSTERS[0]!;
    const formations = [
      resolveKickoffCoverageFormation({ direction: 1, roster, teamSide: 'user' }),
      resolveKickoffReturnFormation({ direction: 1, roster, teamSide: 'user' }),
      resolvePlaceKickFormation({ direction: 1, roster, teamSide: 'user' }),
      resolvePlaceKickDefenseFormation({ direction: 1, roster, teamSide: 'opponent' }),
    ];

    expect(formations.map((formation) => formation.family)).toEqual([
      'kickoff',
      'kickoff',
      'placeKick',
      'placeKick',
    ]);
    for (const formation of formations) {
      expect(formation.participants).toHaveLength(11);
      expect(formation.participants.every((participant) => participant.presentationOnly)).toBe(true);
      expect(validateSpecialTeamsFormation(formation)).toEqual([]);
    }
  });

  it('keeps existing offensive and defensive lineup bindings unchanged after roster expansion', () => {
    const roster = STARTER_TEAM_ROSTERS[0]!;
    const lineup = createActiveLineup('11v11', roster, STARTER_TEAM_ROSTERS[1]!);

    expect(lineup.bindings.map((binding) => binding.rosterPlayerId)).not.toContain(roster.longSnapperId);
    for (const reserveId of roster.reserveIds) {
      expect(lineup.bindings.map((binding) => binding.rosterPlayerId)).not.toContain(reserveId);
    }
    expect(lineup.bindings.find((binding) => binding.gameplayPlayerId === 'offense-qb')?.rosterPlayerId)
      .toBe(roster.offensiveStarterIds[0]);
  });
});
