import { BALL_CARRY_ATTACHMENT } from '../ballModel';
import { PLAYABLE_FIELD_BOUNDS, type FieldBounds } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import {
  createFreeKickTouchbackPosition,
  possessionFieldPositionToWorldSpot,
  worldSpotToPossessionFieldPosition,
  type PossessionFieldPosition,
} from '../match/FieldPositionModel';
import type { MatchPossession } from '../match/MatchTypes';
import type { PlayerRole, Vector2 } from '../playerModel';
import { DEFENDER_CONFIG } from '../defenderModel';
import type {
  KickoffFormationLayout,
  KickoffFormationParticipantPlacement,
} from './KickoffFormation';
import {
  sampleKickoffBallPosition,
} from './KickoffSimulation';
import type {
  KickoffDirection,
  KickoffResult,
  KickoffState,
} from './KickoffTypes';

export type KickoffReturnPhase =
  | 'ready'
  | 'runUp'
  | 'flight'
  | 'fielding'
  | 'returnLive'
  | 'touchback'
  | 'dead'
  | 'complete';

export type KickoffReturnOutcomeType = 'outOfBounds' | 'tackle' | 'touchback' | 'touchdown';
export type KickoffReturnLane = 'left' | 'middle' | 'right';

export interface KickoffReturnParticipantState {
  assignedBlockTargetVisualId: string | null;
  facingRadians: number;
  phase: KickoffFormationParticipantPlacement['phase'];
  position: FootballSpot;
  role: PlayerRole;
  rosterPlayerId: string;
  slotId: KickoffFormationParticipantPlacement['slotId'];
  team: MatchPossession;
  velocity: Vector2;
  visualId: string;
}

export interface KickReturnerCandidate {
  position: FootballSpot;
  rosterPlayerId: string;
  slotId?: string;
  visualId: string;
}

export interface KickReturnerAssignment {
  estimatedArrivalSeconds: number;
  estimatedSpareSeconds: number;
  landingSpot: FootballSpot;
  landingTimeSeconds: number;
  returnerRosterId: string;
  returnerVisualId: string;
}

export interface KickoffReturnBlockAssignment {
  blockerVisualId: string;
  coverageVisualId: string;
}

export interface KickoffReturnOutcome {
  carrierRosterId: string | null;
  carrierVisualId: string | null;
  clockElapsedSeconds: number;
  deadBallSpot: FootballSpot;
  receivingTeam: MatchPossession;
  receivingStartPosition: PossessionFieldPosition;
  scoringTeam: MatchPossession | null;
  type: KickoffReturnOutcomeType;
}

export interface KickoffReturnState {
  assignedReturner: KickReturnerAssignment | null;
  ballPosition: { x: number; y: number; z: number };
  blockerAssignments: KickoffReturnBlockAssignment[];
  carrierVisualId: string | null;
  clockRunning: boolean;
  clockStarted: boolean;
  clockStartReason: 'legalTouch' | null;
  completed: boolean;
  contactSoundPlayed: boolean;
  catchSoundPlayed: boolean;
  deadElapsedSeconds: number;
  direction: KickoffDirection;
  fieldBounds: FieldBounds;
  flightElapsedSeconds: number;
  landingSpot: FootballSpot;
  nonAssignedReturnerVisualId: string | null;
  outcome: KickoffReturnOutcome | null;
  participants: KickoffReturnParticipantState[];
  phase: KickoffReturnPhase;
  receivingTeam: MatchPossession;
  result: KickoffResult;
  returnClockElapsedSeconds: number;
  returnLane: KickoffReturnLane;
  runUpElapsedSeconds: number;
}

export interface KickoffReturnUpdateInput {
  deltaSeconds: number;
  userInput?: Vector2;
}

export interface KickoffReturnUpdateEvents {
  catch: boolean;
  clockStarted: boolean;
  contact: boolean;
  dead: boolean;
  touchback: boolean;
}

export const KICKOFF_RETURN_CONFIG = {
  catchHeightYards: 2.35,
  catchRadiusYards: 2.25,
  coverageSpeedYardsPerSecond: 13.2,
  deadHoldSeconds: 1.15,
  engagedSpeedMultiplier: 0.22,
  fieldEdgeInsetYards: 0.15,
  kickerContactDistanceYards: 0.18,
  kickerRunUpSpeedYardsPerSecond: 6.5,
  leadBlockOffsetX: 4.5,
  leadBlockOffsetZ: 6,
  maxDeltaSeconds: 1 / 15,
  minimumForcedCatchDistanceYards: 3.4,
  pursuitTackleRadiusYards: DEFENDER_CONFIG.tackleRadius,
  receivingBlockerEngageDistanceYards: 5.25,
  receivingBlockerProtectCarrierDistanceYards: 8.5,
  receivingBlockerSpeedYardsPerSecond: 9.5,
  returnerCatchClearanceYards: 2.85,
  returnEscortFrontDepthYards: 8,
  returnEscortSecondDepthYards: 5.5,
  returnEscortWidthYards: 4.25,
  returnerAiSpeedYardsPerSecond: 12,
  returnerTrackingSpeedYardsPerSecond: 11.8,
} as const;

export function createKickoffReturnState(options: {
  kickoff: KickoffState;
  layout: KickoffFormationLayout;
  matchSeed: number | string;
}): KickoffReturnState {
  if (!options.kickoff.result || !options.kickoff.receivingTeam) {
    throw new Error('Cannot create kickoff return state without kickoff result and receiving team');
  }

  const participants = options.layout.participants.map(createParticipantState);
  const result = options.kickoff.result;
  const returnLane = resolveReturnLane(options.matchSeed, options.kickoff.sequenceIndex);

  return {
    assignedReturner: null,
    ballPosition: {
      x: result.origin.x,
      y: BALL_CARRY_ATTACHMENT.y,
      z: result.origin.z,
    },
    blockerAssignments: [],
    carrierVisualId: null,
    clockRunning: false,
    clockStarted: false,
    clockStartReason: null,
    completed: false,
    contactSoundPlayed: false,
    catchSoundPlayed: false,
    deadElapsedSeconds: 0,
    direction: options.kickoff.direction,
    fieldBounds: PLAYABLE_FIELD_BOUNDS,
    flightElapsedSeconds: 0,
    landingSpot: { ...result.target },
    nonAssignedReturnerVisualId: null,
    outcome: null,
    participants,
    phase: 'ready',
    receivingTeam: options.kickoff.receivingTeam,
    result: cloneKickoffResult(result),
    returnClockElapsedSeconds: 0,
    returnLane,
    runUpElapsedSeconds: 0,
  };
}

export function startKickoffRunUp(state: KickoffReturnState): void {
  if (state.phase === 'ready') {
    state.phase = 'runUp';
  }
}

export function updateKickoffReturnState(
  state: KickoffReturnState,
  input: KickoffReturnUpdateInput,
): KickoffReturnUpdateEvents {
  const delta = clamp(input.deltaSeconds, 0, KICKOFF_RETURN_CONFIG.maxDeltaSeconds);
  const events: KickoffReturnUpdateEvents = {
    catch: false,
    clockStarted: false,
    contact: false,
    dead: false,
    touchback: false,
  };

  if (state.phase === 'runUp') {
    updateKickerRunUp(state, delta, events);
  } else if (state.phase === 'flight') {
    updateKickoffFlight(state, delta, events);
  } else if (state.phase === 'fielding') {
    enterReturnLive(state, events);
  } else if (state.phase === 'returnLive') {
    updateKickoffReturnLive(state, delta, input.userInput ?? { x: 0, z: 0 }, events);
  } else if (state.phase === 'touchback' || state.phase === 'dead') {
    state.deadElapsedSeconds += delta;
    if (state.deadElapsedSeconds >= KICKOFF_RETURN_CONFIG.deadHoldSeconds) {
      state.phase = 'complete';
      state.completed = true;
    }
  }

  return events;
}

export function resolveAssignedKickReturner(
  returners: readonly KickReturnerCandidate[],
  predictedLandingSpot: FootballSpot,
  predictedLandingTime: number,
  returnerMovementSpeed = KICKOFF_RETURN_CONFIG.returnerTrackingSpeedYardsPerSecond,
): KickReturnerAssignment | null {
  let selected: KickReturnerAssignment | null = null;

  for (const returner of returners) {
    const distance = distanceBetween(returner.position, predictedLandingSpot);
    const estimatedArrivalSeconds = distance / Math.max(0.001, returnerMovementSpeed);
    const candidate: KickReturnerAssignment = {
      estimatedArrivalSeconds,
      estimatedSpareSeconds: predictedLandingTime - estimatedArrivalSeconds,
      landingSpot: { ...predictedLandingSpot },
      landingTimeSeconds: predictedLandingTime,
      returnerRosterId: returner.rosterPlayerId,
      returnerVisualId: returner.visualId,
    };

    if (
      !selected ||
      candidate.estimatedArrivalSeconds < selected.estimatedArrivalSeconds - 0.000001 ||
      (
        Math.abs(candidate.estimatedArrivalSeconds - selected.estimatedArrivalSeconds) <= 0.000001 &&
        candidate.returnerRosterId < selected.returnerRosterId
      )
    ) {
      selected = candidate;
    }
  }

  return selected;
}

function updateKickerRunUp(
  state: KickoffReturnState,
  delta: number,
  events: KickoffReturnUpdateEvents,
): void {
  const kicker = state.participants.find((participant) => participant.slotId === 'kicker');
  if (!kicker) {
    releaseKick(state, events);
    return;
  }

  state.runUpElapsedSeconds += delta;
  moveParticipantToward(
    kicker,
    state.result.origin,
    KICKOFF_RETURN_CONFIG.kickerRunUpSpeedYardsPerSecond,
    delta,
  );
  if (
    distanceBetween(kicker.position, state.result.origin) <=
    KICKOFF_RETURN_CONFIG.kickerContactDistanceYards
  ) {
    releaseKick(state, events);
  }
}

function releaseKick(
  state: KickoffReturnState,
  events: KickoffReturnUpdateEvents,
): void {
  if (state.contactSoundPlayed) {
    return;
  }

  state.phase = 'flight';
  state.contactSoundPlayed = true;
  state.assignedReturner = resolveAssignedKickReturner(
    getReturnerCandidates(state),
    state.result.target,
    state.result.flightSeconds,
  );
  state.nonAssignedReturnerVisualId = resolveNonAssignedReturnerVisualId(state);
  state.blockerAssignments = createKickoffReturnBlockAssignments(state);
  events.contact = true;
}

function updateKickoffFlight(
  state: KickoffReturnState,
  delta: number,
  events: KickoffReturnUpdateEvents,
): void {
  state.flightElapsedSeconds = Math.min(
    state.result.flightSeconds,
    state.flightElapsedSeconds + delta,
  );
  state.ballPosition = sampleKickoffBallPosition(state.result, state.flightElapsedSeconds);
  updateReleasedKickoffParticipants(state, delta, null);

  if (state.result.landingType === 'touchback' && state.flightElapsedSeconds >= state.result.flightSeconds) {
    const touchbackPosition = createFreeKickTouchbackPosition();
    const touchbackSpot = possessionFieldPositionToWorldSpot(touchbackPosition, state.receivingTeam);
    completeKickoffReturn(state, {
      carrierRosterId: null,
      carrierVisualId: null,
      clockElapsedSeconds: state.returnClockElapsedSeconds,
      deadBallSpot: { ...touchbackSpot },
      receivingStartPosition: { ...touchbackPosition },
      scoringTeam: null,
      type: 'touchback',
    });
    state.phase = 'touchback';
    events.touchback = true;
    events.dead = true;
    return;
  }

  const returner = state.assignedReturner
    ? findParticipant(state, state.assignedReturner.returnerVisualId)
    : null;
  if (!returner) {
    return;
  }

  const catchDistance = distanceBetween(returner.position, state.result.target);
  const catchableHeight = state.ballPosition.y <= KICKOFF_RETURN_CONFIG.catchHeightYards;
  const flightFinished = state.flightElapsedSeconds >= state.result.flightSeconds;
  if (
    (catchableHeight && catchDistance <= KICKOFF_RETURN_CONFIG.catchRadiusYards) ||
    (flightFinished && catchDistance <= KICKOFF_RETURN_CONFIG.minimumForcedCatchDistanceYards)
  ) {
    state.carrierVisualId = returner.visualId;
    returner.position = {
      x: state.ballPosition.x,
      z: state.ballPosition.z,
    };
    returner.velocity = { x: 0, z: 0 };
    returner.role = 'runner';
    state.catchSoundPlayed = true;
    state.phase = 'fielding';
    events.catch = true;
  }
}

function enterReturnLive(
  state: KickoffReturnState,
  events: KickoffReturnUpdateEvents,
): void {
  if (!state.carrierVisualId) {
    return;
  }

  const carrier = findParticipant(state, state.carrierVisualId);
  if (!carrier) {
    return;
  }

  startClock(state, events);
  state.phase = 'returnLive';
  syncBallToCarrier(state, carrier);
}

function updateKickoffReturnLive(
  state: KickoffReturnState,
  delta: number,
  userInput: Vector2,
  events: KickoffReturnUpdateEvents,
): void {
  const carrier = state.carrierVisualId ? findParticipant(state, state.carrierVisualId) : null;
  if (!carrier) {
    return;
  }

  state.returnClockElapsedSeconds += delta;
  updateCarrier(state, carrier, userInput, delta);
  updateReleasedKickoffParticipants(state, delta, carrier);
  syncBallToCarrier(state, carrier);

  const touchdownSpot = resolveReturnTouchdownSpot(state);
  if (touchdownSpot) {
    completeKickoffReturn(state, {
      carrierRosterId: carrier.rosterPlayerId,
      carrierVisualId: carrier.visualId,
      clockElapsedSeconds: state.returnClockElapsedSeconds,
      deadBallSpot: touchdownSpot,
      receivingStartPosition: worldSpotToPossessionFieldPosition(touchdownSpot, state.receivingTeam),
      scoringTeam: state.receivingTeam,
      type: 'touchdown',
    });
    events.dead = true;
    return;
  }

  const outOfBoundsSpot = resolveOutOfBoundsSpot(carrier);
  if (outOfBoundsSpot) {
    completeKickoffReturn(state, {
      carrierRosterId: carrier.rosterPlayerId,
      carrierVisualId: carrier.visualId,
      clockElapsedSeconds: state.returnClockElapsedSeconds,
      deadBallSpot: outOfBoundsSpot,
      receivingStartPosition: worldSpotToPossessionFieldPosition(outOfBoundsSpot, state.receivingTeam),
      scoringTeam: null,
      type: 'outOfBounds',
    });
    events.dead = true;
    return;
  }

  const tackler = state.participants.find((participant) =>
    participant.phase === 'kicking' &&
    participant.slotId !== 'kicker' &&
    distanceBetween(participant.position, carrier.position) <=
      KICKOFF_RETURN_CONFIG.pursuitTackleRadiusYards);
  if (tackler) {
    completeKickoffReturn(state, {
      carrierRosterId: carrier.rosterPlayerId,
      carrierVisualId: carrier.visualId,
      clockElapsedSeconds: state.returnClockElapsedSeconds,
      deadBallSpot: { ...carrier.position },
      receivingStartPosition: worldSpotToPossessionFieldPosition(carrier.position, state.receivingTeam),
      scoringTeam: null,
      type: 'tackle',
    });
    events.dead = true;
  }
}

function updateCarrier(
  state: KickoffReturnState,
  carrier: KickoffReturnParticipantState,
  _userInput: Vector2,
  delta: number,
): void {
  const receivingDirection = invertDirection(state.direction);
  const input = resolveAiReturnInput(state, carrier, receivingDirection);
  const speed = KICKOFF_RETURN_CONFIG.returnerAiSpeedYardsPerSecond;

  carrier.velocity = {
    x: input.x * speed,
    z: input.z * speed,
  };
  if (input.x !== 0 || input.z !== 0) {
    carrier.facingRadians = Math.atan2(input.x, input.z);
  }
  carrier.position.x += carrier.velocity.x * delta;
  carrier.position.z += carrier.velocity.z * delta;
  carrier.position.z = clamp(
    carrier.position.z,
    state.fieldBounds.minZ,
    state.fieldBounds.maxZ,
  );
}

function updateReleasedKickoffParticipants(
  state: KickoffReturnState,
  delta: number,
  carrier: KickoffReturnParticipantState | null,
): void {
  for (const participant of state.participants) {
    if (participant.slotId === 'kicker' || participant.visualId === state.carrierVisualId) {
      continue;
    }

    const blockTargetId = participant.assignedBlockTargetVisualId;
    if (participant.phase === 'receiving') {
      const target = resolveReceivingBlockerTarget(state, participant, carrier, blockTargetId);
      moveParticipantToward(
        participant,
        target,
        KICKOFF_RETURN_CONFIG.receivingBlockerSpeedYardsPerSecond,
        delta,
      );
      continue;
    }

    const isEngaged = isCoverageEngaged(state, participant.visualId);
    const target = carrier?.position ?? state.result.target;
    moveParticipantToward(
      participant,
      target,
      KICKOFF_RETURN_CONFIG.coverageSpeedYardsPerSecond *
        (isEngaged ? KICKOFF_RETURN_CONFIG.engagedSpeedMultiplier : 1),
      delta,
    );
  }
}

function completeKickoffReturn(
  state: KickoffReturnState,
  outcome: Omit<KickoffReturnOutcome, 'receivingTeam'>,
): void {
  state.outcome = cloneOutcome({
    ...outcome,
    receivingTeam: state.receivingTeam,
  });
  state.clockRunning = false;
  state.phase = outcome.type === 'touchback' ? 'touchback' : 'dead';
  state.deadElapsedSeconds = 0;
  for (const participant of state.participants) {
    participant.velocity = { x: 0, z: 0 };
  }
}

function startClock(state: KickoffReturnState, events: KickoffReturnUpdateEvents): void {
  if (state.clockStarted) {
    return;
  }

  state.clockRunning = true;
  state.clockStarted = true;
  state.clockStartReason = 'legalTouch';
  events.clockStarted = true;
}

function createKickoffReturnBlockAssignments(
  state: KickoffReturnState,
): KickoffReturnBlockAssignment[] {
  const coverage = state.participants
    .filter((participant) => participant.phase === 'kicking' && participant.slotId !== 'kicker')
    .sort(compareByXThenId);
  const blockers = state.participants
    .filter((participant) =>
      participant.phase === 'receiving' &&
      participant.visualId !== state.assignedReturner?.returnerVisualId)
    .sort(compareByXThenId);
  const assignments: KickoffReturnBlockAssignment[] = [];

  for (let index = 0; index < Math.min(blockers.length, coverage.length); index += 1) {
    const blocker = blockers[index]!;
    const defender = coverage[index]!;
    blocker.assignedBlockTargetVisualId = defender.visualId;
    assignments.push({
      blockerVisualId: blocker.visualId,
      coverageVisualId: defender.visualId,
    });
  }

  return assignments;
}

function resolveReceivingSupportTarget(
  state: KickoffReturnState,
  participant: KickoffReturnParticipantState,
): FootballSpot {
  if (participant.visualId === state.assignedReturner?.returnerVisualId) {
    return state.result.target;
  }

  const receivingDirection = invertDirection(state.direction);
  if (participant.visualId === state.nonAssignedReturnerVisualId) {
    const lateralOffset = state.returnLane === 'left'
      ? -KICKOFF_RETURN_CONFIG.leadBlockOffsetX
      : state.returnLane === 'right'
        ? KICKOFF_RETURN_CONFIG.leadBlockOffsetX
        : 0;
    return {
      x: clampX(state.result.target.x + lateralOffset, state.fieldBounds),
      z: clampZ(state.result.target.z + receivingDirection * KICKOFF_RETURN_CONFIG.leadBlockOffsetZ, state.fieldBounds),
    };
  }

  return resolvePreCatchStagingTarget(state, participant, receivingDirection);
}

function resolveReceivingBlockerTarget(
  state: KickoffReturnState,
  participant: KickoffReturnParticipantState,
  carrier: KickoffReturnParticipantState | null,
  blockTargetId: string | null,
): FootballSpot {
  const blockTarget = blockTargetId ? findParticipant(state, blockTargetId) : null;
  if (!carrier) {
    if (
      blockTarget &&
      shouldEngageAssignedCoverageBeforeCatch(participant, blockTarget, state.result.target)
    ) {
      return blockTarget.position;
    }
    return resolveReceivingSupportTarget(state, participant);
  }

  if (
    blockTarget &&
    shouldEngageAssignedCoverage(participant, blockTarget, carrier)
  ) {
    return blockTarget.position;
  }

  return resolveReturnEscortTarget(state, participant, carrier);
}

function shouldEngageAssignedCoverageBeforeCatch(
  blocker: KickoffReturnParticipantState,
  coverage: KickoffReturnParticipantState,
  landingSpot: FootballSpot,
): boolean {
  if (distanceBetween(coverage.position, landingSpot) <= KICKOFF_RETURN_CONFIG.returnerCatchClearanceYards) {
    return false;
  }

  return (
    distanceBetween(blocker.position, coverage.position) <=
      KICKOFF_RETURN_CONFIG.receivingBlockerEngageDistanceYards ||
    distanceBetween(landingSpot, coverage.position) <=
      KICKOFF_RETURN_CONFIG.receivingBlockerProtectCarrierDistanceYards
  );
}

function resolvePreCatchStagingTarget(
  state: KickoffReturnState,
  participant: KickoffReturnParticipantState,
  receivingDirection: KickoffDirection,
): FootballSpot {
  const slotOffset = resolveReceivingEscortSlotOffset(participant.slotId);
  const depth = Math.max(
    resolveReceivingEscortDepth(participant.slotId),
    KICKOFF_RETURN_CONFIG.returnerCatchClearanceYards,
  );

  return {
    x: clampX(state.result.target.x + slotOffset, state.fieldBounds),
    z: clampZ(state.result.target.z + receivingDirection * depth, state.fieldBounds),
  };
}

function shouldEngageAssignedCoverage(
  blocker: KickoffReturnParticipantState,
  coverage: KickoffReturnParticipantState,
  carrier: KickoffReturnParticipantState,
): boolean {
  return (
    distanceBetween(blocker.position, coverage.position) <=
      KICKOFF_RETURN_CONFIG.receivingBlockerEngageDistanceYards ||
    distanceBetween(carrier.position, coverage.position) <=
      KICKOFF_RETURN_CONFIG.receivingBlockerProtectCarrierDistanceYards
  );
}

function resolveReturnEscortTarget(
  state: KickoffReturnState,
  participant: KickoffReturnParticipantState,
  carrier: KickoffReturnParticipantState,
): FootballSpot {
  const receivingDirection = invertDirection(state.direction);
  const slotOffset = resolveReceivingEscortSlotOffset(participant.slotId);
  const depth = resolveReceivingEscortDepth(participant.slotId);

  return {
    x: clampX(carrier.position.x + slotOffset, state.fieldBounds),
    z: clampZ(carrier.position.z + receivingDirection * depth, state.fieldBounds),
  };
}

function resolveReceivingEscortSlotOffset(slotId: KickoffReturnParticipantState['slotId']): number {
  switch (slotId) {
    case 'front-line-left-2':
      return -2 * KICKOFF_RETURN_CONFIG.returnEscortWidthYards;
    case 'front-line-left-1':
    case 'second-line-left-2':
      return -KICKOFF_RETURN_CONFIG.returnEscortWidthYards;
    case 'front-line-right-1':
    case 'second-line-right-2':
      return KICKOFF_RETURN_CONFIG.returnEscortWidthYards;
    case 'front-line-right-2':
      return 2 * KICKOFF_RETURN_CONFIG.returnEscortWidthYards;
    case 'second-line-left-1':
      return -0.45 * KICKOFF_RETURN_CONFIG.returnEscortWidthYards;
    case 'second-line-right-1':
      return 0.45 * KICKOFF_RETURN_CONFIG.returnEscortWidthYards;
    case 'returner-left':
      return stateLaneSideOffset(-1);
    case 'returner-right':
      return stateLaneSideOffset(1);
    default:
      return 0;
  }
}

function stateLaneSideOffset(side: -1 | 1): number {
  return side * 0.8 * KICKOFF_RETURN_CONFIG.returnEscortWidthYards;
}

function resolveReceivingEscortDepth(slotId: KickoffReturnParticipantState['slotId']): number {
  if (slotId.startsWith('front-line-')) {
    return KICKOFF_RETURN_CONFIG.returnEscortFrontDepthYards;
  }
  if (slotId.startsWith('second-line-')) {
    return KICKOFF_RETURN_CONFIG.returnEscortSecondDepthYards;
  }
  return KICKOFF_RETURN_CONFIG.leadBlockOffsetZ;
}

function resolveAiReturnInput(
  state: KickoffReturnState,
  carrier: KickoffReturnParticipantState,
  receivingDirection: KickoffDirection,
): Vector2 {
  const laneX = state.returnLane === 'left'
    ? -9
    : state.returnLane === 'right'
      ? 9
      : 0;
  const target = {
    x: laneX,
    z: carrier.position.z + receivingDirection * 12,
  };
  return normalize({
    x: target.x - carrier.position.x,
    z: target.z - carrier.position.z,
  });
}

function syncBallToCarrier(
  state: KickoffReturnState,
  carrier: KickoffReturnParticipantState,
): void {
  const cos = Math.cos(carrier.facingRadians);
  const sin = Math.sin(carrier.facingRadians);
  state.ballPosition = {
    x: carrier.position.x + BALL_CARRY_ATTACHMENT.x * cos + BALL_CARRY_ATTACHMENT.z * sin,
    y: BALL_CARRY_ATTACHMENT.y,
    z: carrier.position.z - BALL_CARRY_ATTACHMENT.x * sin + BALL_CARRY_ATTACHMENT.z * cos,
  };
}

function resolveReturnTouchdownSpot(state: KickoffReturnState): FootballSpot | null {
  const carrier = state.carrierVisualId ? findParticipant(state, state.carrierVisualId) : null;
  if (!carrier) {
    return null;
  }
  const receivingDirection = invertDirection(state.direction);
  const crossed = receivingDirection > 0
    ? carrier.position.z >= state.fieldBounds.maxZ
    : carrier.position.z <= state.fieldBounds.minZ;

  if (!crossed) {
    return null;
  }

  return {
    x: clampX(carrier.position.x, state.fieldBounds),
    z: receivingDirection > 0 ? state.fieldBounds.maxZ : state.fieldBounds.minZ,
  };
}

function resolveOutOfBoundsSpot(carrier: KickoffReturnParticipantState): FootballSpot | null {
  if (carrier.position.x <= PLAYABLE_FIELD_BOUNDS.minX) {
    return {
      x: PLAYABLE_FIELD_BOUNDS.minX,
      z: carrier.position.z,
    };
  }
  if (carrier.position.x >= PLAYABLE_FIELD_BOUNDS.maxX) {
    return {
      x: PLAYABLE_FIELD_BOUNDS.maxX,
      z: carrier.position.z,
    };
  }
  return null;
}

function getReturnerCandidates(state: KickoffReturnState): KickReturnerCandidate[] {
  return state.participants
    .filter((participant) =>
      participant.slotId === 'returner-left' || participant.slotId === 'returner-right')
    .map((participant) => ({
      position: participant.position,
      rosterPlayerId: participant.rosterPlayerId,
      slotId: participant.slotId,
      visualId: participant.visualId,
    }));
}

function resolveNonAssignedReturnerVisualId(state: KickoffReturnState): string | null {
  const returner = state.participants.find((participant) =>
    (participant.slotId === 'returner-left' || participant.slotId === 'returner-right') &&
    participant.visualId !== state.assignedReturner?.returnerVisualId);
  return returner?.visualId ?? null;
}

function createParticipantState(
  placement: KickoffFormationParticipantPlacement,
): KickoffReturnParticipantState {
  return {
    assignedBlockTargetVisualId: null,
    facingRadians: placement.facingRadians,
    phase: placement.phase,
    position: { ...placement.position },
    role: placement.role,
    rosterPlayerId: placement.rosterPlayerId,
    slotId: placement.slotId,
    team: placement.team,
    velocity: { x: 0, z: 0 },
    visualId: placement.visualId,
  };
}

function findParticipant(
  state: KickoffReturnState,
  visualId: string,
): KickoffReturnParticipantState | null {
  return state.participants.find((participant) => participant.visualId === visualId) ?? null;
}

function isCoverageEngaged(state: KickoffReturnState, visualId: string): boolean {
  const blocker = state.participants.find((participant) =>
    participant.assignedBlockTargetVisualId === visualId &&
    distanceBetween(participant.position, findParticipant(state, visualId)?.position ?? participant.position) <= 1.9);
  return Boolean(blocker);
}

function moveParticipantToward(
  participant: KickoffReturnParticipantState,
  target: FootballSpot,
  speed: number,
  delta: number,
): void {
  const input = normalize({
    x: target.x - participant.position.x,
    z: target.z - participant.position.z,
  });
  participant.velocity = {
    x: input.x * speed,
    z: input.z * speed,
  };
  if (input.x !== 0 || input.z !== 0) {
    participant.facingRadians = Math.atan2(input.x, input.z);
  }
  const step = speed * delta;
  const distance = distanceBetween(participant.position, target);
  if (distance <= step || distance === 0) {
    participant.position = { ...target };
    participant.velocity = { x: 0, z: 0 };
    return;
  }
  participant.position.x += input.x * step;
  participant.position.z += input.z * step;
}

function resolveReturnLane(matchSeed: number | string, sequenceIndex: number): KickoffReturnLane {
  const value = hashToUnit(`${matchSeed}:kickoff-return-lane:${sequenceIndex}`);
  if (value < 1 / 3) {
    return 'left';
  }
  if (value < 2 / 3) {
    return 'middle';
  }
  return 'right';
}

function hashToUnit(seed: string): number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return state / 0xffffffff;
}

function compareByXThenId(
  a: KickoffReturnParticipantState,
  b: KickoffReturnParticipantState,
): number {
  const xDelta = a.position.x - b.position.x;
  return Math.abs(xDelta) > 0.000001
    ? xDelta
    : a.rosterPlayerId.localeCompare(b.rosterPlayerId);
}

function distanceBetween(a: FootballSpot, b: FootballSpot): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function normalize(input: Vector2): Vector2 {
  const length = Math.hypot(input.x, input.z);
  if (length === 0) {
    return { x: 0, z: 0 };
  }
  return {
    x: input.x / length,
    z: input.z / length,
  };
}

function invertDirection(direction: KickoffDirection): KickoffDirection {
  return direction > 0 ? -1 : 1;
}

function clampX(value: number, bounds: FieldBounds): number {
  return clamp(
    value,
    bounds.minX + KICKOFF_RETURN_CONFIG.fieldEdgeInsetYards,
    bounds.maxX - KICKOFF_RETURN_CONFIG.fieldEdgeInsetYards,
  );
}

function clampZ(value: number, bounds: FieldBounds): number {
  return clamp(value, bounds.minZ, bounds.maxZ);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cloneKickoffResult(result: KickoffResult): KickoffResult {
  return {
    ...result,
    origin: { ...result.origin },
    receivingStartPosition: { ...result.receivingStartPosition },
    target: { ...result.target },
  };
}

function cloneOutcome(outcome: KickoffReturnOutcome): KickoffReturnOutcome {
  return {
    ...outcome,
    deadBallSpot: { ...outcome.deadBallSpot },
    receivingStartPosition: { ...outcome.receivingStartPosition },
  };
}
