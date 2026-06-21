import type { FootballSpot } from '../fieldScale';
import { PLAYABLE_FIELD_BOUNDS } from '../fieldSpec';
import {
  createDriveSummary,
} from './DriveSummary';
import type {
  DriveSummary,
  DriveSummaryResult,
  MatchDifficulty,
  ScoringEvent,
} from './MatchTypes';

export interface OpponentDriveInput {
  difficulty: MatchDifficulty;
  driveNumber: number;
  opponentOffensiveRating: number;
  quarter: number;
  remainingSeconds: number;
  seed: number;
  startingFieldPosition: FootballSpot;
  userDefensiveRating: number;
}

export function simulateOpponentDrive(input: OpponentDriveInput): DriveSummary {
  const rng = createSeededRng(
    input.seed +
      input.driveNumber * 1009 +
      input.quarter * 917 +
      Math.round((input.startingFieldPosition.z + 60) * 31),
  );
  const ratingDelta =
    input.opponentOffensiveRating -
    input.userDefensiveRating +
    difficultyRatingModifier(input.difficulty);
  const touchdownChance = clamp(0.18 + ratingDelta * 0.006, 0.08, 0.38);
  const fieldGoalChance = clamp(0.24 + ratingDelta * 0.003, 0.14, 0.36);
  const turnoverChance = clamp(0.12 - ratingDelta * 0.002, 0.05, 0.2);
  const roll = rng();
  const plays = 3 + Math.floor(rng() * 8);
  const maxElapsed = Math.max(12, Math.min(input.remainingSeconds, 18 + plays * (9 + rng() * 8)));
  const elapsedSeconds = Math.min(input.remainingSeconds, Math.round(maxElapsed));
  const quarterEnding = input.remainingSeconds <= elapsedSeconds;
  let result: DriveSummaryResult;

  if (quarterEnding && input.quarter >= 4) {
    result = 'endOfGame';
  } else if (quarterEnding && input.quarter === 2) {
    result = 'endOfHalf';
  } else if (roll < touchdownChance) {
    result = 'touchdown';
  } else if (roll < touchdownChance + fieldGoalChance) {
    result = 'fieldGoal';
  } else if (roll < touchdownChance + fieldGoalChance + turnoverChance) {
    result = 'turnover';
  } else if (roll > 0.94) {
    result = 'turnoverOnDowns';
  } else {
    result = 'punt';
  }

  const yards = estimateYards(result, rng, input.startingFieldPosition);
  const endingFieldPosition = clampSpot({
    x: input.startingFieldPosition.x,
    z: input.startingFieldPosition.z + yards,
  });
  const scoringEvents = createScoringEvents(result);

  return createDriveSummary({
    description: createOpponentDescription(result, plays, yards),
    driveNumber: input.driveNumber,
    elapsedSeconds,
    endingFieldPosition,
    plays,
    possession: 'opponent',
    quarter: input.quarter,
    result,
    scoringEvents,
    startedAtSeconds: input.remainingSeconds,
    startingFieldPosition: input.startingFieldPosition,
    yards,
  });
}

function estimateYards(
  result: DriveSummaryResult,
  rng: () => number,
  startingFieldPosition: FootballSpot,
): number {
  switch (result) {
    case 'touchdown':
      return Math.max(1, Math.round(PLAYABLE_FIELD_BOUNDS.maxZ - startingFieldPosition.z));
    case 'fieldGoal':
      return 28 + Math.round(rng() * 28);
    case 'turnover':
      return Math.round(rng() * 35) - 8;
    case 'turnoverOnDowns':
      return Math.round(rng() * 24);
    case 'endOfHalf':
    case 'endOfGame':
      return Math.round(rng() * 40);
    case 'punt':
    default:
      return Math.round(rng() * 22);
  }
}

function createScoringEvents(result: DriveSummaryResult): ScoringEvent[] {
  if (result === 'touchdown') {
    return [
      { points: 6, team: 'opponent', type: 'touchdown' },
      { points: 1, team: 'opponent', type: 'extraPoint' },
    ];
  }

  if (result === 'fieldGoal') {
    return [{ points: 3, team: 'opponent', type: 'fieldGoal' }];
  }

  return [];
}

function createOpponentDescription(result: DriveSummaryResult, plays: number, yards: number): string {
  switch (result) {
    case 'touchdown':
      return `The opponent strings together ${plays} plays and finishes the drive in the end zone.`;
    case 'fieldGoal':
      return `The defense stiffens late, but the opponent converts the short field-goal try.`;
    case 'turnover':
      return `The defense steals a possession after ${plays} plays.`;
    case 'turnoverOnDowns':
      return `A fourth-down stop gives the offense the ball back.`;
    case 'endOfHalf':
      return `The opponent runs out the half after gaining ${yards} yards.`;
    case 'endOfGame':
      return `The final possession drains the remaining clock.`;
    case 'punt':
    default:
      return `The defense forces a punt after ${plays} plays.`;
  }
}

function difficultyRatingModifier(difficulty: MatchDifficulty): number {
  if (difficulty === 'rookie') {
    return -8;
  }

  if (difficulty === 'allPro') {
    return 8;
  }

  return 0;
}

function clampSpot(spot: FootballSpot): FootballSpot {
  return {
    x: Math.max(PLAYABLE_FIELD_BOUNDS.minX, Math.min(PLAYABLE_FIELD_BOUNDS.maxX, spot.x)),
    z: Math.max(PLAYABLE_FIELD_BOUNDS.minZ, Math.min(PLAYABLE_FIELD_BOUNDS.maxZ, spot.z)),
  };
}

function createSeededRng(seed: number): () => number {
  let state = Math.abs(Math.trunc(seed)) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
