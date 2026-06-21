import type { FootballSpot } from '../fieldScale';
import type {
  DriveSummary,
  DriveSummaryResult,
  MatchPossession,
  ScoringEvent,
} from './MatchTypes';

export interface CreateDriveSummaryOptions {
  description: string;
  driveNumber: number;
  elapsedSeconds: number;
  endingFieldPosition: FootballSpot;
  plays: number;
  possession: MatchPossession;
  quarter: number;
  result: DriveSummaryResult;
  scoringEvents?: readonly ScoringEvent[];
  startedAtSeconds: number;
  startingFieldPosition: FootballSpot;
  yards: number;
}

export function createDriveSummary({
  description,
  driveNumber,
  elapsedSeconds,
  endingFieldPosition,
  plays,
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
    endingFieldPosition: { ...endingFieldPosition },
    id: `${possession}-${driveNumber}-${quarter}`,
    plays: Math.max(0, Math.round(plays)),
    points,
    possession,
    quarter,
    result,
    scoringEvents: scoringEvents.map((event) => ({ ...event })),
    startedAtSeconds,
    startingFieldPosition: { ...startingFieldPosition },
    yards: Math.round(yards),
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
    case 'endOfHalf':
      return 'End of half';
    case 'endOfGame':
      return 'End of game';
    default:
      return 'Drive complete';
  }
}
