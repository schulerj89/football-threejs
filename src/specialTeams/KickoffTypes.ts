import type { Vector3 } from '../ballModel';
import type { FootballSpot } from '../fieldScale';
import type { MatchPossession } from '../match/MatchTypes';
import type { GameplaySnapshot } from '../playState';
import type { KickerRatings } from './KickerRatings';

export type KickoffLandingType = 'fielded' | 'touchback';
export type KickoffReason = 'opening' | 'postScore' | 'secondHalf';
export type KickoffDirection = -1 | 1;
export type KickoffPresentationPhase = 'completed' | 'flight' | 'idle' | 'ready' | 'result';

export interface KickoffResult {
  apexHeight: number;
  flightSeconds: number;
  landingType: KickoffLandingType;
  lateralErrorYards: number;
  longitudinalErrorYards: number;
  origin: FootballSpot;
  receivingStartSpot: FootballSpot;
  target: FootballSpot;
  uncertaintyRadiusYards: number;
}

export interface KickoffState {
  completed: boolean;
  direction: KickoffDirection;
  kickerRatings: KickerRatings | null;
  kickerRosterId: string | null;
  kickingTeam: MatchPossession | null;
  phase: KickoffPresentationPhase;
  reason: KickoffReason | null;
  receivingTeam: MatchPossession | null;
  result: KickoffResult | null;
  sequenceIndex: number;
}

export interface KickoffSimulationInput {
  direction: KickoffDirection;
  fieldBounds: {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
  };
  kickAccuracy: number;
  kickPower: number;
  kickerRosterId: string;
  matchSeed: number;
  origin: FootballSpot;
  sequenceIndex: number;
  touchbackSpot: FootballSpot;
}

export interface KickoffFrameSnapshot {
  activeCommentary: string | null;
  animationProgress: number;
  ballPosition: Vector3 | null;
  completed: boolean;
  direction: KickoffDirection | null;
  kickerRosterId: string | null;
  kickingTeam: MatchPossession | null;
  landingType: KickoffLandingType | null;
  phase: KickoffPresentationPhase;
  receivingStartSpot: FootballSpot | null;
  receivingTeam: MatchPossession | null;
  result: KickoffResult | null;
  reticleVisible: boolean;
  sequenceIndex: number | null;
}

export interface KickoffFrameResult {
  completed: boolean;
}

export interface KickoffPresentationContext {
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: {
    deterministicSeed: number;
    kickoff: KickoffState;
  } | null;
}
