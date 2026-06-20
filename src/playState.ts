import {
  createBallModel,
  giveBallToPlayer,
  resetBallModel,
  updateCarriedBallPosition,
  type BallModel,
} from './ballModel';
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
export type PlayResult = 'none' | 'touchdown';

export const GAMEPLAY_CONFIG = {
  touchdownPoints: 6,
  touchdownResetDelaySeconds: 1.25,
  opposingGoalLineZ: OPPOSING_GOAL_LINE_Z,
} as const;

export interface GameplayModel {
  ball: BallModel;
  lastPlayResult: PlayResult;
  player: PlayerModel;
  playState: PlayState;
  score: number;
  touchdownResetTimerSeconds: number | null;
}

export interface GameplaySnapshot {
  ball: {
    possession: BallModel['possession'];
    position: BallModel['position'];
  };
  lastPlayResult: PlayResult;
  player: PlayerSnapshot;
  playState: PlayState;
  score: number;
}

export function createGameplayModel(): GameplayModel {
  return {
    ball: createBallModel(),
    lastPlayResult: 'none',
    player: createPlayerModel(),
    playState: 'preSnap',
    score: 0,
    touchdownResetTimerSeconds: null,
  };
}

export function startPlay(gameplay: GameplayModel): boolean {
  if (gameplay.playState !== 'preSnap') {
    return false;
  }

  gameplay.lastPlayResult = 'none';
  gameplay.touchdownResetTimerSeconds = null;
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
  gameplay.touchdownResetTimerSeconds = null;
  resetPlayerModel(gameplay.player);
  resetBallModel(gameplay.ball);
}

export function updateGameplayModel(gameplay: GameplayModel, deltaSeconds = 0): void {
  if (gameplay.playState === 'live') {
    detectTouchdown(gameplay);
  } else if (gameplay.touchdownResetTimerSeconds !== null) {
    gameplay.touchdownResetTimerSeconds -= Math.max(0, deltaSeconds);

    if (gameplay.touchdownResetTimerSeconds <= 0) {
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
  gameplay.touchdownResetTimerSeconds = GAMEPLAY_CONFIG.touchdownResetDelaySeconds;
  gameplay.player.velocity.x = 0;
  gameplay.player.velocity.z = 0;
}
