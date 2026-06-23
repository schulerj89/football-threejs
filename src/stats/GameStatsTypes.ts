import type { MatchPossession } from '../match/MatchTypes';

export interface TeamGameStats {
  fieldGoalsAttempted: number;
  fieldGoalsMade: number;
  firstDowns: number;
  fourthDownAttempts: number;
  fourthDownConversions: number;
  kickoffReturnYards: number;
  kickoffReturns: number;
  offensivePlays: number;
  passingAttempts: number;
  passingTouchdowns: number;
  passingYards: number;
  patAttempts: number;
  patMade: number;
  points: number;
  puntYards: number;
  punts: number;
  rushingAttempts: number;
  rushingTouchdowns: number;
  rushingYards: number;
  sacksAllowed: number;
  sacksMade: number;
  thirdDownAttempts: number;
  thirdDownConversions: number;
  timeOfPossession: number;
  totalYards: number;
  turnovers: number;
  completions: number;
}

export interface PlayerGameStats {
  attempts: number;
  completions: number;
  fieldGoalsAttempted: number;
  fieldGoalsMade: number;
  interceptions: number;
  kickoffs: number;
  longestMadeFieldGoal: number;
  longestReception: number;
  longestReturn: number;
  longestRush: number;
  passingTouchdowns: number;
  passingYards: number;
  patAttempted: number;
  patMade: number;
  receivingTouchdowns: number;
  receivingYards: number;
  receptions: number;
  returnTouchdowns: number;
  returnYards: number;
  returns: number;
  rosterPlayerId: string;
  rushingAttempts: number;
  rushingTouchdowns: number;
  rushingYards: number;
  sacks: number;
  sacksTaken: number;
  tackles: number;
  targets: number;
  team: MatchPossession;
  touchbacks: number;
  turnoversForced: number;
}

export type TeamGameStatsDelta = Partial<TeamGameStats>;

export interface PlayerGameStatsDelta {
  rosterPlayerId: string;
  stats: Partial<Omit<PlayerGameStats, 'rosterPlayerId' | 'team'>>;
  team: MatchPossession;
}

export interface SimulatedDriveStats {
  playerDeltas: readonly PlayerGameStatsDelta[];
  teamDelta: TeamGameStatsDelta;
}

export interface GameStatsEventSummary {
  accepted: boolean;
  description: string;
  eventId: string;
  team: MatchPossession | null;
  type: string;
}

export interface GameStatsSnapshot {
  duplicateSuppressionCount: number;
  invariantFailures: readonly string[];
  lastEvent: GameStatsEventSummary | null;
  players: Readonly<Record<string, PlayerGameStats>>;
  possessionSeconds: Readonly<Record<MatchPossession, number>>;
  processedEventCount: number;
  teams: Readonly<Record<MatchPossession, TeamGameStats>>;
}

export interface GameStatsState {
  duplicateSuppressionCount: number;
  invariantFailures: string[];
  lastEvent: GameStatsEventSummary | null;
  players: Record<string, PlayerGameStats>;
  possessionSeconds: Record<MatchPossession, number>;
  processedEventIds: Set<string>;
  snapshot: GameStatsSnapshot;
  teams: Record<MatchPossession, TeamGameStats>;
}

export function createZeroTeamGameStats(): TeamGameStats {
  return {
    completions: 0,
    fieldGoalsAttempted: 0,
    fieldGoalsMade: 0,
    firstDowns: 0,
    fourthDownAttempts: 0,
    fourthDownConversions: 0,
    kickoffReturnYards: 0,
    kickoffReturns: 0,
    offensivePlays: 0,
    passingAttempts: 0,
    passingTouchdowns: 0,
    passingYards: 0,
    patAttempts: 0,
    patMade: 0,
    points: 0,
    puntYards: 0,
    punts: 0,
    rushingAttempts: 0,
    rushingTouchdowns: 0,
    rushingYards: 0,
    sacksAllowed: 0,
    sacksMade: 0,
    thirdDownAttempts: 0,
    thirdDownConversions: 0,
    timeOfPossession: 0,
    totalYards: 0,
    turnovers: 0,
  };
}

export function createZeroPlayerGameStats(
  rosterPlayerId: string,
  team: MatchPossession,
): PlayerGameStats {
  return {
    attempts: 0,
    completions: 0,
    fieldGoalsAttempted: 0,
    fieldGoalsMade: 0,
    interceptions: 0,
    kickoffs: 0,
    longestMadeFieldGoal: 0,
    longestReception: 0,
    longestReturn: 0,
    longestRush: 0,
    passingTouchdowns: 0,
    passingYards: 0,
    patAttempted: 0,
    patMade: 0,
    receivingTouchdowns: 0,
    receivingYards: 0,
    receptions: 0,
    returnTouchdowns: 0,
    returnYards: 0,
    returns: 0,
    rosterPlayerId,
    rushingAttempts: 0,
    rushingTouchdowns: 0,
    rushingYards: 0,
    sacks: 0,
    sacksTaken: 0,
    tackles: 0,
    targets: 0,
    team,
    touchbacks: 0,
    turnoversForced: 0,
  };
}

