import type { BallModel } from './ballModel';
import { isTackleContact } from './defenderModel';
import type { FootballSpot } from './fieldScale';
import { hasCrossedOriginalLineOfScrimmage } from './passRules';
import type { PlayDefinition } from './playbook';
import type { PlayerModel } from './playerModel';

export interface SackEligibilityState {
  ball: BallModel;
  lineOfScrimmage: FootballSpot;
  passAttempted: boolean;
  play: PlayDefinition;
  playState: 'preSnap' | 'live' | 'dead' | 'gameOver';
  quarterback: PlayerModel;
}

export function findSackingDefender(
  players: PlayerModel[],
  state: SackEligibilityState,
): PlayerModel | null {
  if (!isQuarterbackSackEligible(state)) {
    return null;
  }

  return players.find(
    (player) =>
      player.team === 'defense' &&
      player.role === 'defender' &&
      isTackleContact(player, state.quarterback),
  ) ?? null;
}

export function isQuarterbackSackEligible(state: SackEligibilityState): boolean {
  return (
    state.playState === 'live' &&
    state.play.kind === 'pass' &&
    state.quarterback.role === 'quarterback' &&
    !state.passAttempted &&
    state.ball.state.kind === 'possessed' &&
    state.ball.possession.kind === 'player' &&
    state.ball.possession.playerId === state.quarterback.id &&
    !hasQuarterbackCrossedLineOfScrimmage(state.quarterback, state.lineOfScrimmage)
  );
}

export function hasQuarterbackCrossedLineOfScrimmage(
  quarterback: PlayerModel,
  lineOfScrimmage: FootballSpot,
): boolean {
  return hasCrossedOriginalLineOfScrimmage(quarterback, lineOfScrimmage);
}
