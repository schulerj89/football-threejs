import {
  PASSING_CONFIG,
  createBallModel,
  giveBallToPlayer,
  isBallCatchableByPlayer,
  isPassFlightFinished,
  markBallDead,
  markBallIncomplete,
  resetBallModel,
  throwBallToward,
  updateCarriedBallPosition,
  updateInFlightBall,
  type BallModel,
  type Vector3,
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
import {
  DEFAULT_PLAY_ID,
  createFormationPlayers,
  getPlay,
  getReceiverRouteTarget,
  resetFormationPlayers,
  type PlayId,
  type PlayDefinition,
} from './playbook';
import {
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
export type PlayResultType = 'tackle' | 'outOfBounds' | 'touchdown' | 'incomplete';
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
  incompleteResetDelaySeconds: 1.25,
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
  passAttempted: boolean;
  player: PlayerModel;
  players: PlayerModel[];
  selectedPlay: PlayDefinition;
  playState: PlayState;
  playResetTimerSeconds: number | null;
  score: number;
}

export interface GameplaySnapshot {
  ball: {
    possession: BallModel['possession'];
    position: BallModel['position'];
    state: BallModel['state'];
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
  selectedPlay: {
    displayName: string;
    id: PlayId;
    kind: PlayDefinition['kind'];
    initialMovementDirection: FootballSpot;
  };
  playState: PlayState;
  score: number;
  passAttempted: boolean;
}

export function createGameplayModel(): GameplayModel {
  const initialSpot = cloneFootballSpot(INITIAL_BALL_SPOT);
  const selectedPlay = getPlay(DEFAULT_PLAY_ID);
  const players = createFormationPlayers(initialSpot, selectedPlay);
  const ballCarrier = getBallCarrier(players, selectedPlay);

  return {
    activePlayStartSpot: null,
    ball: createBallModel(initialSpot),
    blocking: createBlockingState(),
    currentBallSpot: cloneFootballSpot(initialSpot),
    drive: createDriveModel(initialSpot),
    lastPlayResult: null,
    nextBallSpot: cloneFootballSpot(initialSpot),
    nextPlayResultId: 1,
    passAttempted: false,
    player: ballCarrier,
    players,
    selectedPlay,
    playState: 'preSnap',
    playResetTimerSeconds: null,
    score: 0,
  };
}

export function selectPlay(gameplay: GameplayModel, playId: string): boolean {
  if (gameplay.playState !== 'preSnap') {
    return false;
  }

  const play = getPlay(playId);
  gameplay.selectedPlay = play;
  gameplay.passAttempted = false;
  resetBlockingState(gameplay.blocking);
  resetFormationPlayers(gameplay.players, gameplay.currentBallSpot, play);
  gameplay.player = getBallCarrier(gameplay.players, play);
  resetBallModel(gameplay.ball, gameplay.currentBallSpot);
  return true;
}

export function startPlay(gameplay: GameplayModel): boolean {
  if (gameplay.playState !== 'preSnap' || gameplay.drive.state !== 'active') {
    return false;
  }

  gameplay.currentBallSpot = cloneFootballSpot(gameplay.drive.lineOfScrimmage);
  gameplay.activePlayStartSpot = cloneFootballSpot(gameplay.drive.lineOfScrimmage);
  gameplay.lastPlayResult = null;
  gameplay.nextBallSpot = cloneFootballSpot(gameplay.drive.lineOfScrimmage);
  gameplay.passAttempted = false;
  gameplay.playResetTimerSeconds = null;
  gameplay.playState = 'live';
  resetBlockingState(gameplay.blocking);
  gameplay.player = getBallCarrier(gameplay.players, gameplay.selectedPlay);
  for (const player of gameplay.players) {
    if (player.id === gameplay.player.id) {
      player.currentState = 'userControlled';
    } else if (player.role === 'blocker') {
      player.currentState = 'movingToLane';
    } else if (player.role === 'receiver') {
      player.currentState = 'runningRoute';
    } else {
      player.currentState = 'pursuing';
    }
  }
  giveBallToPlayer(gameplay.ball, gameplay.player);
  return true;
}

export function attemptPass(gameplay: GameplayModel): boolean {
  if (
    gameplay.playState !== 'live' ||
    gameplay.selectedPlay.kind !== 'pass' ||
    gameplay.passAttempted ||
    gameplay.ball.state.kind !== 'possessed' ||
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id
  ) {
    return false;
  }

  const receiver = getEligibleReceiver(gameplay);
  if (!receiver) {
    return false;
  }

  const target = calculatePassTarget(gameplay, receiver);
  const thrown = throwBallToward(gameplay.ball, target);

  if (!thrown) {
    return false;
  }

  gameplay.passAttempted = true;
  gameplay.player.velocity.x = 0;
  gameplay.player.velocity.z = 0;
  gameplay.player.currentState = 'idle';
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
  gameplay.passAttempted = false;
  gameplay.playState = 'preSnap';
  gameplay.playResetTimerSeconds = null;
  resetBlockingState(gameplay.blocking);
  resetFormationPlayers(gameplay.players, resetSpot, gameplay.selectedPlay);
  gameplay.player = getBallCarrier(gameplay.players, gameplay.selectedPlay);
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
        play: gameplay.selectedPlay,
      });
      updatePassFlight(gameplay, deltaSeconds);
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
      state: cloneBallState(gameplay.ball.state),
    },
    blocking: {
      engagements: gameplay.blocking.engagements.map((engagement) => ({ ...engagement })),
    },
    currentBallSpot: cloneFootballSpot(gameplay.currentBallSpot),
    drive: snapshotDriveModel(gameplay.drive),
    lastPlayResult: clonePlayResult(gameplay.lastPlayResult),
    nextBallSpot: cloneFootballSpot(gameplay.nextBallSpot),
    passAttempted: gameplay.passAttempted,
    player: snapshotPlayerModel(gameplay.player),
    players: gameplay.players.map(snapshotPlayerModel),
    selectedPlay: {
      displayName: gameplay.selectedPlay.displayName,
      id: gameplay.selectedPlay.id,
      kind: gameplay.selectedPlay.kind,
      initialMovementDirection: { ...gameplay.selectedPlay.initialMovementDirection },
    },
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
    (player) => player.team === 'defense' && isTackleContact(player, gameplay.player),
  );

  if (
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id ||
    !canCarrierBeTackled(gameplay) ||
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

function canCarrierBeTackled(gameplay: GameplayModel): boolean {
  return !(
    gameplay.selectedPlay.kind === 'pass' &&
    gameplay.ball.state.kind === 'possessed' &&
    gameplay.player.role === 'quarterback'
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

function updatePassFlight(gameplay: GameplayModel, deltaSeconds: number): void {
  if (gameplay.ball.state.kind !== 'inFlight') {
    return;
  }

  updateInFlightBall(gameplay.ball, deltaSeconds);

  const receiver = getEligibleReceiver(gameplay);
  if (
    receiver &&
    gameplay.playState === 'live' &&
    isBallCatchableByPlayer(gameplay.ball, receiver)
  ) {
    completePass(gameplay, receiver);
    return;
  }

  if (
    isPassFlightFinished(gameplay.ball) ||
    isBallOutsidePlayableField(gameplay.ball.position)
  ) {
    recordIncompletePass(gameplay);
  }
}

function completePass(gameplay: GameplayModel, receiver: PlayerModel): void {
  gameplay.player.currentState = 'idle';
  gameplay.player.velocity.x = 0;
  gameplay.player.velocity.z = 0;
  gameplay.player = receiver;
  receiver.currentState = 'userControlled';
  receiver.velocity.x = 0;
  receiver.velocity.z = 0;
  giveBallToPlayer(gameplay.ball, receiver, 'caught');
}

function recordIncompletePass(gameplay: GameplayModel): void {
  const startingSpot = gameplay.activePlayStartSpot ?? gameplay.currentBallSpot;

  recordPlayResult(
    gameplay,
    'incomplete',
    startingSpot,
    startingSpot,
    GAMEPLAY_CONFIG.incompleteResetDelaySeconds,
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
  if (type === 'incomplete') {
    markBallIncomplete(gameplay.ball);
  } else {
    markBallDead(gameplay.ball);
  }
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

function calculatePassTarget(gameplay: GameplayModel, receiver: PlayerModel): Vector3 {
  const routeTarget = getReceiverRouteTarget(receiver, gameplay.currentBallSpot, gameplay.selectedPlay);
  const velocityLength = Math.hypot(receiver.velocity.x, receiver.velocity.z);
  let lead = { x: 0, z: 0 };

  if (velocityLength > 0) {
    lead = {
      x: receiver.velocity.x * PASSING_CONFIG.receiverLeadSeconds,
      z: receiver.velocity.z * PASSING_CONFIG.receiverLeadSeconds,
    };
  } else if (routeTarget) {
    const routeDeltaX = routeTarget.x - receiver.position.x;
    const routeDeltaZ = routeTarget.z - receiver.position.z;
    const routeLength = Math.hypot(routeDeltaX, routeDeltaZ);

    if (routeLength > 0) {
      lead = {
        x: (routeDeltaX / routeLength) * PASSING_CONFIG.receiverLeadDistance,
        z: (routeDeltaZ / routeLength) * PASSING_CONFIG.receiverLeadDistance,
      };
    }
  }

  return {
    x: receiver.position.x + lead.x,
    y: PASSING_CONFIG.targetHeight,
    z: receiver.position.z + lead.z,
  };
}

function getEligibleReceiver(gameplay: GameplayModel): PlayerModel | null {
  const receiverId = gameplay.selectedPlay.pass?.eligibleReceiverId;

  if (!receiverId) {
    return null;
  }

  return gameplay.players.find((player) => player.id === receiverId) ?? null;
}

function isBallOutsidePlayableField(position: Vector3): boolean {
  return (
    position.x < PLAYABLE_FIELD_BOUNDS.minX ||
    position.x > PLAYABLE_FIELD_BOUNDS.maxX ||
    position.z < PLAYABLE_FIELD_BOUNDS.minZ ||
    position.z > PLAYABLE_FIELD_BOUNDS.maxZ
  );
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

function getBallCarrier(players: PlayerModel[], play: PlayDefinition): PlayerModel {
  const carrier = players.find((player) => player.role === play.ballCarrierRole);

  if (!carrier) {
    throw new Error(`Missing ${play.ballCarrierRole} in ${play.displayName} formation`);
  }

  return carrier;
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

function cloneBallState(state: BallModel['state']): BallModel['state'] {
  if (state.kind === 'inFlight') {
    return {
      durationSeconds: state.durationSeconds,
      elapsedSeconds: state.elapsedSeconds,
      kind: 'inFlight',
      maxFlightTimeSeconds: state.maxFlightTimeSeconds,
      peakHeight: state.peakHeight,
      start: { ...state.start },
      target: { ...state.target },
    };
  }

  return { ...state };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
