import type { MatchDifficulty } from '../match/MatchTypes';
import type { KickerRatings } from './KickerRatings';
import type { PlaceKickTimingInput } from './PlaceKickTypes';

export interface PlaceKickMeterConfig {
  allProSpeedMultiplier: number;
  maximumTargetHalfWidth: number;
  minimumTargetHalfWidth: number;
  proSpeedMultiplier: number;
  rookieSpeedMultiplier: number;
  speedBaseUnitsPerSecond: number;
  speedPowerScale: number;
  targetAccuracyScale: number;
}

export interface PlaceKickMeterState {
  confirmed: boolean;
  direction: -1 | 1;
  elapsedSeconds: number;
  normalizedValue: number;
  speedUnitsPerSecond: number;
  targetHalfWidth: number;
}

export const PLACE_KICK_METER_CONFIG: PlaceKickMeterConfig = {
  allProSpeedMultiplier: 1.18,
  maximumTargetHalfWidth: 0.24,
  minimumTargetHalfWidth: 0.055,
  proSpeedMultiplier: 1,
  rookieSpeedMultiplier: 0.82,
  speedBaseUnitsPerSecond: 1.55,
  speedPowerScale: 0.004,
  targetAccuracyScale: 0.15,
} as const;

export function createPlaceKickMeterState(options: {
  difficulty: MatchDifficulty;
  ratings: KickerRatings;
}): PlaceKickMeterState {
  const accuracy = clamp(options.ratings.kickAccuracy, 0, 99) / 99;
  const power = clamp(options.ratings.kickPower, 0, 99);
  const targetHalfWidth = lerp(
    PLACE_KICK_METER_CONFIG.minimumTargetHalfWidth,
    PLACE_KICK_METER_CONFIG.maximumTargetHalfWidth,
    accuracy,
  );
  const speedUnitsPerSecond = (
    PLACE_KICK_METER_CONFIG.speedBaseUnitsPerSecond +
    power * PLACE_KICK_METER_CONFIG.speedPowerScale
  ) * difficultySpeedMultiplier(options.difficulty);

  return {
    confirmed: false,
    direction: 1,
    elapsedSeconds: 0,
    normalizedValue: -1,
    speedUnitsPerSecond,
    targetHalfWidth: targetHalfWidth * PLACE_KICK_METER_CONFIG.targetAccuracyScale +
      targetHalfWidth * (1 - PLACE_KICK_METER_CONFIG.targetAccuracyScale),
  };
}

export function updatePlaceKickMeterState(
  state: PlaceKickMeterState,
  deltaSeconds: number,
): PlaceKickMeterState {
  if (state.confirmed) {
    return { ...state };
  }

  const delta = Math.max(0, deltaSeconds);
  let nextValue = state.normalizedValue + state.direction * state.speedUnitsPerSecond * delta;
  let nextDirection = state.direction;

  while (nextValue > 1 || nextValue < -1) {
    if (nextValue > 1) {
      nextValue = 2 - nextValue;
      nextDirection = -1;
    } else {
      nextValue = -2 - nextValue;
      nextDirection = 1;
    }
  }

  return {
    ...state,
    direction: nextDirection,
    elapsedSeconds: state.elapsedSeconds + delta,
    normalizedValue: nextValue,
  };
}

export function confirmPlaceKickMeter(
  state: PlaceKickMeterState,
): {
  state: PlaceKickMeterState;
  timingInput: PlaceKickTimingInput;
} {
  const confirmedState = {
    ...state,
    confirmed: true,
  };

  return {
    state: confirmedState,
    timingInput: {
      confirmedAtSeconds: state.elapsedSeconds,
      normalizedValue: clamp(state.normalizedValue, -1, 1),
    },
  };
}

export function calculatePlaceKickTimingError(
  timingInput: PlaceKickTimingInput,
  targetHalfWidth: number,
): number {
  const value = Math.abs(timingInput.normalizedValue);

  if (value <= targetHalfWidth) {
    return 0;
  }

  return clamp((value - targetHalfWidth) / Math.max(0.001, 1 - targetHalfWidth), 0, 1);
}

function difficultySpeedMultiplier(difficulty: MatchDifficulty): number {
  if (difficulty === 'rookie') {
    return PLACE_KICK_METER_CONFIG.rookieSpeedMultiplier;
  }

  if (difficulty === 'allPro') {
    return PLACE_KICK_METER_CONFIG.allProSpeedMultiplier;
  }

  return PLACE_KICK_METER_CONFIG.proSpeedMultiplier;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
