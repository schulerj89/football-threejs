import {
  createDriveSummary,
} from './DriveSummary';
import {
  calculatePossessionYardsGained,
  changePossessionFieldPosition,
  clonePossessionFieldPosition,
  createOwnYardLinePosition,
  type PossessionFieldPosition,
} from './FieldPositionModel';
import {
  simulateAbstractPunt,
  type SimulatedPuntResult,
} from './AbstractPuntSimulation';
import type {
  DriveSummary,
  DriveSummaryResult,
  MatchDifficulty,
  PossessionTransition,
  ScoringEvent,
} from './MatchTypes';
import type { KickerRatings } from '../specialTeams/KickerRatings';

export interface OpponentDriveInput {
  difficulty: MatchDifficulty;
  driveNumber: number;
  opponentOffensiveRating: number;
  opponentKickerRatings?: KickerRatings;
  quarter: number;
  remainingSeconds: number;
  seed: number;
  startingFieldPosition: PossessionFieldPosition;
  userDefensiveRating: number;
}

export function simulateOpponentDrive(input: OpponentDriveInput): DriveSummary {
  const rng = createSeededRng(
    input.seed +
      input.driveNumber * 1009 +
      input.quarter * 917 +
      Math.round(input.startingFieldPosition.yardsFromOwnGoalLine * 31),
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
  const endingFieldPosition = clampPosition({
    lateralX: input.startingFieldPosition.lateralX,
    yardsFromOwnGoalLine: input.startingFieldPosition.yardsFromOwnGoalLine + yards,
  });
  const punt = result === 'punt'
    ? simulateAbstractPunt({
        driveNumber: input.driveNumber,
        kickOrigin: endingFieldPosition,
        matchSeed: input.seed,
        punterRatings: input.opponentKickerRatings,
      })
    : null;
  const driveEndingPosition = punt?.kickOrigin ?? endingFieldPosition;
  const possessionTransition = createOpponentPossessionTransition(
    result,
    driveEndingPosition,
    punt,
  );
  const scoringEvents = createScoringEvents(result, rng, input.difficulty, input.opponentKickerRatings);

  return createDriveSummary({
    description: createOpponentDescription(result, plays, yards, punt),
    driveNumber: input.driveNumber,
    elapsedSeconds,
    endingFieldPosition: driveEndingPosition,
    plays,
    possessionTransition,
    possession: 'opponent',
    quarter: input.quarter,
    result,
    scoringEvents,
    startedAtSeconds: input.remainingSeconds,
    startingFieldPosition: clonePossessionFieldPosition(input.startingFieldPosition),
    yards: calculatePossessionYardsGained(input.startingFieldPosition, driveEndingPosition),
  });
}

function createOpponentPossessionTransition(
  result: DriveSummaryResult,
  endingFieldPosition: PossessionFieldPosition,
  punt: SimulatedPuntResult | null,
): PossessionTransition | null {
  if (punt) {
    return {
      fromTeam: 'opponent',
      nextOffenseStartingPosition: clonePossessionFieldPosition(punt.receivingStartPosition),
      previousOffenseEndingPosition: clonePossessionFieldPosition(punt.kickOrigin),
      reason: punt.result === 'touchback'
        ? 'puntTouchback'
        : punt.result === 'downed'
          ? 'puntDowned'
          : 'puntReturn',
      toTeam: 'user',
    };
  }

  if (result === 'turnover' || result === 'turnoverOnDowns') {
    return {
      fromTeam: 'opponent',
      nextOffenseStartingPosition: changePossessionFieldPosition(endingFieldPosition),
      previousOffenseEndingPosition: clonePossessionFieldPosition(endingFieldPosition),
      reason: result,
      toTeam: 'user',
    };
  }

  return null;
}

function estimateYards(
  result: DriveSummaryResult,
  rng: () => number,
  startingFieldPosition: PossessionFieldPosition,
): number {
  switch (result) {
    case 'touchdown':
      return Math.max(1, Math.round(100 - startingFieldPosition.yardsFromOwnGoalLine));
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

function createScoringEvents(
  result: DriveSummaryResult,
  rng: () => number,
  difficulty: MatchDifficulty,
  kickerRatings?: KickerRatings,
): ScoringEvent[] {
  if (result === 'touchdown') {
    const extraPointGood = simulateOpponentExtraPoint(rng, difficulty, kickerRatings);
    return [
      { points: 6, team: 'opponent', type: 'touchdown' },
      ...(extraPointGood ? [{ points: 1, team: 'opponent' as const, type: 'extraPoint' as const }] : []),
    ];
  }

  if (result === 'fieldGoal') {
    return [{ points: 3, team: 'opponent', type: 'fieldGoal' }];
  }

  return [];
}

function simulateOpponentExtraPoint(
  rng: () => number,
  difficulty: MatchDifficulty,
  kickerRatings?: KickerRatings,
): boolean {
  const accuracy = clamp((kickerRatings?.kickAccuracy ?? 76) / 99, 0, 1);
  const power = clamp((kickerRatings?.kickPower ?? 78) / 99, 0, 1);
  const difficultyModifier = difficulty === 'allPro'
    ? -0.025
    : difficulty === 'rookie'
      ? 0.025
      : 0;
  const successChance = clamp(0.88 + accuracy * 0.08 + power * 0.025 + difficultyModifier, 0.82, 0.985);

  return rng() <= successChance;
}

function createOpponentDescription(
  result: DriveSummaryResult,
  plays: number,
  yards: number,
  punt: SimulatedPuntResult | null,
): string {
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
      if (punt?.result === 'touchback') {
        return `The defense forces a punt after ${plays} plays, and the kick carries into the end zone.`;
      }
      if (punt?.result === 'return') {
        return `The defense forces a punt after ${plays} plays, and the return sets up the offense.`;
      }
      return `The defense forces a punt after ${plays} plays, and the coverage team downs it.`;
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

function clampPosition(position: PossessionFieldPosition): PossessionFieldPosition {
  return createOwnYardLinePosition(position.yardsFromOwnGoalLine, position.lateralX);
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
