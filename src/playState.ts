import {
  createBallModel,
  giveBallToPlayer,
  resetBallModel,
  updateCarriedBallPosition,
  type BallModel,
} from './ballModel';
import {
  isTackleContact,
} from './defenderModel';
import {
  applyPlayResultToDrive,
  createDriveModel,
  resetDriveModel,
  snapshotDriveModel,
  type DriveModel,
  type DriveSnapshot,
} from './driveModel';
import { INITIAL_BALL_SPOT, OPPOSING_GOAL_LINE_Z, PLAYABLE_FIELD_BOUNDS } from './field';
import {
  calculateYardsGained,
  cloneFootballSpot,
  type FootballSpot,
} from './fieldScale';
import { createFormationPlayers, resetFormationPlayers } from './formation';
import {
  RUNNER_PLAYER_ID,
  snapshotPlayerModel,
  type PlayerModel,
  type PlayerSnapshot,
} from './playerModel';
import {
  createBlockingState,
  resetBlockingState,
  updateRushingDrillAi,
  type BlockingEngagement,
  type BlockingState,
} from './teamSimulation';

export type PlayState = 'preSnap' | 'live' | 'dead';
export type PlayResultType = 'tackle' | 'outOfBounds' | 'touchdown';
export type PlayEndReason = PlayResultType;
export type ScoringTeam = 'offense' | null;

export interface PlayResult {
  endingBallSpot: FootballSpot;
  id: number;
  reason: PlayEndReason;
  scoringTeam: ScoringTeam;
  startingBallSpot: FootballSpot;
  type: PlayResultType;
  yardsGained: number;
}

export const GAMEPLAY_CONFIG = {
  touchdownPoints: 6,
  touchdownResetDelaySeconds: 1.25,
  opposingGoalLineZ: OPPOSING_GOAL_LINE_Z,
  outOfBoundsResetDelaySeconds: 1.25,
  tackleResetDelaySeconds: 1.25,
  turnoverResetDelaySeconds: 1.25,
} as const;

export interface GameplayModel {
  activePlayStartSpot: FootballSpot | null;
  ball: BallModel;
  blocking: BlockingState;
  currentBallSpot: FootballSpot;
  drive: DriveModel;
  lastPlayResult: PlayResult | null;
  nextBallSpot: FootballSpot;
  nextPlayResultId: number;
  player: PlayerModel;
  players: PlayerModel[];
  playState: PlayState;
  playResetTimerSeconds: number | null;
  score: number;
}

export interface GameplaySnapshot {
  ball: {
    possession: BallModel['possession'];
    position: BallModel['position'];
  };
  activePlayStartSpot: FootballSpot | null;
  blocking: {
    engagements: BlockingEngagement[];
  };
  currentBallSpot: FootballSpot;
  drive: DriveSnapshot;
  lastPlayResult: PlayResult | null;
  nextBallSpot: FootballSpot;
  player: PlayerSnapshot;
  players: PlayerSnapshot[];
  playState: PlayState;
  score: number;
}

export function createGameplayModel(): GameplayModel {
  const initialSpot = cloneFootballSpot(INITIAL_BALL_SPOT);
  const players = createFormationPlayers(initialSpot);
  const runner = getRunner(players);

  return {
    activePlayStartSpot: null,
    ball: createBallModel(initialSpot),
    blocking: createBlockingState(),
    currentBallSpot: cloneFootballSpot(initialSpot),
    drive: createDriveModel(initialSpot),
    lastPlayResult: null,
    nextBallSpot: cloneFootballSpot(initialSpot),
    nextPlayResultId: 1,
    player: runner,
    players,
    playState: 'preSnap',
    playResetTimerSeconds: null,
    score: 0,
  };
}

export function startPlay(gameplay: GameplayModel): boolean {
  if (gameplay.playState !== 'preSnap' || gameplay.drive.state !== 'active') {
    return false;
  }

  gameplay.currentBallSpot = cloneFootballSpot(gameplay.drive.lineOfScrimmage);
  gameplay.activePlayStartSpot = cloneFootballSpot(gameplay.drive.lineOfScrimmage);
  gameplay.lastPlayResult = null;
  gameplay.nextBallSpot = cloneFootballSpot(gameplay.drive.lineOfScrimmage);
  gameplay.playResetTimerSeconds = null;
  gameplay.playState = 'live';
  resetBlockingState(gameplay.blocking);
  for (const player of gameplay.players) {
    if (player.role === 'runner') {
      player.currentState = 'userControlled';
    } else if (player.role === 'blocker') {
      player.currentState = 'movingToLane';
    } else {
      player.currentState = 'pursuing';
    }
  }
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
  const shouldResetDrive = gameplay.drive.state === 'over';

  if (shouldResetDrive) {
    resetDriveModel(gameplay.drive);
  }

  const resetSpot = shouldResetDrive
    ? cloneFootballSpot(INITIAL_BALL_SPOT)
    : cloneFootballSpot(gameplay.nextBallSpot);

  gameplay.activePlayStartSpot = null;
  gameplay.currentBallSpot = cloneFootballSpot(resetSpot);
  gameplay.lastPlayResult = null;
  gameplay.nextBallSpot = cloneFootballSpot(resetSpot);
  gameplay.playState = 'preSnap';
  gameplay.playResetTimerSeconds = null;
  resetBlockingState(gameplay.blocking);
  resetFormationPlayers(gameplay.players, resetSpot);
  resetBallModel(gameplay.ball, resetSpot);
}

export function updateGameplayModel(gameplay: GameplayModel, deltaSeconds = 0): void {
  if (gameplay.playState === 'live') {
    detectTackle(gameplay);

    if (gameplay.playState === 'live') {
      updateRushingDrillAi(gameplay.players, gameplay.blocking, gameplay.player, {
        bounds: PLAYABLE_FIELD_BOUNDS,
        deltaSeconds,
        lineOfScrimmage: gameplay.currentBallSpot,
      });
      detectTackle(gameplay);
    }

    if (gameplay.playState === 'live') {
      detectTouchdown(gameplay);
    }

    if (gameplay.playState === 'live') {
      detectOutOfBounds(gameplay);
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
    activePlayStartSpot: gameplay.activePlayStartSpot
      ? cloneFootballSpot(gameplay.activePlayStartSpot)
      : null,
    ball: {
      possession: { ...gameplay.ball.possession },
      position: { ...gameplay.ball.position },
    },
    blocking: {
      engagements: gameplay.blocking.engagements.map((engagement) => ({ ...engagement })),
    },
    currentBallSpot: cloneFootballSpot(gameplay.currentBallSpot),
    drive: snapshotDriveModel(gameplay.drive),
    lastPlayResult: clonePlayResult(gameplay.lastPlayResult),
    nextBallSpot: cloneFootballSpot(gameplay.nextBallSpot),
    player: snapshotPlayerModel(gameplay.player),
    players: gameplay.players.map(snapshotPlayerModel),
    playState: gameplay.playState,
    score: gameplay.score,
  };
}

export function hasCrossedOpposingGoalLine(player: PlayerModel): boolean {
  return player.position.z + player.collisionRadius >= GAMEPLAY_CONFIG.opposingGoalLineZ;
}

export function hasCrossedSideline(player: PlayerModel): boolean {
  return (
    player.position.x - player.collisionRadius < PLAYABLE_FIELD_BOUNDS.minX ||
    player.position.x + player.collisionRadius > PLAYABLE_FIELD_BOUNDS.maxX
  );
}

function detectTouchdown(gameplay: GameplayModel): void {
  if (
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id ||
    !hasCrossedOpposingGoalLine(gameplay.player)
  ) {
    return;
  }

  const endingSpot = {
    x: gameplay.player.position.x,
    z: GAMEPLAY_CONFIG.opposingGoalLineZ,
  };

  gameplay.score += GAMEPLAY_CONFIG.touchdownPoints;
  recordPlayResult(
    gameplay,
    'touchdown',
    endingSpot,
    cloneFootballSpot(INITIAL_BALL_SPOT),
    GAMEPLAY_CONFIG.touchdownResetDelaySeconds,
    'offense',
  );
}

function detectTackle(gameplay: GameplayModel): void {
  const tackler = gameplay.players.find(
    (player) => player.team === 'defense' && player.role === 'defender' && isTackleContact(player, gameplay.player),
  );

  if (
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id ||
    !tackler
  ) {
    return;
  }

  const endingSpot = getCarrierBallSpot(gameplay.player);

  recordPlayResult(
    gameplay,
    'tackle',
    endingSpot,
    endingSpot,
    GAMEPLAY_CONFIG.tackleResetDelaySeconds,
    null,
  );
}

function detectOutOfBounds(gameplay: GameplayModel): void {
  if (
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id ||
    !hasCrossedSideline(gameplay.player)
  ) {
    return;
  }

  const endingSpot = getOutOfBoundsBallSpot(gameplay.player);

  recordPlayResult(
    gameplay,
    'outOfBounds',
    endingSpot,
    endingSpot,
    GAMEPLAY_CONFIG.outOfBoundsResetDelaySeconds,
    null,
  );
}

function recordPlayResult(
  gameplay: GameplayModel,
  type: PlayResultType,
  endingSpot: FootballSpot,
  nextBallSpot: FootballSpot,
  resetDelaySeconds: number,
  scoringTeam: ScoringTeam,
): void {
  const startingSpot = gameplay.activePlayStartSpot ?? gameplay.currentBallSpot;

  const playResult: PlayResult = {
    endingBallSpot: cloneFootballSpot(endingSpot),
    id: gameplay.nextPlayResultId,
    reason: type,
    scoringTeam,
    startingBallSpot: cloneFootballSpot(startingSpot),
    type,
    yardsGained: calculateYardsGained(startingSpot, endingSpot),
  };
  gameplay.nextPlayResultId += 1;
  gameplay.lastPlayResult = playResult;
  gameplay.nextBallSpot = cloneFootballSpot(nextBallSpot);

  const driveUpdate = applyPlayResultToDrive(gameplay.drive, playResult);
  gameplay.nextBallSpot = cloneFootballSpot(driveUpdate.nextBallSpot);
  gameplay.playState = 'dead';
  gameplay.playResetTimerSeconds =
    gameplay.drive.lastDriveResult?.type === 'turnoverOnDowns'
      ? GAMEPLAY_CONFIG.turnoverResetDelaySeconds
      : resetDelaySeconds;
  stopLiveActors(gameplay);
}

function stopLiveActors(gameplay: GameplayModel): void {
  for (const player of gameplay.players) {
    player.velocity.x = 0;
    player.velocity.z = 0;
    player.currentState = 'idle';
  }
}

function getCarrierBallSpot(player: PlayerModel): FootballSpot {
  return {
    x: player.position.x,
    z: player.position.z,
  };
}

function getOutOfBoundsBallSpot(player: PlayerModel): FootballSpot {
  const minCenterX = PLAYABLE_FIELD_BOUNDS.minX + player.collisionRadius;
  const maxCenterX = PLAYABLE_FIELD_BOUNDS.maxX - player.collisionRadius;

  return {
    x: clamp(player.position.x, minCenterX, maxCenterX),
    z: player.position.z,
  };
}

function getRunner(players: PlayerModel[]): PlayerModel {
  const runner = players.find((player) => player.id === RUNNER_PLAYER_ID);

  if (!runner) {
    throw new Error('Missing runner in rushing drill formation');
  }

  return runner;
}

function clonePlayResult(playResult: PlayResult | null): PlayResult | null {
  if (!playResult) {
    return null;
  }

  return {
    endingBallSpot: cloneFootballSpot(playResult.endingBallSpot),
    id: playResult.id,
    reason: playResult.reason,
    scoringTeam: playResult.scoringTeam,
    startingBallSpot: cloneFootballSpot(playResult.startingBallSpot),
    type: playResult.type,
    yardsGained: playResult.yardsGained,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
