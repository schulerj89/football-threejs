import type { Vector3 } from '../ballModel';
import type { FieldBounds } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { PossessionFieldPosition } from '../match/FieldPositionModel';
import type { MatchPossession } from '../match/MatchTypes';
import type { GameplaySnapshot } from '../playState';
import type { Vector2 } from '../playerModel';
import type { KickerRatings } from './KickerRatings';
import type {
  KickReturnerAssignment,
  KickoffReturnBlockAssignment,
  KickoffReturnLane,
  KickoffReturnOutcome,
} from './KickoffReturnSimulation';

export type KickoffLandingType = 'fielded' | 'touchback';
export type KickoffReason = 'opening' | 'postScore' | 'secondHalf';
export type KickoffDirection = -1 | 1;
export type KickoffPresentationPhase =
  | 'completed'
  | 'dead'
  | 'fielding'
  | 'flight'
  | 'idle'
  | 'ready'
  | 'result'
  | 'returnLive'
  | 'runUp'
  | 'touchback';

export interface KickoffResult {
  apexHeight: number;
  flightSeconds: number;
  landingType: KickoffLandingType;
  lateralErrorYards: number;
  longitudinalErrorYards: number;
  origin: FootballSpot;
  receivingStartPosition: PossessionFieldPosition;
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
  returnResult: KickoffReturnOutcome | null;
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
}

export interface KickoffFrameSnapshot {
  activeCommentary: string | null;
  animationProgress: number;
  ballPosition: Vector3 | null;
  completed: boolean;
  direction: KickoffDirection | null;
  formationBounds: FieldBounds | null;
  formationFamily: 'kickoff' | null;
  formationValidation: readonly string[];
  assignedReturner: KickReturnerAssignment | null;
  blockerAssignments: readonly KickoffReturnBlockAssignment[];
  carrierRosterId: string | null;
  carrierVisualId: string | null;
  clockRunning: boolean;
  clockStartReason: 'legalTouch' | null;
  helmetReadyCount: number;
  kickerRosterId: string | null;
  kickingParticipantCount: number;
  kickingTeam: MatchPossession | null;
  landingType: KickoffLandingType | null;
  nextStage: 'scrimmage' | null;
  participantCount: number;
  phase: KickoffPresentationPhase;
  receivingStartPosition: PossessionFieldPosition | null;
  receivingParticipantCount: number;
  receivingTeam: MatchPossession | null;
  result: KickoffResult | null;
  returnLane: KickoffReturnLane | null;
  returnResult: KickoffReturnOutcome | null;
  reticleVisible: boolean;
  rosterBindings: readonly {
    rosterPlayerId: string;
    slotId: string;
    team: MatchPossession;
    visualId: string;
  }[];
  sequenceIndex: number | null;
  stageEntryConstructionMs: number;
  stageVisibility: {
    kickoffParticipantsVisible: boolean;
    officialsVisible: boolean;
    scrimmagePlayersVisible: boolean;
  };
  visualProfile: {
    bareHeadCount: number;
    fullFootballPlayerVisualCount: number;
    presentationOnlyCount: number;
    profileId: string;
    profileMatchCount: number;
  };
}

export interface KickoffFrameResult {
  completed: boolean;
  clockRunning: boolean;
  returnResult: KickoffReturnOutcome | null;
}

export interface KickoffPresentationContext {
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: {
    deterministicSeed: number;
    kickoff: KickoffState;
  } | null;
  userInput?: Vector2;
}
