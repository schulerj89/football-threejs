import type { FootballSpot } from '../fieldScale';
import type { TeamProfile } from '../teams/TeamProfile';

export type MatchPhase =
  | 'pregame'
  | 'userPossession'
  | 'opponentDriveSimulation'
  | 'quarterBreak'
  | 'halftime'
  | 'gameOver';

export type MatchPossession = 'opponent' | 'user';

export type MatchDifficulty = 'rookie' | 'pro' | 'allPro';

export type ExhibitionGameMode = 'exhibition' | 'scoreAttack';

export type DriveSummaryResult =
  | 'endOfGame'
  | 'endOfHalf'
  | 'fieldGoal'
  | 'punt'
  | 'touchdown'
  | 'turnover'
  | 'turnoverOnDowns';

export type ScoringEventType = 'extraPoint' | 'fieldGoal' | 'touchdown';

export interface ScoringEvent {
  points: number;
  team: MatchPossession;
  type: ScoringEventType;
}

export interface DriveSummary {
  description: string;
  driveNumber: number;
  elapsedSeconds: number;
  endingFieldPosition: FootballSpot;
  id: string;
  plays: number;
  points: number;
  possession: MatchPossession;
  quarter: number;
  result: DriveSummaryResult;
  scoringEvents: readonly ScoringEvent[];
  startedAtSeconds: number;
  startingFieldPosition: FootballSpot;
  yards: number;
}

export interface MatchClockSnapshot {
  quarterDurationSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

export interface MatchModel {
  clock: MatchClockSnapshot;
  currentFieldPosition: FootballSpot;
  deterministicSeed: number;
  driveNumber: number;
  driveSummaries: readonly DriveSummary[];
  gameOverReason: 'clockExpired' | null;
  openingPossession: MatchPossession;
  opponentScore: number;
  opponentTeam: TeamProfile;
  phase: MatchPhase;
  possession: MatchPossession;
  previousDriveSummary: DriveSummary | null;
  quarter: number;
  secondHalfPossession: MatchPossession;
  userScore: number;
  userTeam: TeamProfile;
}

export interface MatchRules {
  automaticExtraPointSuccessRate: number;
  difficulty: MatchDifficulty;
  puntDistanceYards: number;
  quarterDurationSeconds: number;
  seed: number;
  touchbackSpot: FootballSpot;
}

export interface MatchSnapshot extends MatchModel {
  canContinue: boolean;
  canPunt: boolean;
  canRematch: boolean;
  winner: MatchPossession | 'tie' | null;
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  automaticExtraPointSuccessRate: 1,
  difficulty: 'pro',
  puntDistanceYards: 42,
  quarterDurationSeconds: 180,
  seed: 20260620,
  touchbackSpot: { x: 0, z: -15 },
} as const;
