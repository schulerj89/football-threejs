import {
  createBallModel,
  giveBallToPlayer,
  resetBallModel,
  updateCarriedBallPosition,
  type BallModel,
} from './ballModel';
import {
  createPlayerModel,
  resetPlayerModel,
  snapshotPlayerModel,
  type PlayerModel,
  type PlayerSnapshot,
} from './playerModel';

export type PlayState = 'preSnap' | 'live' | 'dead';

export interface GameplayModel {
  ball: BallModel;
  player: PlayerModel;
  playState: PlayState;
}

export interface GameplaySnapshot {
  ball: {
    possession: BallModel['possession'];
    position: BallModel['position'];
  };
  player: PlayerSnapshot;
  playState: PlayState;
}

export function createGameplayModel(): GameplayModel {
  return {
    ball: createBallModel(),
    player: createPlayerModel(),
    playState: 'preSnap',
  };
}

export function startPlay(gameplay: GameplayModel): boolean {
  if (gameplay.playState !== 'preSnap') {
    return false;
  }

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
  gameplay.playState = 'preSnap';
  resetPlayerModel(gameplay.player);
  resetBallModel(gameplay.ball);
}

export function updateGameplayModel(gameplay: GameplayModel): void {
  updateCarriedBallPosition(gameplay.ball, gameplay.player);
}

export function snapshotGameplayModel(gameplay: GameplayModel): GameplaySnapshot {
  return {
    ball: {
      possession: { ...gameplay.ball.possession },
      position: { ...gameplay.ball.position },
    },
    player: snapshotPlayerModel(gameplay.player),
    playState: gameplay.playState,
  };
}
