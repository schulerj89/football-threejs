import type { TeamProfile } from '../teams/TeamProfile';
import type { PlayerAttributeKey } from '../ratings/PlayerAttribute';

export const DYNASTY_SAVE_SCHEMA_VERSION = 1;
export const DYNASTY_SEASON_CORE_VERSION = 'football-js-dynasty-season-core-v1';
export const DYNASTY_DATABASE_NAME = 'football-js-dynasty';
export const DYNASTY_SAVE_STORE_NAME = 'dynasty-saves';
export const DYNASTY_ACTIVE_SAVE_KEY = 'active';

export type DynastyGameStatus = 'scheduled' | 'final';
export type DynastySaveStatus = 'active' | 'complete';
export type DynastySaveSource =
  | 'created'
  | 'indexedDB'
  | 'memoryFallback'
  | 'none';

export interface DynastyGameTeamStats {
  readonly fieldGoals: number;
  readonly giveaways: number;
  readonly offensiveYards: number;
  readonly passingYards: number;
  readonly rushingYards: number;
  readonly takeaways: number;
  readonly touchdowns: number;
}

export interface DynastyGameResult {
  readonly awayScore: number;
  readonly awayStats: DynastyGameTeamStats;
  readonly homeScore: number;
  readonly homeStats: DynastyGameTeamStats;
  readonly winnerTeamId: string;
}

export interface DynastyScheduledGame {
  readonly awayTeamId: string;
  readonly gameId: string;
  readonly homeTeamId: string;
  readonly result: DynastyGameResult | null;
  readonly status: DynastyGameStatus;
  readonly weekIndex: number;
}

export interface DynastyWeek {
  readonly games: readonly DynastyScheduledGame[];
  readonly label: string;
  readonly weekIndex: number;
}

export interface DynastyTeamRecord {
  readonly losses: number;
  readonly pointsAgainst: number;
  readonly pointsFor: number;
  readonly teamId: string;
  readonly wins: number;
}

export interface DynastyTeamSeasonStats extends DynastyGameTeamStats {
  readonly defensiveYards: number;
  readonly gamesPlayed: number;
  readonly pointsAgainst: number;
  readonly pointsFor: number;
  readonly teamId: string;
}

export interface DynastyAppliedRatingDelta {
  readonly attribute: PlayerAttributeKey;
  readonly currentValue: number;
  readonly delta: number;
  readonly projectedValue: number;
}

export interface DynastyProgressionApplication {
  readonly appliedAt: string;
  readonly currentOverall: number;
  readonly performancePoints: number;
  readonly playerId: string;
  readonly projectedOverall: number;
  readonly ratingDeltas: readonly DynastyAppliedRatingDelta[];
  readonly teamId: string;
  readonly weekIndex: number;
}

export interface DynastySeason {
  readonly progressionApplications: readonly DynastyProgressionApplication[];
  readonly seasonId: string;
  readonly standings: readonly DynastyTeamRecord[];
  readonly teamIds: readonly string[];
  readonly teamStats: readonly DynastyTeamSeasonStats[];
  readonly weeks: readonly DynastyWeek[];
  readonly year: number;
}

export interface DynastySaveData {
  readonly createdAt: string;
  readonly currentSeason: DynastySeason;
  readonly currentWeekIndex: number;
  readonly modeVersion: typeof DYNASTY_SEASON_CORE_VERSION;
  readonly saveId: string;
  readonly schemaVersion: typeof DYNASTY_SAVE_SCHEMA_VERSION;
  readonly seed: string;
  readonly status: DynastySaveStatus;
  readonly updatedAt: string;
  readonly userTeamId: string;
}

export interface StoredDynastySaveRecord {
  readonly key: typeof DYNASTY_ACTIVE_SAVE_KEY;
  readonly modeVersion: typeof DYNASTY_SEASON_CORE_VERSION;
  readonly payload: DynastySaveData;
  readonly savedAt: string;
  readonly schemaVersion: typeof DYNASTY_SAVE_SCHEMA_VERSION;
}

export interface DynastySeasonCoreInput {
  readonly createdAt?: string;
  readonly seasonYear?: number;
  readonly seed: string;
  readonly teams: readonly Pick<TeamProfile, 'id'>[];
  readonly userTeamId: string;
}
