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
import {
  STARTER_TEAM_ROSTERS,
  getTeamRosterOrDefault,
  validateStarterTeamRosters,
} from '../src/roster/RosterRegistry';
import {
  createRosterPlayer,
  validateRosterPlayer,
} from '../src/roster/RosterPlayer';
import { DEFAULT_TEAM_PROFILE_SETTINGS } from '../src/teams/TeamProfileStore';

describe('roster identity', () => {
  it('ships valid fictional starter team rosters with unique jersey numbers', () => {
    expect(STARTER_TEAM_ROSTERS).toHaveLength(4);

    for (const [index, issues] of validateStarterTeamRosters().entries()) {
      const errors = issues.filter((issue) => issue.severity === 'error');
      expect(errors, STARTER_TEAM_ROSTERS[index].teamId).toEqual([]);
    }

    for (const roster of STARTER_TEAM_ROSTERS) {
      expect(roster.offensiveStarterIds).toHaveLength(11);
      expect(roster.defensiveStarterIds).toHaveLength(11);
      expect(roster.players).toHaveLength(24);
      expect(new Set(roster.players.map((player) => player.id)).size).toBe(24);
      expect(new Set(roster.players.map((player) => player.jerseyNumber)).size).toBe(24);
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
});
