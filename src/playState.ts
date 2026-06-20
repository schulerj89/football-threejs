import {
  createBallModel,
  giveBallToPlayer,
  resetBallModel,
  updateCarriedBallPosition,
  type BallModel,
} from './ballModel';
import {
  createDefenderModel,
  isTackleContact,
  resetDefenderModel,
  snapshotDefenderModel,
  stopDefender,
  updateDefenderPursuit,
  type DefenderModel,
  type DefenderSnapshot,
} from './defenderModel';
import { OPPOSING_GOAL_LINE_Z } from './field';
import {
  PLAYER_MOVEMENT_CONFIG,
  createPlayerModel,
  resetPlayerModel,
  snapshotPlayerModel,
  type PlayerModel,
  type PlayerSnapshot,
} from './playerModel';

export type PlayState = 'preSnap' | 'live' | 'dead';
export type PlayResult = 'none' | 'tackle' | 'touchdown';

export const GAMEPLAY_CONFIG = {
  touchdownPoints: 6,
  touchdownResetDelaySeconds: 1.25,
  opposingGoalLineZ: OPPOSING_GOAL_LINE_Z,
  tackleResetDelaySeconds: 1.25,
} as const;

export interface GameplayModel {
  ball: BallModel;
  defender: DefenderModel;
  lastPlayResult: PlayResult;
  player: PlayerModel;
  playState: PlayState;
  playResetTimerSeconds: number | null;
  score: number;
}

export interface GameplaySnapshot {
  ball: {
    possession: BallModel['possession'];
    position: BallModel['position'];
  };
  defender: DefenderSnapshot;
  lastPlayResult: PlayResult;
  player: PlayerSnapshot;
  playState: PlayState;
  score: number;
}

export function createGameplayModel(): GameplayModel {
  return {
    ball: createBallModel(),
    defender: createDefenderModel(),
    lastPlayResult: 'none',
    player: createPlayerModel(),
    playState: 'preSnap',
    playResetTimerSeconds: null,
    score: 0,
  };
}

export function startPlay(gameplay: GameplayModel): boolean {
  if (gameplay.playState !== 'preSnap') {
    return false;
  }

  gameplay.lastPlayResult = 'none';
  gameplay.playResetTimerSeconds = null;
  gameplay.playState = 'live';
  giveBallToPlayer(gameplay.ball, gameplay.player);
  return true;
}

export function markPlayDead(gameplay: GameplayModel): boolean {
  if (gameplay.playState !== 'live') {
    return false;
  }

  gameplay.playState = 'dead';
  return true;
}

export function resetPlay(gameplay: GameplayModel): void {
  gameplay.lastPlayResult = 'none';
  gameplay.playState = 'preSnap';
  gameplay.playResetTimerSeconds = null;
  resetPlayerModel(gameplay.player);
  resetDefenderModel(gameplay.defender);
  resetBallModel(gameplay.ball);
}

export function updateGameplayModel(gameplay: GameplayModel, deltaSeconds = 0): void {
  if (gameplay.playState === 'live') {
    updateDefenderPursuit(gameplay.defender, gameplay.player, deltaSeconds);
    detectTackle(gameplay);

    if (gameplay.playState === 'live') {
      detectTouchdown(gameplay);
    }
  } else if (gameplay.playResetTimerSeconds !== null) {
    gameplay.playResetTimerSeconds -= Math.max(0, deltaSeconds);

    if (gameplay.playResetTimerSeconds <= 0) {
      resetPlay(gameplay);
    }
  }

  updateCarriedBallPosition(gameplay.ball, gameplay.player);
}

export function snapshotGameplayModel(gameplay: GameplayModel): GameplaySnapshot {
  return {
    ball: {
      possession: { ...gameplay.ball.possession },
      position: { ...gameplay.ball.position },
    },
    defender: snapshotDefenderModel(gameplay.defender),
    lastPlayResult: gameplay.lastPlayResult,
    player: snapshotPlayerModel(gameplay.player),
    playState: gameplay.playState,
    score: gameplay.score,
  };
}

export function hasCrossedOpposingGoalLine(player: PlayerModel): boolean {
  return player.position.z + PLAYER_MOVEMENT_CONFIG.halfDepth >= GAMEPLAY_CONFIG.opposingGoalLineZ;
}

function detectTouchdown(gameplay: GameplayModel): void {
  if (
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id ||
    !hasCrossedOpposingGoalLine(gameplay.player)
  ) {
    return;
  }

  gameplay.score += GAMEPLAY_CONFIG.touchdownPoints;
  gameplay.lastPlayResult = 'touchdown';
  gameplay.playState = 'dead';
  gameplay.playResetTimerSeconds = GAMEPLAY_CONFIG.touchdownResetDelaySeconds;
  stopLiveActors(gameplay);
}

function detectTackle(gameplay: GameplayModel): void {
  if (
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id ||
    !isTackleContact(gameplay.defender, gameplay.player)
  ) {
    return;
  }

  gameplay.lastPlayResult = 'tackle';
  gameplay.playState = 'dead';
  gameplay.playResetTimerSeconds = GAMEPLAY_CONFIG.tackleResetDelaySeconds;
  stopLiveActors(gameplay);
}

function stopLiveActors(gameplay: GameplayModel): void {
  gameplay.player.velocity.x = 0;
  gameplay.player.velocity.z = 0;
  stopDefender(gameplay.defender);
}
