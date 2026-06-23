import { FIELD_BOUNDS } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { MatchPossession, MatchRules } from '../match/MatchTypes';
import {
  createFreeKickTouchbackPosition,
  worldSpotToPossessionFieldPosition,
} from '../match/FieldPositionModel';
import type {
  KickoffDirection,
  KickoffResult,
  KickoffState,
  KickoffSimulationInput,
} from './KickoffTypes';
import { resolveKickoffLineSpot, resolveSafetyFreeKickLineSpot } from './CollegeSpecialTeamsRuleSpec';

export const KICKOFF_SIMULATION_CONFIG = {
  accuracyLongitudinalStdMaxYards: 9.5,
  accuracyLongitudinalStdMinYards: 1.8,
  accuracyLateralStdMaxYards: 8,
  accuracyLateralStdMinYards: 1.2,
  apexBaseYards: 8.5,
  apexPowerScaleYards: 0.075,
  expectedDistanceBaseYards: 47,
  expectedDistancePowerScaleYards: 0.22,
  flightBaseSeconds: 3.1,
  flightDistanceScaleSeconds: 0.012,
  flightDurationScale: 0.86,
  flightPowerScaleSeconds: 0.006,
  maxReturnYards: 28,
  minReturnYards: 9,
  reticleRadiusMaxYards: 8.5,
  reticleRadiusMinYards: 1.8,
  sidelineInsetYards: 1,
} as const;

export function createKickoffState(): KickoffState {
  return {
    completed: false,
    direction: 1 as KickoffDirection,
    kickerRatings: null,
    kickerRosterId: null,
    kickingTeam: null,
    phase: 'idle' as const,
    reason: null,
    receivingTeam: null,
    result: null,
    returnResult: null,
    sequenceIndex: -1,
  };
}

export function cloneKickoffState(state: KickoffState): KickoffState {
  return {
    ...state,
    kickerRatings: state.kickerRatings ? { ...state.kickerRatings } : null,
    result: state.result ? cloneKickoffResult(state.result) : null,
    returnResult: state.returnResult ? {
      ...state.returnResult,
      deadBallSpot: { ...state.returnResult.deadBallSpot },
      receivingStartPosition: { ...state.returnResult.receivingStartPosition },
    } : null,
  };
}

export function createKickoffOrigin(
  kickingTeam: MatchPossession,
  placement: 'kickoff' | 'safetyFreeKick' = 'kickoff',
): {
  direction: KickoffDirection;
  origin: FootballSpot;
} {
  const direction: KickoffDirection = kickingTeam === 'user' ? 1 : -1;
  return {
    direction,
    origin: placement === 'safetyFreeKick'
      ? resolveSafetyFreeKickLineSpot(direction)
      : resolveKickoffLineSpot(direction),
  };
}

export function simulateKickoff(input: KickoffSimulationInput): KickoffResult {
  const rng = createSeededRng(
    `${input.matchSeed}:kickoff:${input.sequenceIndex}:${input.kickerRosterId}:${input.kickPower}:${input.kickAccuracy}:${input.direction}`,
  );
  const accuracy = clamp(input.kickAccuracy, 0, 99) / 99;
  const power = clamp(input.kickPower, 0, 99);
  const longitudinalStd = lerp(
    KICKOFF_SIMULATION_CONFIG.accuracyLongitudinalStdMaxYards,
    KICKOFF_SIMULATION_CONFIG.accuracyLongitudinalStdMinYards,
    accuracy,
  );
  const lateralStd = lerp(
    KICKOFF_SIMULATION_CONFIG.accuracyLateralStdMaxYards,
    KICKOFF_SIMULATION_CONFIG.accuracyLateralStdMinYards,
    accuracy,
  );
  const lateralErrorYards = seededNormal(rng) * lateralStd;
  const longitudinalErrorYards = seededNormal(rng) * longitudinalStd;
  const expectedDistance =
    KICKOFF_SIMULATION_CONFIG.expectedDistanceBaseYards +
    power * KICKOFF_SIMULATION_CONFIG.expectedDistancePowerScaleYards;
  const rawDistance = Math.max(22, expectedDistance + longitudinalErrorYards);
  const target = clampSpot(
    {
      x: input.origin.x + lateralErrorYards,
      z: input.origin.z + input.direction * rawDistance,
    },
    input.fieldBounds,
  );
  const traveledDistance = Math.hypot(target.x - input.origin.x, target.z - input.origin.z);
  const landingType = isTouchbackTarget(target, input.direction, input.fieldBounds)
    ? 'touchback'
    : 'fielded';
  const receivingTeam = input.direction > 0 ? 'opponent' : 'user';
  const receivingStartPosition = landingType === 'touchback'
    ? createFreeKickTouchbackPosition()
    : calculateFieldedStartPosition({
        direction: input.direction,
        receivingTeam,
        rng,
        target,
      });
  const unscaledFlightSeconds =
    KICKOFF_SIMULATION_CONFIG.flightBaseSeconds +
    traveledDistance * KICKOFF_SIMULATION_CONFIG.flightDistanceScaleSeconds +
    power * KICKOFF_SIMULATION_CONFIG.flightPowerScaleSeconds;

  return {
    apexHeight:
      KICKOFF_SIMULATION_CONFIG.apexBaseYards +
      power * KICKOFF_SIMULATION_CONFIG.apexPowerScaleYards,
    flightSeconds: unscaledFlightSeconds * KICKOFF_SIMULATION_CONFIG.flightDurationScale,
    landingType,
    lateralErrorYards,
    longitudinalErrorYards,
    origin: { ...input.origin },
    receivingStartPosition,
    target,
    uncertaintyRadiusYards: lerp(
      KICKOFF_SIMULATION_CONFIG.reticleRadiusMaxYards,
      KICKOFF_SIMULATION_CONFIG.reticleRadiusMinYards,
      accuracy,
    ),
  };
}

export function createKickoffSimulationInput(options: {
  kickingTeam: MatchPossession;
  kickerRosterId: string;
  kickPower: number;
  kickAccuracy: number;
  matchSeed: number;
  rules: MatchRules;
  sequenceIndex: number;
  placement?: 'kickoff' | 'safetyFreeKick';
}): KickoffSimulationInput {
  const placement = createKickoffOrigin(options.kickingTeam, options.placement);

  return {
    direction: placement.direction,
    fieldBounds: FIELD_BOUNDS,
    kickAccuracy: options.kickAccuracy,
    kickPower: options.kickPower,
    kickerRosterId: options.kickerRosterId,
    matchSeed: options.matchSeed,
    origin: placement.origin,
    sequenceIndex: options.sequenceIndex,
  };
}

export function sampleKickoffBallPosition(
  result: KickoffResult,
  elapsedSeconds: number,
): { x: number; y: number; z: number } {
  const t = clamp(elapsedSeconds / Math.max(0.001, result.flightSeconds), 0, 1);
  return {
    x: lerp(result.origin.x, result.target.x, t),
    y: Math.sin(Math.PI * t) * result.apexHeight + lerp(0.24, 0.18, t),
    z: lerp(result.origin.z, result.target.z, t),
  };
}

export function classifyKickoffCommentaryResult(result: KickoffResult): 'deepKick' | 'returnedKick' | 'shortKick' | 'touchback' {
  if (result.landingType === 'touchback') {
    return 'touchback';
  }

  const distance = Math.hypot(
    result.target.x - result.origin.x,
    result.target.z - result.origin.z,
  );
  if (distance < 48) {
    return 'shortKick';
  }
  if (distance > 62) {
    return 'deepKick';
  }
  return 'returnedKick';
}

function calculateFieldedStartPosition(options: {
  direction: KickoffDirection;
  receivingTeam: MatchPossession;
  rng: () => number;
  target: FootballSpot;
}) {
  const returnYards = Math.round(lerp(
    KICKOFF_SIMULATION_CONFIG.minReturnYards,
    KICKOFF_SIMULATION_CONFIG.maxReturnYards,
    options.rng(),
  ));
  const physicalReturnSpot = clampSpot(
    {
      x: options.target.x * 0.45,
      z: options.target.z - options.direction * returnYards,
    },
    {
      maxX: FIELD_BOUNDS.maxX - KICKOFF_SIMULATION_CONFIG.sidelineInsetYards,
      maxZ: 50,
      minX: FIELD_BOUNDS.minX + KICKOFF_SIMULATION_CONFIG.sidelineInsetYards,
      minZ: -50,
    },
  );

  return worldSpotToPossessionFieldPosition(physicalReturnSpot, options.receivingTeam);
}

function isTouchbackTarget(
  target: FootballSpot,
  direction: KickoffDirection,
  bounds: KickoffSimulationInput['fieldBounds'],
): boolean {
  return direction > 0
    ? target.z >= bounds.maxZ - 10
    : target.z <= bounds.minZ + 10;
}

function cloneKickoffResult(result: KickoffResult): KickoffResult {
  return {
    ...result,
    origin: { ...result.origin },
    receivingStartPosition: { ...result.receivingStartPosition },
    target: { ...result.target },
  };
}

function createSeededRng(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function seededNormal(rng: () => number): number {
  const u1 = Math.max(Number.EPSILON, rng());
  const u2 = Math.max(Number.EPSILON, rng());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
}

function clampSpot(
  spot: FootballSpot,
  bounds: KickoffSimulationInput['fieldBounds'],
): FootballSpot {
  return {
    x: clamp(spot.x, bounds.minX + KICKOFF_SIMULATION_CONFIG.sidelineInsetYards, bounds.maxX - KICKOFF_SIMULATION_CONFIG.sidelineInsetYards),
    z: clamp(spot.z, bounds.minZ + 0.5, bounds.maxZ - 0.5),
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
