import { FAR_GOAL_LINE_Z, FIELD_BOUNDS, NEAR_GOAL_LINE_Z } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { MatchDifficulty, MatchPossession } from '../match/MatchTypes';
import type { KickerRatings } from './KickerRatings';
import { resolveTryLineSpot } from './CollegeSpecialTeamsRuleSpec';
import type { KickoffDirection } from './KickoffTypes';
import {
  calculatePlaceKickTimingError,
  createPlaceKickMeterState,
} from './PlaceKickMeterModel';
import type {
  PlaceKickReason,
  PlaceKickResult,
  PlaceKickSimulationInput,
  PlaceKickState,
  PlaceKickTimingInput,
} from './PlaceKickTypes';

export const PLACE_KICK_SIMULATION_CONFIG = {
  ballSettleHeight: 0.18,
  crossbarHeightYards: 10 / 3,
  deterministicAngleNoiseMaxRadians: 0.025,
  extraPointHolderDepthYards: 7,
  flightBaseSeconds: 1.35,
  flightPowerScaleSeconds: 0.0035,
  goalDepthBeyondPlaneYards: 16,
  holderLateralOffsetYards: 0,
  kickApexBaseYards: 5.8,
  kickApexPowerScaleYards: 0.045,
  kickMinimumTargetDepthYards: 12,
  kickerDepthYards: 10,
  kickerLateralOffsetYards: -3.1,
  maxMissAngleHighAccuracyRadians: 0.34,
  maxMissAngleLowAccuracyRadians: 0.52,
  uprightInsideWidthYards: 18.5 / 3,
} as const;

export function createPlaceKickState(): PlaceKickState {
  const snapSpot = resolveTryLineSpot(1);
  const holderSpot = resolveHolderSpot(1);

  return {
    ballPlacement: { ...holderSpot },
    completed: false,
    defendingTeam: null,
    direction: 1,
    holderRosterId: null,
    holderSpot,
    kickerRatings: null,
    kickerRosterId: null,
    kickingTeam: null,
    phase: 'idle',
    reason: null,
    result: null,
    sequenceIndex: -1,
    snapSpot,
  };
}

export function clonePlaceKickState(state: PlaceKickState): PlaceKickState {
  return {
    ...state,
    ballPlacement: { ...state.ballPlacement },
    holderSpot: { ...state.holderSpot },
    kickerRatings: state.kickerRatings ? { ...state.kickerRatings } : null,
    result: state.result ? clonePlaceKickResult(state.result) : null,
    snapSpot: { ...state.snapSpot },
  };
}

export function createExtraPointPlaceKickState(options: {
  defendingTeam: MatchPossession;
  holderRosterId: string;
  kickerRatings: KickerRatings;
  kickerRosterId: string;
  kickingTeam: MatchPossession;
  reason?: PlaceKickReason;
  sequenceIndex: number;
}): PlaceKickState {
  const direction = resolvePlaceKickDirection(options.kickingTeam);
  const snapSpot = resolveTryLineSpot(direction);
  const holderSpot = resolveHolderSpot(direction);

  return {
    ballPlacement: { ...holderSpot },
    completed: false,
    defendingTeam: options.defendingTeam,
    direction,
    holderRosterId: options.holderRosterId,
    holderSpot,
    kickerRatings: { ...options.kickerRatings },
    kickerRosterId: options.kickerRosterId,
    kickingTeam: options.kickingTeam,
    phase: 'formation',
    reason: options.reason ?? 'extraPoint',
    result: null,
    sequenceIndex: options.sequenceIndex,
    snapSpot,
  };
}

export function createPlaceKickSimulationInput(options: {
  difficulty: MatchDifficulty;
  direction: KickoffDirection;
  kickerRatings: KickerRatings;
  kickerRosterId: string;
  matchSeed: number;
  sequenceIndex: number;
  timingInput: PlaceKickTimingInput;
}): PlaceKickSimulationInput {
  return {
    difficulty: options.difficulty,
    direction: options.direction,
    kickAccuracy: options.kickerRatings.kickAccuracy,
    kickerRosterId: options.kickerRosterId,
    kickPower: options.kickerRatings.kickPower,
    matchSeed: options.matchSeed,
    sequenceIndex: options.sequenceIndex,
    timingInput: { ...options.timingInput },
  };
}

export function simulatePlaceKick(input: PlaceKickSimulationInput): PlaceKickResult {
  const accuracy = clamp(input.kickAccuracy, 0, 99) / 99;
  const power = clamp(input.kickPower, 0, 99);
  const meter = createPlaceKickMeterState({
    difficulty: input.difficulty,
    ratings: {
      kickAccuracy: input.kickAccuracy,
      kickPower: input.kickPower,
    },
  });
  const timingError = calculatePlaceKickTimingError(input.timingInput, meter.targetHalfWidth);
  const maxMissAngle = lerp(
    PLACE_KICK_SIMULATION_CONFIG.maxMissAngleLowAccuracyRadians,
    PLACE_KICK_SIMULATION_CONFIG.maxMissAngleHighAccuracyRadians,
    accuracy,
  );
  const deterministicNoise = seededCentered(
    `${input.matchSeed}:placeKick:${input.sequenceIndex}:${input.kickerRosterId}:${input.direction}`,
  ) * PLACE_KICK_SIMULATION_CONFIG.deterministicAngleNoiseMaxRadians * (1 - accuracy);
  const angleDirection = input.timingInput.normalizedValue < 0 ? -1 : 1;
  const kickAngleRadians =
    angleDirection * timingError * maxMissAngle +
    deterministicNoise;
  const origin = resolveHolderSpot(input.direction);
  const goalPlaneZ = input.direction > 0 ? FAR_GOAL_LINE_Z : NEAR_GOAL_LINE_Z;
  const distanceToGoalPlane = Math.abs(goalPlaneZ - origin.z);
  const targetDepth =
    distanceToGoalPlane +
    PLACE_KICK_SIMULATION_CONFIG.goalDepthBeyondPlaneYards +
    Math.max(0, power - 45) * 0.08;
  const target = {
    x: origin.x + Math.tan(kickAngleRadians) * targetDepth,
    z: origin.z + input.direction * targetDepth,
  };
  const apexHeight =
    PLACE_KICK_SIMULATION_CONFIG.kickApexBaseYards +
    power * PLACE_KICK_SIMULATION_CONFIG.kickApexPowerScaleYards;
  const flightSeconds =
    PLACE_KICK_SIMULATION_CONFIG.flightBaseSeconds +
    power * PLACE_KICK_SIMULATION_CONFIG.flightPowerScaleSeconds;
  const goalPlanePosition = samplePlaceKickBallPosition({
    apexHeight,
    flightSeconds,
    goalPlanePosition: { x: 0, y: 0, z: goalPlaneZ },
    good: false,
    kickAngleRadians,
    origin,
    reason: 'short',
    target,
    timingInput: input.timingInput,
  }, flightSeconds * (distanceToGoalPlane / Math.max(0.001, targetDepth)));
  const uprightHalfWidth = PLACE_KICK_SIMULATION_CONFIG.uprightInsideWidthYards / 2;
  const highEnough = goalPlanePosition.y >= PLACE_KICK_SIMULATION_CONFIG.crossbarHeightYards;
  const betweenUprights = Math.abs(goalPlanePosition.x) <= uprightHalfWidth;
  const reason = highEnough
    ? betweenUprights
      ? 'good'
      : goalPlanePosition.x < 0
        ? 'wideLeft'
        : 'wideRight'
    : 'short';

  return {
    apexHeight,
    flightSeconds,
    goalPlanePosition,
    good: reason === 'good',
    kickAngleRadians,
    origin,
    reason,
    target,
    timingInput: { ...input.timingInput },
  };
}

export function samplePlaceKickBallPosition(
  result: PlaceKickResult,
  elapsedSeconds: number,
): { x: number; y: number; z: number } {
  const t = clamp(elapsedSeconds / Math.max(0.001, result.flightSeconds), 0, 1);

  return {
    x: lerp(result.origin.x, result.target.x, t),
    y:
      Math.sin(Math.PI * t) * result.apexHeight +
      PLACE_KICK_SIMULATION_CONFIG.ballSettleHeight,
    z: lerp(result.origin.z, result.target.z, t),
  };
}

export function resolvePlaceKickDirection(kickingTeam: MatchPossession): KickoffDirection {
  return kickingTeam === 'user' ? 1 : -1;
}

export function resolveHolderSpot(direction: KickoffDirection): FootballSpot {
  const snapSpot = resolveTryLineSpot(direction);

  return {
    x: snapSpot.x + PLACE_KICK_SIMULATION_CONFIG.holderLateralOffsetYards,
    z: snapSpot.z - direction * PLACE_KICK_SIMULATION_CONFIG.extraPointHolderDepthYards,
  };
}

export function resolveKickerSpot(direction: KickoffDirection): FootballSpot {
  const snapSpot = resolveTryLineSpot(direction);

  return {
    x: snapSpot.x + PLACE_KICK_SIMULATION_CONFIG.kickerLateralOffsetYards,
    z: snapSpot.z - direction * PLACE_KICK_SIMULATION_CONFIG.kickerDepthYards,
  };
}

function clonePlaceKickResult(result: PlaceKickResult): PlaceKickResult {
  return {
    ...result,
    goalPlanePosition: { ...result.goalPlanePosition },
    origin: { ...result.origin },
    target: { ...result.target },
    timingInput: { ...result.timingInput },
  };
}

function seededCentered(seed: string): number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 0x100000000 * 2 - 1;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
