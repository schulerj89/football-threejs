import type { PlayKind } from '../playbook';
import type { PlayResultType } from '../playState';
import type { MatchPossession } from '../match/MatchTypes';
import type { TeamGameStatsDelta, PlayerGameStatsDelta, SimulatedDriveStats } from './GameStatsTypes';

export type GameStatsEvent =
  | GameStatsKickoffResultEvent
  | GameStatsOpponentDriveEvent
  | GameStatsPassReleasedEvent
  | GameStatsPlaceKickResultEvent
  | GameStatsPlayEndedEvent
  | GameStatsPossessionTimeEvent
  | GameStatsPuntEvent
  | GameStatsResetEvent;

export interface GameStatsBaseEvent {
  id: string;
  type: string;
}

export interface GameStatsPassReleasedEvent extends GameStatsBaseEvent {
  offense: MatchPossession;
  passerRosterId: string | null;
  targetRosterId: string | null;
  type: 'passReleased';
}

export interface GameStatsPlayEndedEvent extends GameStatsBaseEvent {
  carrierRosterId: string | null;
  defense: MatchPossession;
  downBefore: number;
  firstDown: boolean;
  offense: MatchPossession;
  passAttemptAlreadyRecorded: boolean;
  passAttempted: boolean;
  passCompleted: boolean;
  passerRosterId: string | null;
  playKind: PlayKind;
  receiverRosterId: string | null;
  resultType: PlayResultType;
  sackerRosterId: string | null;
  tacklerRosterId: string | null;
  targetRosterId: string | null;
  touchdown: boolean;
  type: 'playEnded';
  yardsGained: number;
  yardsToFirstDownBefore: number;
}

export interface GameStatsKickoffResultEvent extends GameStatsBaseEvent {
  kickerRosterId: string | null;
  kickingTeam: MatchPossession;
  receivingTeam: MatchPossession;
  returnTouchdown: boolean;
  returnYards: number;
  returnerRosterId: string | null;
  touchback: boolean;
  type: 'kickoffResult';
}

export interface GameStatsPlaceKickResultEvent extends GameStatsBaseEvent {
  distanceYards: number;
  good: boolean;
  kickerRosterId: string | null;
  kind: 'fieldGoal' | 'pat';
  team: MatchPossession;
  type: 'placeKickResult';
}

export interface GameStatsPuntEvent extends GameStatsBaseEvent {
  punterRosterId: string | null;
  puntYards: number;
  team: MatchPossession;
  type: 'punt';
}

export interface GameStatsPossessionTimeEvent extends GameStatsBaseEvent {
  seconds: number;
  team: MatchPossession;
  type: 'possessionTime';
}

export interface GameStatsOpponentDriveEvent extends GameStatsBaseEvent {
  stats: SimulatedDriveStats;
  team: MatchPossession;
  type: 'opponentDrive';
}

export interface GameStatsResetEvent extends GameStatsBaseEvent {
  type: 'reset';
}

export function createTeamDeltaEventDescription(
  teamDelta: TeamGameStatsDelta,
  playerDeltas: readonly PlayerGameStatsDelta[] = [],
): string {
  const teamKeys = Object.keys(teamDelta).length;
  return `${teamKeys} team deltas, ${playerDeltas.length} player deltas`;
}

