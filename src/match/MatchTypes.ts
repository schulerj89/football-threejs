import type { KickoffState } from '../specialTeams/KickoffTypes';
import type { PlaceKickState } from '../specialTeams/PlaceKickTypes';
import type { GameStatsSnapshot } from '../stats/GameStatsTypes';
import type { TeamProfile } from '../teams/TeamProfile';
import type { CoinTossState } from './CoinTossModel';
import type { PossessionFieldPosition, TouchbackRules } from './FieldPositionModel';
import { DEFAULT_TOUCHBACK_RULES } from './FieldPositionModel';

export type MatchPhase =
  | 'coinToss'
  | 'extraPoint'
  | 'pregame'
  | 'kickoff'
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
  | 'endOfQuarter'
  | 'fieldGoal'
  | 'punt'
  | 'touchdown'
  | 'turnover'
  | 'turnoverOnDowns';

export type ScoringEventType = 'extraPoint' | 'fieldGoal' | 'touchdown';

export type PossessionTransitionReason =
  | 'kickoffTouchback'
  | 'kickoffReturn'
  | 'puntDowned'
  | 'puntTouchback'
  | 'puntReturn'
  | 'scoringKickoff'
  | 'turnover'
  | 'turnoverOnDowns';

export interface ScoringEvent {
  points: number;
  team: MatchPossession;
  type: ScoringEventType;
}

export interface PossessionTransition {
  fromTeam: MatchPossession;
  nextOffenseStartingPosition: PossessionFieldPosition;
  previousOffenseEndingPosition: PossessionFieldPosition;
  reason: PossessionTransitionReason;
  toTeam: MatchPossession;
}

export interface DriveSummary {
  description: string;
  driveNumber: number;
  elapsedSeconds: number;
  endingFieldPosition: PossessionFieldPosition;
  id: string;
  plays: number;
  points: number;
  possession: MatchPossession;
  possessionTransition: PossessionTransition | null;
  quarter: number;
  result: DriveSummaryResult;
  scoringEvents: readonly ScoringEvent[];
  startedAtSeconds: number;
  startingFieldPosition: PossessionFieldPosition;
  yards: number;
}

export interface MatchClockSnapshot {
  quarterDurationSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

export interface MatchModel {
  clock: MatchClockSnapshot;
  coinToss: CoinTossState;
  currentFieldPosition: PossessionFieldPosition;
  deterministicSeed: number;
  driveNumber: number;
  driveSummaries: readonly DriveSummary[];
  extraPoint: PlaceKickState;
  gameOverReason: 'clockExpired' | null;
  kickoff: KickoffState;
  openingPossession: MatchPossession;
  opponentScore: number;
  opponentTeam: TeamProfile;
  phase: MatchPhase;
  pendingScoringDriveSummary: DriveSummary | null;
  possession: MatchPossession;
  previousDriveSummary: DriveSummary | null;
  quarter: number;
  secondHalfPossession: MatchPossession;
  stats: GameStatsSnapshot;
  userScore: number;
  userTeam: TeamProfile;
}

export interface MatchRules {
  automaticExtraPointSuccessRate: number;
  difficulty: MatchDifficulty;
  puntDistanceYards: number;
  quarterDurationSeconds: number;
  seed: number;
  touchbackRules: TouchbackRules;
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
  touchbackRules: DEFAULT_TOUCHBACK_RULES,
} as const;
