import {
  PASSING_CONFIG,
  createBallModel,
  giveBallToPlayer,
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
import { resolveSnapPlacement, type SnapLane } from './ballSpotting';
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
  FORWARD_PASS_CONFIG,
  hasCrossedOriginalLineOfScrimmage,
} from './passRules';
import {
  createFormationPlayers,
  getAvailablePlays,
  getDefaultEligibleReceiverId,
  getDefaultPlayId,
  getPlay,
  getNextEligibleReceiverId,
  getReceiverDisplayName,
  hasReceiverRoute,
  isEligibleReceiverId,
  resetFormationPlayers,
  type PlayId,
  type PlayDefinition,
} from './playbook';
import {
  createReceiverRouteRuntimeMap,
  createReceiverRouteStateMap,
  getRouteDefinition,
  resolveReceiverRoute,
  type ReceiverRouteRuntimeMap,
  type ReceiverRouteState,
} from './receiverRoutes';
import {
  evaluateSweptCatch,
  solveRouteAwarePassTarget,
  type CatchEvaluationReason,
  type PassTargetSolution,
  type SweptCatchEvaluation,
} from './passTargeting';
import {
  snapshotPlayerModel,
  type PlayerModel,
  type PlayerSnapshot,
} from './playerModel';
import {
  findSackingDefender,
  hasQuarterbackCrossedLineOfScrimmage,
} from './sackRules';
import {
  canStartScoreAttackPlay,
  createScoreAttackModel,
  hasScoreAttackExpired,
  markScoreAttackGameOver,
  resetScoreAttack,
  snapshotScoreAttack,
  startScoreAttack,
  updateScoreAttackClock,
  type ScoreAttackModel,
  type ScoreAttackSnapshot,
} from './scoreAttackModel';
import {
  createBlockingState,
  resetBlockingState,
  updateRushingDrillAi,
  type BlockingEngagement,
  type BlockingState,
} from './teamSimulation';
import type { FramePerformanceProfiler } from './performance/FramePerformanceProfiler';
import type { PlaybookId } from './roster';

export type PlayState = 'preSnap' | 'live' | 'dead' | 'gameOver';
export type PlayResultType = 'tackle' | 'outOfBounds' | 'touchdown' | 'incomplete' | 'sack';
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

export interface PassAuditSnapshot {
  actualClosestApproach: {
    ball: Vector3;
    receiver: FootballSpot;
  } | null;
  ballHeightAtClosestApproach: number | null;
  horizontalMissDistance: number | null;
  predictedFlightSeconds: number;
  predictedReceiverPosition: FootballSpot;
  predictedReceiverRouteDistance: number;
  predictedTargetPosition: Vector3;
  releasePosition: Vector3;
  resultReason: CatchEvaluationReason | 'flightFinished' | 'inFlight' | 'outOfBounds';
  selectedReceiverId: string;
}

export const GAMEPLAY_CONFIG = {
  touchdownPoints: 6,
  touchdownResetDelaySeconds: 1.25,
  opposingGoalLineZ: OPPOSING_GOAL_LINE_Z,
  outOfBoundsResetDelaySeconds: 1.25,
  incompleteResetDelaySeconds: 1.25,
  sackResetDelaySeconds: 1.25,
  tackleResetDelaySeconds: 1.25,
  turnoverResetDelaySeconds: 1.25,
} as const;

export interface GameplayModel {
  activePlayStartSpot: FootballSpot | null;
  availablePlays: PlayDefinition[];
  ball: BallModel;
  blocking: BlockingState;
  challengeMode: 'exhibition' | 'scoreAttack';
  currentBallSpot: FootballSpot;
  drive: DriveModel;
  formationOrigin: FootballSpot;
  lastPlayResult: PlayResult | null;
  nextBallSpot: FootballSpot;
  nextSnapSpot: FootballSpot;
  nextPlayResultId: number;
  passFeedbackTimerSeconds: number;
  passAttempted: boolean;
  passAudit: PassAuditSnapshot | null;
  forwardPassEligible: boolean;
  player: PlayerModel;
  players: PlayerModel[];
  playbookId: PlaybookId;
  receiverRouteRuntime: ReceiverRouteRuntimeMap;
  receiverRouteStates: Record<string, ReceiverRouteState>;
  previousPlayerPositions: Record<string, FootballSpot>;
  selectedPlay: PlayDefinition;
  playState: PlayState;
  playResetTimerSeconds: number | null;
  score: number;
  scoreAttack: ScoreAttackModel;
  selectedReceiverId: string | null;
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
  exactDeadBallSpot: FootballSpot | null;
  formationOrigin: FootballSpot;
  lastPlayResult: PlayResult | null;
  nextBallSpot: FootballSpot;
  nextSnapSpot: FootballSpot;
  player: PlayerSnapshot;
  players: PlayerSnapshot[];
  playbookId: PlaybookId;
  receiverRouteStates: ReceiverRouteState[];
  selectedPlay: {
    displayName: string;
    id: PlayId;
    kind: PlayDefinition['kind'];
    initialMovementDirection: FootballSpot;
  };
  selectedReceiver: {
    displayName: string;
    id: string;
  } | null;
  playState: PlayState;
  score: number;
  scoreAttack: ScoreAttackSnapshot;
  snapLane: SnapLane;
  passAttempted: boolean;
  passAudit: PassAuditSnapshot | null;
  forwardPassEligible: boolean;
  passFeedback: 'pastLineOfScrimmage' | null;
}

export interface GameplayUpdateOptions {
  profiler?: FramePerformanceProfiler;
  suppressDeadPlayReset?: boolean;
}

export interface CreateGameplayModelOptions {
  challengeMode?: 'exhibition' | 'scoreAttack';
  playbookId?: PlaybookId;
}

export function createGameplayModel(options: CreateGameplayModelOptions = {}): GameplayModel {
  const playbookId = options.playbookId ?? '11v11';
  const challengeMode = options.challengeMode ?? 'scoreAttack';
  const availablePlays = getAvailablePlays(playbookId);
  const initialSpot = cloneFootballSpot(INITIAL_BALL_SPOT);
  const selectedPlay = getPlay(getDefaultPlayId(playbookId));
  const drive = createDriveModel(initialSpot);
  const initialSnapSpot = cloneFootballSpot(drive.lineOfScrimmage);
  const players = createFormationPlayers(initialSnapSpot, selectedPlay);
  const ballCarrier = getBallCarrier(players, selectedPlay);
  const receiverRouteRuntime = createReceiverRouteRuntimeForSpot(selectedPlay, initialSnapSpot);

  return {
    activePlayStartSpot: null,
    availablePlays,
    ball: createBallModel(initialSnapSpot),
    blocking: createBlockingState(),
    challengeMode,
    currentBallSpot: cloneFootballSpot(initialSnapSpot),
    drive,
    formationOrigin: cloneFootballSpot(initialSnapSpot),
    lastPlayResult: null,
    nextBallSpot: cloneFootballSpot(initialSnapSpot),
    nextSnapSpot: cloneFootballSpot(initialSnapSpot),
    nextPlayResultId: 1,
    passFeedbackTimerSeconds: 0,
    passAttempted: false,
    passAudit: null,
    forwardPassEligible: true,
    player: ballCarrier,
    players,
    playbookId,
    receiverRouteRuntime,
    receiverRouteStates: createReceiverRouteStateMap(selectedPlay),
    previousPlayerPositions: capturePlayerPositions(players),
    selectedPlay,
    playState: 'preSnap',
    playResetTimerSeconds: null,
    score: 0,
    scoreAttack: createScoreAttackModel(),
    selectedReceiverId: getDefaultEligibleReceiverId(selectedPlay),
  };
}

export function selectPlay(gameplay: GameplayModel, playId: string): boolean {
  if (gameplay.playState !== 'preSnap') {
    return false;
  }

  const play = getPlay(playId);
  if (!gameplay.availablePlays.some((availablePlay) => availablePlay.id === play.id)) {
    return false;
  }

  gameplay.selectedPlay = play;
  gameplay.passAttempted = false;
  gameplay.passAudit = null;
  gameplay.forwardPassEligible = true;
  gameplay.passFeedbackTimerSeconds = 0;
  gameplay.selectedReceiverId = getDefaultEligibleReceiverId(play);
  resetReceiverRoutesForSpot(gameplay, play, gameplay.currentBallSpot);
  resetBlockingState(gameplay.blocking);
  resetFormationAt(gameplay, gameplay.currentBallSpot, play);
  gameplay.player = getBallCarrier(gameplay.players, play);
  resetBallModel(gameplay.ball, gameplay.currentBallSpot);
  return true;
}

export function startPlay(gameplay: GameplayModel): boolean {
  if (
    gameplay.playState !== 'preSnap' ||
    gameplay.drive.state !== 'active' ||
    (gameplay.challengeMode === 'scoreAttack' && !canStartScoreAttackPlay(gameplay.scoreAttack))
  ) {
    return false;
  }

  if (gameplay.challengeMode === 'scoreAttack') {
    startScoreAttack(gameplay.scoreAttack);
  }
  gameplay.currentBallSpot = cloneFootballSpot(gameplay.drive.lineOfScrimmage);
  gameplay.activePlayStartSpot = cloneFootballSpot(gameplay.drive.lineOfScrimmage);
  gameplay.lastPlayResult = null;
  setNextSnapSpot(gameplay, gameplay.drive.lineOfScrimmage);
  gameplay.forwardPassEligible = true;
  gameplay.passAttempted = false;
  gameplay.passAudit = null;
  gameplay.passFeedbackTimerSeconds = 0;
  ensureSelectedReceiver(gameplay);
  gameplay.playResetTimerSeconds = null;
  gameplay.playState = 'live';
  resetBlockingState(gameplay.blocking);
  resetReceiverRoutesForSpot(gameplay, gameplay.selectedPlay, gameplay.currentBallSpot);
  gameplay.previousPlayerPositions = capturePlayerPositions(gameplay.players);
  gameplay.player = getBallCarrier(gameplay.players, gameplay.selectedPlay);
  for (const player of gameplay.players) {
    if (player.id === gameplay.player.id) {
      player.currentState = 'userControlled';
    } else if (player.role === 'blocker') {
      player.currentState = 'movingToLane';
    } else if (player.role === 'receiver' && hasReceiverRoute(player.id, gameplay.selectedPlay)) {
      player.currentState = 'runningRoute';
    } else if (player.team === 'defense') {
      player.currentState = 'pursuing';
    } else {
      player.currentState = 'idle';
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

  updateForwardPassEligibility(gameplay);

  if (!gameplay.forwardPassEligible) {
    gameplay.passFeedbackTimerSeconds = FORWARD_PASS_CONFIG.pastLineWarningSeconds;
    return false;
  }

  const receiver = getEligibleReceiver(gameplay);
  if (!receiver) {
    return false;
  }

  const solution = calculatePassTarget(gameplay, receiver);
  const thrown = throwBallToward(gameplay.ball, solution.target);

  if (!thrown) {
    return false;
  }

  gameplay.passAudit = createPassAuditSnapshot(receiver.id, gameplay.ball.previousPosition, solution);
  gameplay.passAttempted = true;
  gameplay.player.velocity.x = 0;
  gameplay.player.velocity.z = 0;
  gameplay.player.currentState = 'idle';
  return true;
}

export function cycleSelectedReceiver(gameplay: GameplayModel): boolean {
  if (
    gameplay.selectedPlay.kind !== 'pass' ||
    (gameplay.playState !== 'preSnap' && gameplay.playState !== 'live') ||
    gameplay.passAttempted ||
    gameplay.ball.state.kind === 'inFlight'
  ) {
    return false;
  }

  const nextReceiverId = getNextEligibleReceiverId(
    gameplay.selectedPlay,
    gameplay.selectedReceiverId,
  );

  if (!nextReceiverId || nextReceiverId === gameplay.selectedReceiverId) {
    return false;
  }

  gameplay.selectedReceiverId = nextReceiverId;
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
  if (gameplay.playState === 'gameOver') {
    return;
  }

  const shouldResetDrive = gameplay.drive.state === 'over';

  if (shouldResetDrive) {
    resetDriveModel(gameplay.drive);
  }

  const resetSpot = shouldResetDrive
    ? cloneFootballSpot(INITIAL_BALL_SPOT)
    : cloneFootballSpot(gameplay.nextSnapSpot);

  gameplay.activePlayStartSpot = null;
  gameplay.currentBallSpot = cloneFootballSpot(resetSpot);
  gameplay.lastPlayResult = null;
  setNextSnapSpot(gameplay, resetSpot);
  gameplay.forwardPassEligible = true;
  gameplay.passAttempted = false;
  gameplay.passAudit = null;
  gameplay.passFeedbackTimerSeconds = 0;
  gameplay.selectedReceiverId = getDefaultEligibleReceiverId(gameplay.selectedPlay);
  resetReceiverRoutesForSpot(gameplay, gameplay.selectedPlay, resetSpot);
  gameplay.previousPlayerPositions = {};
  gameplay.playState = 'preSnap';
  gameplay.playResetTimerSeconds = null;
  resetBlockingState(gameplay.blocking);
  resetFormationAt(gameplay, resetSpot, gameplay.selectedPlay);
  gameplay.player = getBallCarrier(gameplay.players, gameplay.selectedPlay);
  resetBallModel(gameplay.ball, resetSpot);
}

export function restartScoreAttack(gameplay: GameplayModel): boolean {
  if (gameplay.playState !== 'gameOver') {
    return false;
  }

  const initialSpot = cloneFootballSpot(INITIAL_BALL_SPOT);
  const defaultPlay = getPlay(getDefaultPlayId(gameplay.playbookId));

  resetScoreAttack(gameplay.scoreAttack);
  resetDriveModel(gameplay.drive, initialSpot);
  gameplay.score = 0;
  gameplay.selectedPlay = defaultPlay;
  gameplay.activePlayStartSpot = null;
  gameplay.currentBallSpot = cloneFootballSpot(initialSpot);
  gameplay.lastPlayResult = null;
  setNextSnapSpot(gameplay, initialSpot);
  gameplay.nextPlayResultId = 1;
  gameplay.forwardPassEligible = true;
  gameplay.passAttempted = false;
  gameplay.passAudit = null;
  gameplay.passFeedbackTimerSeconds = 0;
  gameplay.selectedReceiverId = getDefaultEligibleReceiverId(defaultPlay);
  resetReceiverRoutesForSpot(gameplay, defaultPlay, initialSpot);
  gameplay.previousPlayerPositions = {};
  gameplay.playState = 'preSnap';
  gameplay.playResetTimerSeconds = null;
  resetBlockingState(gameplay.blocking);
  resetFormationAt(gameplay, initialSpot, defaultPlay);
  gameplay.player = getBallCarrier(gameplay.players, defaultPlay);
  resetBallModel(gameplay.ball, initialSpot);
  return true;
}

export function resetOffensePossession(
  gameplay: GameplayModel,
  startingSpot: FootballSpot = INITIAL_BALL_SPOT,
): void {
  const resetSpot = cloneFootballSpot(startingSpot);
  const defaultPlay = getPlay(getDefaultPlayId(gameplay.playbookId));

  resetDriveModel(gameplay.drive, resetSpot);
  gameplay.selectedPlay = defaultPlay;
  gameplay.activePlayStartSpot = null;
  gameplay.currentBallSpot = cloneFootballSpot(resetSpot);
  gameplay.lastPlayResult = null;
  setNextSnapSpot(gameplay, resetSpot);
  gameplay.forwardPassEligible = true;
  gameplay.passAttempted = false;
  gameplay.passAudit = null;
  gameplay.passFeedbackTimerSeconds = 0;
  gameplay.selectedReceiverId = getDefaultEligibleReceiverId(defaultPlay);
  resetReceiverRoutesForSpot(gameplay, defaultPlay, resetSpot);
  gameplay.previousPlayerPositions = {};
  gameplay.playState = 'preSnap';
  gameplay.playResetTimerSeconds = null;
  resetBlockingState(gameplay.blocking);
  resetFormationAt(gameplay, resetSpot, defaultPlay);
  gameplay.player = getBallCarrier(gameplay.players, defaultPlay);
  resetBallModel(gameplay.ball, resetSpot);
}

export function updateGameplayModel(
  gameplay: GameplayModel,
  deltaSeconds = 0,
  options: GameplayUpdateOptions = {},
): void {
  const delta = Math.max(0, deltaSeconds);
  gameplay.previousPlayerPositions = capturePlayerPositions(gameplay.players);

  if (gameplay.challengeMode === 'scoreAttack') {
    updateScoreAttackClock(gameplay.scoreAttack, delta);
  }
  updatePassFeedback(gameplay, delta);

  if (gameplay.playState === 'live') {
    updateForwardPassEligibility(gameplay);
    detectSack(gameplay);

    if (gameplay.playState === 'live') {
      detectTackle(gameplay);
    }

    if (gameplay.playState === 'live') {
      updateRushingDrillAi(gameplay.players, gameplay.blocking, gameplay.player, {
        bounds: PLAYABLE_FIELD_BOUNDS,
        deltaSeconds: delta,
        lineOfScrimmage: gameplay.currentBallSpot,
        play: gameplay.selectedPlay,
        profiler: options.profiler,
        receiverRouteRuntime: gameplay.receiverRouteRuntime,
        receiverRouteStates: gameplay.receiverRouteStates,
      });
      updateForwardPassEligibility(gameplay);
      if (options.profiler?.enabled) {
        options.profiler.measure('passTargetingAndBallSimulation', () => {
          updatePassFlight(gameplay, delta, gameplay.previousPlayerPositions);
        });
      } else {
        updatePassFlight(gameplay, delta, gameplay.previousPlayerPositions);
      }
      detectSack(gameplay);
      if (gameplay.playState === 'live') {
        detectTackle(gameplay);
      }
    }

    if (gameplay.playState === 'live') {
      detectTouchdown(gameplay);
    }

    if (gameplay.playState === 'live') {
      detectOutOfBounds(gameplay);
    }
  } else if (gameplay.playResetTimerSeconds !== null && !options.suppressDeadPlayReset) {
    gameplay.playResetTimerSeconds -= delta;

    if (gameplay.playResetTimerSeconds <= 0) {
      if (
        gameplay.challengeMode === 'scoreAttack' &&
        hasScoreAttackExpired(gameplay.scoreAttack)
      ) {
        enterScoreAttackGameOver(gameplay);
      } else {
        resetPlay(gameplay);
      }
    }
  }

  if (
    gameplay.challengeMode === 'scoreAttack' &&
    gameplay.playState === 'preSnap' &&
    hasScoreAttackExpired(gameplay.scoreAttack)
  ) {
    enterScoreAttackGameOver(gameplay);
  }

  if (
    gameplay.challengeMode === 'scoreAttack' &&
    gameplay.playState === 'dead' &&
    gameplay.playResetTimerSeconds === null &&
    hasScoreAttackExpired(gameplay.scoreAttack)
  ) {
    enterScoreAttackGameOver(gameplay);
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
    exactDeadBallSpot: gameplay.lastPlayResult
      ? cloneFootballSpot(gameplay.lastPlayResult.endingBallSpot)
      : null,
    formationOrigin: cloneFootballSpot(gameplay.formationOrigin),
    lastPlayResult: clonePlayResult(gameplay.lastPlayResult),
    nextBallSpot: cloneFootballSpot(gameplay.nextBallSpot),
    nextSnapSpot: cloneFootballSpot(gameplay.nextSnapSpot),
    passFeedback: gameplay.passFeedbackTimerSeconds > 0 ? 'pastLineOfScrimmage' : null,
    forwardPassEligible: gameplay.forwardPassEligible,
    passAttempted: gameplay.passAttempted,
    passAudit: clonePassAuditSnapshot(gameplay.passAudit),
    player: snapshotPlayerModel(gameplay.player),
    players: gameplay.players.map(snapshotPlayerModel),
    playbookId: gameplay.playbookId,
    receiverRouteStates: Object.values(gameplay.receiverRouteStates).map((routeState) => ({
      ...routeState,
    })),
    selectedPlay: {
      displayName: gameplay.selectedPlay.displayName,
      id: gameplay.selectedPlay.id,
      kind: gameplay.selectedPlay.kind,
      initialMovementDirection: { ...gameplay.selectedPlay.initialMovementDirection },
    },
    selectedReceiver: snapshotSelectedReceiver(gameplay),
    playState: gameplay.playState,
    score: gameplay.score,
    scoreAttack: snapshotScoreAttack(gameplay.scoreAttack),
    snapLane: gameplay.drive.snapLane,
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
    GAMEPLAY_CONFIG.touchdownResetDelaySeconds,
    'offense',
  );
}

function updateForwardPassEligibility(gameplay: GameplayModel): void {
  if (
    !gameplay.forwardPassEligible ||
    gameplay.playState !== 'live' ||
    gameplay.selectedPlay.kind !== 'pass' ||
    gameplay.player.role !== 'quarterback'
  ) {
    return;
  }

  const lineOfScrimmage = gameplay.activePlayStartSpot ?? gameplay.currentBallSpot;

  if (hasCrossedOriginalLineOfScrimmage(gameplay.player, lineOfScrimmage)) {
    gameplay.forwardPassEligible = false;
  }
}

function updatePassFeedback(gameplay: GameplayModel, deltaSeconds: number): void {
  if (gameplay.passFeedbackTimerSeconds <= 0) {
    return;
  }

  gameplay.passFeedbackTimerSeconds = Math.max(
    0,
    gameplay.passFeedbackTimerSeconds - Math.max(0, deltaSeconds),
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
    GAMEPLAY_CONFIG.tackleResetDelaySeconds,
    null,
  );
}

function detectSack(gameplay: GameplayModel): void {
  const lineOfScrimmage = gameplay.activePlayStartSpot ?? gameplay.currentBallSpot;
  const sacker = findSackingDefender(gameplay.players, {
    ball: gameplay.ball,
    lineOfScrimmage,
    passAttempted: gameplay.passAttempted,
    play: gameplay.selectedPlay,
    playState: gameplay.playState,
    quarterback: gameplay.player,
  });

  if (!sacker) {
    return;
  }

  const endingSpot = getCarrierBallSpot(gameplay.player);

  recordPlayResult(
    gameplay,
    'sack',
    endingSpot,
    GAMEPLAY_CONFIG.sackResetDelaySeconds,
    null,
  );
}

function canCarrierBeTackled(gameplay: GameplayModel): boolean {
  if (!(
    gameplay.selectedPlay.kind === 'pass' &&
    gameplay.ball.state.kind === 'possessed' &&
    gameplay.player.role === 'quarterback' &&
    !gameplay.passAttempted
  )) {
    return true;
  }

  const lineOfScrimmage = gameplay.activePlayStartSpot ?? gameplay.currentBallSpot;

  return hasQuarterbackCrossedLineOfScrimmage(gameplay.player, lineOfScrimmage);
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
    GAMEPLAY_CONFIG.outOfBoundsResetDelaySeconds,
    null,
  );
}

function updatePassFlight(
  gameplay: GameplayModel,
  deltaSeconds: number,
  previousPlayerPositions: Record<string, FootballSpot>,
): void {
  if (gameplay.ball.state.kind !== 'inFlight') {
    return;
  }

  updateInFlightBall(gameplay.ball, deltaSeconds);

  const receiver = getEligibleReceiver(gameplay);
  if (receiver && gameplay.playState === 'live') {
    const catchEvaluation = evaluateSweptCatch(
      gameplay.ball.previousPosition,
      gameplay.ball.position,
      previousPlayerPositions[receiver.id] ?? receiver.position,
      receiver.position,
      PASSING_CONFIG,
    );
    updatePassAuditFromCatchEvaluation(gameplay, catchEvaluation);

    if (catchEvaluation.catchable) {
      completePass(gameplay, receiver);
      return;
    }
  }

  const outsideField = isBallOutsidePlayableField(gameplay.ball.position);
  if (isPassFlightFinished(gameplay.ball) || outsideField) {
    updatePassAuditResultReason(gameplay, outsideField ? 'outOfBounds' : 'flightFinished');
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
    GAMEPLAY_CONFIG.incompleteResetDelaySeconds,
    null,
  );
}

function recordPlayResult(
  gameplay: GameplayModel,
  type: PlayResultType,
  endingSpot: FootballSpot,
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

  const driveUpdate = applyPlayResultToDrive(gameplay.drive, playResult);
  setNextSnapSpot(gameplay, driveUpdate.nextSnapSpot);
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

function enterScoreAttackGameOver(gameplay: GameplayModel): void {
  markScoreAttackGameOver(gameplay.scoreAttack, gameplay.score);
  gameplay.activePlayStartSpot = null;
  gameplay.playResetTimerSeconds = null;
  gameplay.playState = 'gameOver';
  stopLiveActors(gameplay);
  markBallDead(gameplay.ball);
}

function calculatePassTarget(gameplay: GameplayModel, receiver: PlayerModel): PassTargetSolution {
  const routeRuntime = gameplay.receiverRouteRuntime[receiver.id];
  const routeDefinition = routeRuntime?.definition ?? getRouteDefinition(gameplay.selectedPlay, receiver.id);
  const route = routeRuntime?.route ??
    resolveReceiverRoute(
      gameplay.selectedPlay,
      receiver.id,
      resolveSnapPlacement(gameplay.currentBallSpot),
    );

  return solveRouteAwarePassTarget({
    ballStart: gameplay.ball.position,
    config: {
      ...PASSING_CONFIG,
      iterations: PASSING_CONFIG.targetingIterations,
      playableBounds: PLAYABLE_FIELD_BOUNDS,
    },
    receiverPosition: receiver.position,
    route,
    routeSpeedYardsPerSecond: routeDefinition?.speedYardsPerSecond ?? 0,
    routeState: gameplay.receiverRouteStates[receiver.id] ?? null,
  });
}

function createPassAuditSnapshot(
  selectedReceiverId: string,
  releasePosition: Vector3,
  solution: PassTargetSolution,
): PassAuditSnapshot {
  return {
    actualClosestApproach: null,
    ballHeightAtClosestApproach: null,
    horizontalMissDistance: null,
    predictedFlightSeconds: solution.predictedFlightSeconds,
    predictedReceiverPosition: { ...solution.predictedReceiverPosition },
    predictedReceiverRouteDistance: solution.predictedReceiverRouteDistance,
    predictedTargetPosition: { ...solution.target },
    releasePosition: { ...releasePosition },
    resultReason: 'inFlight',
    selectedReceiverId,
  };
}

function updatePassAuditFromCatchEvaluation(
  gameplay: GameplayModel,
  evaluation: SweptCatchEvaluation,
): void {
  if (!gameplay.passAudit) {
    return;
  }

  gameplay.passAudit = {
    ...gameplay.passAudit,
    actualClosestApproach: {
      ball: { ...evaluation.closestBallPosition },
      receiver: { ...evaluation.closestReceiverPosition },
    },
    ballHeightAtClosestApproach: evaluation.ballHeightAtClosestApproach,
    horizontalMissDistance: evaluation.horizontalMissDistance,
    resultReason: evaluation.reason,
  };
}

function updatePassAuditResultReason(
  gameplay: GameplayModel,
  reason: PassAuditSnapshot['resultReason'],
): void {
  if (!gameplay.passAudit) {
    return;
  }

  gameplay.passAudit = {
    ...gameplay.passAudit,
    resultReason: reason,
  };
}

function getEligibleReceiver(gameplay: GameplayModel): PlayerModel | null {
  ensureSelectedReceiver(gameplay);
  const receiverId = gameplay.selectedReceiverId;

  if (!receiverId) {
    return null;
  }

  return gameplay.players.find((player) => player.id === receiverId) ?? null;
}

function ensureSelectedReceiver(gameplay: GameplayModel): void {
  if (isEligibleReceiverId(gameplay.selectedPlay, gameplay.selectedReceiverId)) {
    return;
  }

  gameplay.selectedReceiverId = getDefaultEligibleReceiverId(gameplay.selectedPlay);
}

function snapshotSelectedReceiver(
  gameplay: GameplayModel,
): GameplaySnapshot['selectedReceiver'] {
  if (!gameplay.selectedReceiverId) {
    return null;
  }

  if (!isEligibleReceiverId(gameplay.selectedPlay, gameplay.selectedReceiverId)) {
    return null;
  }

  return {
    displayName: getReceiverDisplayName(gameplay.selectedPlay, gameplay.selectedReceiverId),
    id: gameplay.selectedReceiverId,
  };
}

function isBallOutsidePlayableField(position: Vector3): boolean {
  return (
    position.x < PLAYABLE_FIELD_BOUNDS.minX ||
    position.x > PLAYABLE_FIELD_BOUNDS.maxX ||
    position.z < PLAYABLE_FIELD_BOUNDS.minZ ||
    position.z > PLAYABLE_FIELD_BOUNDS.maxZ
  );
}

function capturePlayerPositions(players: PlayerModel[]): Record<string, FootballSpot> {
  return Object.fromEntries(
    players.map((player) => [
      player.id,
      { ...player.position },
    ]),
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

function setNextSnapSpot(gameplay: GameplayModel, spot: FootballSpot): void {
  const nextSnapSpot = cloneFootballSpot(spot);

  gameplay.nextSnapSpot = nextSnapSpot;
  gameplay.nextBallSpot = cloneFootballSpot(nextSnapSpot);
}

function resetFormationAt(
  gameplay: GameplayModel,
  snapSpot: FootballSpot,
  play: PlayDefinition,
): void {
  gameplay.formationOrigin = cloneFootballSpot(snapSpot);
  resetFormationPlayers(gameplay.players, snapSpot, play);
}

function resetReceiverRoutesForSpot(
  gameplay: GameplayModel,
  play: PlayDefinition,
  snapSpot: FootballSpot,
): void {
  gameplay.receiverRouteRuntime = createReceiverRouteRuntimeForSpot(play, snapSpot);
  gameplay.receiverRouteStates = createReceiverRouteStateMap(play);
}

function createReceiverRouteRuntimeForSpot(
  play: PlayDefinition,
  snapSpot: FootballSpot,
): ReceiverRouteRuntimeMap {
  return createReceiverRouteRuntimeMap(play, resolveSnapPlacement(snapSpot));
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

function clonePassAuditSnapshot(passAudit: PassAuditSnapshot | null): PassAuditSnapshot | null {
  if (!passAudit) {
    return null;
  }

  return {
    ...passAudit,
    actualClosestApproach: passAudit.actualClosestApproach
      ? {
          ball: { ...passAudit.actualClosestApproach.ball },
          receiver: { ...passAudit.actualClosestApproach.receiver },
        }
      : null,
    predictedReceiverPosition: { ...passAudit.predictedReceiverPosition },
    predictedTargetPosition: { ...passAudit.predictedTargetPosition },
    releasePosition: { ...passAudit.releasePosition },
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
