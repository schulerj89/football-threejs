import type { TeamRoster } from '../roster/TeamRoster';
import type { FootballPosition, PlayerArchetype } from '../roster/RosterPlayer';
import type { TeamProfile } from '../teams/TeamProfile';
import type { PlayerAttributeKey } from '../ratings/PlayerAttribute';

export const LEAGUE_SCHEMA_VERSION = 1;
export const LEAGUE_GENERATOR_VERSION = 'football-js-six-team-generator-v1';
export const DEFAULT_LEAGUE_SEED = 'football-js-six-team-league-v1';
export const LEAGUE_DATABASE_NAME = 'football-js-league';
export const LEAGUE_STORE_NAME = 'league-data';
export const LEAGUE_RECORD_KEY = 'current';
export const BUNDLED_LEAGUE_DATA_URL = '/data/league/league-v1.json';

export type LeagueDataSource =
  | 'bundled'
  | 'generated'
  | 'indexedDB'
  | 'memoryFallback';

export interface LeagueData {
  readonly contentHash: string;
  readonly generatorVersion: string;
  readonly schemaVersion: number;
  readonly seed: string;
  readonly teams: readonly TeamProfile[];
  readonly rosters: readonly TeamRoster[];
}

export interface CompactPlayerRecord {
  readonly id: string;
  readonly team: string;
  readonly first: string;
  readonly last: string;
  readonly number: number;
  readonly position: FootballPosition;
  readonly archetype: PlayerArchetype;
  readonly appearanceId: string;
  readonly ratings: readonly number[];
}

export interface CompactTeamRosterRecord {
  readonly defensiveStarterIds: readonly string[];
  readonly kickerId: string;
  readonly longSnapperId: string;
  readonly offensiveStarterIds: readonly string[];
  readonly players: readonly CompactPlayerRecord[];
  readonly punterId: string;
  readonly reserveIds: readonly string[];
  readonly teamId: string;
}

export interface EncodedLeagueData {
  readonly contentHash: string;
  readonly generatorVersion: string;
  readonly schemaVersion: number;
  readonly seed: string;
  readonly teams: readonly TeamProfile[];
  readonly rosters: readonly CompactTeamRosterRecord[];
}

export interface StoredLeagueRecord {
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly generatorVersion: string;
  readonly key: typeof LEAGUE_RECORD_KEY;
  readonly payload: EncodedLeagueData;
  readonly schemaVersion: number;
}

export interface LeagueInitializationSnapshot {
  readonly contentHash: string | null;
  readonly decodedEstimateBytes: number;
  readonly encodedBytes: number;
  readonly error: string | null;
  readonly generatorVersion: string;
  readonly initializationDurationMs: number;
  readonly loadingVisible: boolean;
  readonly playerCount: number;
  readonly schemaVersion: number;
  readonly seed: string;
  readonly source: LeagueDataSource | 'initializing';
  readonly stage: string;
  readonly status: 'idle' | 'initializing' | 'ready' | 'error';
  readonly teamCount: number;
}

export type AttributeOrder = readonly PlayerAttributeKey[];
