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
import { INITIAL_BALL_SPOT, OPPOSING_GOAL_LINE_Z, PLAYABLE_FIELD_BOUNDS } from './field';
import {
  calculateYardsGained,
  cloneFootballSpot,
  type FootballSpot,
} from './fieldScale';
import {
  PLAYER_MOVEMENT_CONFIG,
  createPlayerModel,
  resetPlayerModel,
  snapshotPlayerModel,
  type PlayerModel,
  type PlayerSnapshot,
} from './playerModel';

export type PlayState = 'preSnap' | 'live' | 'dead';
export type PlayResultType = 'tackle' | 'outOfBounds' | 'touchdown';
export type PlayEndReason = PlayResultType;
export type ScoringTeam = 'offense' | null;

export interface PlayResult {
  endingBallSpot: FootballSpot;
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
} as const;

export interface GameplayModel {
  activePlayStartSpot: FootballSpot | null;
  ball: BallModel;
  currentBallSpot: FootballSpot;
  defender: DefenderModel;
  lastPlayResult: PlayResult | null;
  nextBallSpot: FootballSpot;
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
  activePlayStartSpot: FootballSpot | null;
  currentBallSpot: FootballSpot;
  defender: DefenderSnapshot;
  lastPlayResult: PlayResult | null;
  nextBallSpot: FootballSpot;
  player: PlayerSnapshot;
  playState: PlayState;
  score: number;
}

export function createGameplayModel(): GameplayModel {
  const initialSpot = cloneFootballSpot(INITIAL_BALL_SPOT);

  return {
    activePlayStartSpot: null,
    ball: createBallModel(initialSpot),
    currentBallSpot: cloneFootballSpot(initialSpot),
    defender: createDefenderModel(initialSpot),
    lastPlayResult: null,
    nextBallSpot: cloneFootballSpot(initialSpot),
    player: createPlayerModel(initialSpot),
    playState: 'preSnap',
    playResetTimerSeconds: null,
    score: 0,
  };
}

export function startPlay(gameplay: GameplayModel): boolean {
  if (gameplay.playState !== 'preSnap') {
    return false;
  }

  gameplay.activePlayStartSpot = cloneFootballSpot(gameplay.currentBallSpot);
  gameplay.lastPlayResult = null;
  gameplay.nextBallSpot = cloneFootballSpot(gameplay.currentBallSpot);
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
  const resetSpot = cloneFootballSpot(gameplay.nextBallSpot);

  gameplay.activePlayStartSpot = null;
  gameplay.currentBallSpot = cloneFootballSpot(resetSpot);
  gameplay.lastPlayResult = null;
  gameplay.nextBallSpot = cloneFootballSpot(resetSpot);
  gameplay.playState = 'preSnap';
  gameplay.playResetTimerSeconds = null;
  resetPlayerModel(gameplay.player, resetSpot);
  resetDefenderModel(gameplay.defender, resetSpot);
  resetBallModel(gameplay.ball, resetSpot);
}

export function updateGameplayModel(gameplay: GameplayModel, deltaSeconds = 0): void {
  if (gameplay.playState === 'live') {
    updateDefenderPursuit(gameplay.defender, gameplay.player, deltaSeconds);
    detectTackle(gameplay);

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
    currentBallSpot: cloneFootballSpot(gameplay.currentBallSpot),
    defender: snapshotDefenderModel(gameplay.defender),
    lastPlayResult: clonePlayResult(gameplay.lastPlayResult),
    nextBallSpot: cloneFootballSpot(gameplay.nextBallSpot),
    player: snapshotPlayerModel(gameplay.player),
    playState: gameplay.playState,
    score: gameplay.score,
  };
}

export function hasCrossedOpposingGoalLine(player: PlayerModel): boolean {
  return player.position.z + PLAYER_MOVEMENT_CONFIG.halfDepth >= GAMEPLAY_CONFIG.opposingGoalLineZ;
}

export function hasCrossedSideline(player: PlayerModel): boolean {
  return (
    player.position.x - PLAYER_MOVEMENT_CONFIG.halfWidth < PLAYABLE_FIELD_BOUNDS.minX ||
    player.position.x + PLAYER_MOVEMENT_CONFIG.halfWidth > PLAYABLE_FIELD_BOUNDS.maxX
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
  if (
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id ||
    !isTackleContact(gameplay.defender, gameplay.player)
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

  gameplay.lastPlayResult = {
    endingBallSpot: cloneFootballSpot(endingSpot),
    reason: type,
    scoringTeam,
    startingBallSpot: cloneFootballSpot(startingSpot),
    type,
    yardsGained: calculateYardsGained(startingSpot, endingSpot),
  };
  gameplay.nextBallSpot = cloneFootballSpot(nextBallSpot);
  gameplay.playState = 'dead';
  gameplay.playResetTimerSeconds = resetDelaySeconds;
  stopLiveActors(gameplay);
}

function stopLiveActors(gameplay: GameplayModel): void {
  gameplay.player.velocity.x = 0;
  gameplay.player.velocity.z = 0;
  stopDefender(gameplay.defender);
}

function getCarrierBallSpot(player: PlayerModel): FootballSpot {
  return {
    x: player.position.x,
    z: player.position.z,
  };
}

function getOutOfBoundsBallSpot(player: PlayerModel): FootballSpot {
  const minCenterX = PLAYABLE_FIELD_BOUNDS.minX + PLAYER_MOVEMENT_CONFIG.halfWidth;
  const maxCenterX = PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.halfWidth;

  return {
    x: clamp(player.position.x, minCenterX, maxCenterX),
    z: player.position.z,
  };
}

function clonePlayResult(playResult: PlayResult | null): PlayResult | null {
  if (!playResult) {
    return null;
  }

  return {
    endingBallSpot: cloneFootballSpot(playResult.endingBallSpot),
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
