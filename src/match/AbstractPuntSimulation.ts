import type { KickerRatings } from '../specialTeams/KickerRatings';
import {
  changePossessionFieldPosition,
  clonePossessionFieldPosition,
  createOtherTouchbackPosition,
  createOwnYardLinePosition,
  type PossessionFieldPosition,
} from './FieldPositionModel';

export type SimulatedPuntOutcome = 'downed' | 'return' | 'touchback';

export interface SimulatedPuntInput {
  driveNumber: number;
  kickOrigin: PossessionFieldPosition;
  matchSeed: number;
  punterRatings?: KickerRatings;
}

export interface SimulatedPuntResult {
  kickOrigin: PossessionFieldPosition;
  physicalLandingPosition: PossessionFieldPosition;
  receivingStartPosition: PossessionFieldPosition;
  result: SimulatedPuntOutcome;
  returnYards: number;
}

export function simulateAbstractPunt(input: SimulatedPuntInput): SimulatedPuntResult {
  const origin = createOwnYardLinePosition(
    input.kickOrigin.yardsFromOwnGoalLine,
    input.kickOrigin.lateralX,
  );
  const rng = createSeededRng(
    `${input.matchSeed}:punt:${input.driveNumber}:${origin.yardsFromOwnGoalLine.toFixed(2)}:${origin.lateralX.toFixed(2)}:${input.punterRatings?.kickPower ?? 72}:${input.punterRatings?.kickAccuracy ?? 72}`,
  );
  const power = clamp((input.punterRatings?.kickPower ?? 72) / 99, 0, 1);
  const accuracy = clamp((input.punterRatings?.kickAccuracy ?? 72) / 99, 0, 1);
  const distance = Math.round(34 + power * 19 + (rng() - 0.5) * (14 - accuracy * 8));
  const lateralDrift = (rng() - 0.5) * (18 - accuracy * 10);
  const landing = createOwnYardLinePosition(
    origin.yardsFromOwnGoalLine + distance,
    origin.lateralX + lateralDrift,
  );

  if (origin.yardsFromOwnGoalLine + distance >= 100) {
    return {
      kickOrigin: clonePossessionFieldPosition(origin),
      physicalLandingPosition: landing,
      receivingStartPosition: createOtherTouchbackPosition(),
      result: 'touchback',
      returnYards: 0,
    };
  }

  const returnRoll = rng();
  const result: SimulatedPuntOutcome = returnRoll < 0.42 ? 'downed' : 'return';
  const returnYards = result === 'return'
    ? Math.round(3 + rng() * 14)
    : 0;
  const deadPosition = createOwnYardLinePosition(
    landing.yardsFromOwnGoalLine - returnYards,
    landing.lateralX + (result === 'return' ? (rng() - 0.5) * 8 : 0),
  );

  return {
    kickOrigin: clonePossessionFieldPosition(origin),
    physicalLandingPosition: landing,
    receivingStartPosition: changePossessionFieldPosition(deadPosition),
    result,
    returnYards,
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
