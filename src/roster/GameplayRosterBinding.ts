import type { TeamProfileSettings } from '../teams/TeamProfileStore';
import type { PlaybookId } from '../roster';
import {
  createActiveLineup,
  getLineupBinding,
  resolveLineupRosterPlayer,
  validateActiveLineup,
  type ActiveLineup,
  type ActiveLineupBinding,
  type ActiveLineupValidationIssue,
} from './ActiveLineup';
import {
  getTeamRosterOrDefault,
} from './RosterRegistry';
import type { RosterPlayer } from './RosterPlayer';
import type { TeamRoster } from './TeamRoster';

export interface GameplayRosterBinding {
  activeLineup: ActiveLineup;
  opponentRoster: TeamRoster;
  userRoster: TeamRoster;
  validationIssues: readonly ActiveLineupValidationIssue[];
}

export interface RosterPreviewRow {
  footballPosition: string;
  gameplayPlayerId: string;
  jerseyNumber: number;
  name: string;
  rosterPlayerId: string;
  teamLabel: 'Opponent' | 'User';
}

export function createGameplayRosterBinding(
  playbookId: PlaybookId,
  teamProfiles: TeamProfileSettings,
): GameplayRosterBinding {
  const userRoster = getTeamRosterOrDefault(teamProfiles.userTeamId);
  const opponentRoster = getTeamRosterOrDefault(teamProfiles.opponentTeamId);
  const activeLineup = createActiveLineup(playbookId, userRoster, opponentRoster);
  const validationIssues = validateActiveLineup(activeLineup, [userRoster, opponentRoster]);

  return {
    activeLineup,
    opponentRoster,
    userRoster,
    validationIssues,
  };
}

export function getRosterPlayerForGameplayId(
  binding: GameplayRosterBinding,
  gameplayPlayerId: string,
): RosterPlayer | null {
  return resolveLineupRosterPlayer(
    binding.activeLineup,
    [binding.userRoster, binding.opponentRoster],
    gameplayPlayerId,
  );
}

export function getLineupBindingForGameplayId(
  binding: GameplayRosterBinding,
  gameplayPlayerId: string,
): ActiveLineupBinding | null {
  return getLineupBinding(binding.activeLineup, gameplayPlayerId);
}

export function createRosterPreviewRows(
  binding: GameplayRosterBinding,
): RosterPreviewRow[] {
  return binding.activeLineup.bindings.map((lineupBinding) => {
    const player = getRosterPlayerForGameplayId(binding, lineupBinding.gameplayPlayerId);

    return {
      footballPosition: player?.footballPosition ?? lineupBinding.footballPosition,
      gameplayPlayerId: lineupBinding.gameplayPlayerId,
      jerseyNumber: player?.jerseyNumber ?? 0,
      name: player?.displayName ?? lineupBinding.rosterPlayerId,
      rosterPlayerId: lineupBinding.rosterPlayerId,
      teamLabel: lineupBinding.team === 'offense' ? 'User' : 'Opponent',
    };
  });
}
