import type {
  DriveSummary,
  DriveSummaryResult,
  MatchPossession,
  PossessionTransition,
  ScoringEvent,
} from './MatchTypes';
import type { PossessionFieldPosition } from './FieldPositionModel';
import { clonePossessionFieldPosition } from './FieldPositionModel';

export interface CreateDriveSummaryOptions {
  description: string;
  driveNumber: number;
  elapsedSeconds: number;
  endingFieldPosition: PossessionFieldPosition;
  plays: number;
  possessionTransition?: PossessionTransition | null;
  possession: MatchPossession;
  quarter: number;
  result: DriveSummaryResult;
  scoringEvents?: readonly ScoringEvent[];
  startedAtSeconds: number;
  startingFieldPosition: PossessionFieldPosition;
  yards: number;
}

export function createDriveSummary({
  description,
  driveNumber,
  elapsedSeconds,
  endingFieldPosition,
  plays,
  possessionTransition = null,
  possession,
  quarter,
  result,
  scoringEvents = [],
  startedAtSeconds,
  startingFieldPosition,
  yards,
}: CreateDriveSummaryOptions): DriveSummary {
  const points = scoringEvents.reduce((total, event) => total + event.points, 0);

  return {
    description,
    driveNumber,
    elapsedSeconds: Math.max(0, elapsedSeconds),
    endingFieldPosition: clonePossessionFieldPosition(endingFieldPosition),
    id: `${possession}-${driveNumber}-${quarter}`,
    plays: Math.max(0, Math.round(plays)),
    points,
    possession,
    possessionTransition: possessionTransition ? clonePossessionTransition(possessionTransition) : null,
    quarter,
    result,
    scoringEvents: scoringEvents.map((event) => ({ ...event })),
    startedAtSeconds,
    startingFieldPosition: clonePossessionFieldPosition(startingFieldPosition),
    yards: Math.round(yards),
  };
}

export function clonePossessionTransition(
  transition: PossessionTransition,
): PossessionTransition {
  return {
    ...transition,
    nextOffenseStartingPosition: clonePossessionFieldPosition(transition.nextOffenseStartingPosition),
    previousOffenseEndingPosition: clonePossessionFieldPosition(transition.previousOffenseEndingPosition),
  };
}

export function getDriveSummaryTitle(summary: DriveSummary): string {
  switch (summary.result) {
    case 'touchdown':
      return 'Touchdown drive';
    case 'fieldGoal':
      return 'Field goal drive';
    case 'punt':
      return 'Punt';
    case 'turnover':
      return 'Turnover';
    case 'turnoverOnDowns':
      return 'Turnover on downs';
    case 'endOfQuarter':
      return 'End of quarter';
    case 'endOfHalf':
      return 'End of half';
    case 'endOfGame':
      return 'End of game';
    default:
      return 'Drive complete';
  }
}
