import type { Vector3 } from '../ballModel';
import type { FieldBounds } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { MatchDifficulty, MatchPossession } from '../match/MatchTypes';
import type { GameplaySnapshot } from '../playState';
import type { PlayerRole, PlayerTeam } from '../playerModel';
import type {
  FootballPlayerVisualPosition,
  FootballPlayerVisualTeamSide,
} from '../presentation/players/FootballPlayerVisualFactory';
import type { FOOTBALL_PLAYER_VISUAL_PROFILE_ID } from '../presentation/players/FootballPlayerVisualFactory';
import type { KickerRatings } from './KickerRatings';
import type { KickoffDirection } from './KickoffTypes';

export type PlaceKickReason = 'extraPoint' | 'fieldGoal';
export type PlaceKickResultReason = 'good' | 'short' | 'wideLeft' | 'wideRight';
export type PlaceKickPresentationPhase =
  | 'completed'
  | 'contact'
  | 'flight'
  | 'formation'
  | 'idle'
  | 'meter'
  | 'result'
  | 'runUp'
  | 'set'
  | 'snap';

export interface PlaceKickTimingInput {
  confirmedAtSeconds: number;
  normalizedValue: number;
}

export interface PlaceKickResult {
  apexHeight: number;
  flightSeconds: number;
  goalPlanePosition: Vector3;
  good: boolean;
  kickAngleRadians: number;
  origin: FootballSpot;
  reason: PlaceKickResultReason;
  target: FootballSpot;
  timingInput: PlaceKickTimingInput;
}

export interface PlaceKickState {
  ballPlacement: FootballSpot;
  completed: boolean;
  defendingTeam: MatchPossession | null;
  direction: KickoffDirection;
  holderRosterId: string | null;
  holderSpot: FootballSpot;
  kickerRatings: KickerRatings | null;
  kickerRosterId: string | null;
  kickingTeam: MatchPossession | null;
  phase: PlaceKickPresentationPhase;
  reason: PlaceKickReason | null;
  result: PlaceKickResult | null;
  sequenceIndex: number;
  snapSpot: FootballSpot;
}

export interface PlaceKickSimulationInput {
  difficulty: MatchDifficulty;
  direction: KickoffDirection;
  kickAccuracy: number;
  kickerRosterId: string;
  kickPower: number;
  matchSeed: number;
  sequenceIndex: number;
  timingInput: PlaceKickTimingInput;
}

export interface PlaceKickFormationParticipantPlacement {
  appearanceId: string;
  facingRadians: number;
  footballPosition: FootballPlayerVisualPosition;
  gameplayTeam: PlayerTeam;
  jerseyNumber: number;
  phase: 'defense' | 'protection';
  position: FootballSpot;
  presentationOnly: true;
  role: PlayerRole;
  rosterPlayerId: string;
  scale: number;
  slotId: string;
  team: MatchPossession;
  teamSide: FootballPlayerVisualTeamSide;
  visualId: string;
  visualProfileId: typeof FOOTBALL_PLAYER_VISUAL_PROFILE_ID;
}

export interface PlaceKickFormationLayout {
  ballPlacement: FootballSpot | null;
  bounds: FieldBounds | null;
  family: 'placeKick';
  noGameplayAuthority: true;
  participants: readonly PlaceKickFormationParticipantPlacement[];
  placements: readonly PlaceKickFormationParticipantPlacement[];
}

export interface PlaceKickFrameSnapshot {
  animationProgress: number;
  ballPosition: Vector3 | null;
  completed: boolean;
  defendingParticipantCount: number;
  defendingTeam: MatchPossession | null;
  direction: KickoffDirection | null;
  formationBounds: FieldBounds | null;
  formationFamily: 'placeKick' | null;
  formationValidation: readonly string[];
  good: boolean | null;
  helmetReadyCount: number;
  holderRosterId: string | null;
  kickerVisualPosition: Vector3 | null;
  kickerRosterId: string | null;
  kickingParticipantCount: number;
  kickingTeam: MatchPossession | null;
  meterActive: boolean;
  nextStage: 'kickoff' | null;
  participantCount: number;
  phase: PlaceKickPresentationPhase;
  result: PlaceKickResult | null;
  resultAnnouncerAssetId: string | null;
  resultMessage: string | null;
  resultWhistleAssetId: string | null;
  rosterBindings: readonly {
    rosterPlayerId: string;
    slotId: string;
    team: MatchPossession;
    visualId: string;
  }[];
  sequenceIndex: number | null;
  playedResultAnnouncer: boolean;
  playedResultWhistle: boolean;
  stageVisibility: {
    officialsVisible: boolean;
    placeKickParticipantsVisible: boolean;
    scrimmagePlayersVisible: boolean;
  };
  visualProfile: {
    bareHeadCount: number;
    fullFootballPlayerVisualCount: number;
    presentationOnlyCount: number;
    profileId: typeof FOOTBALL_PLAYER_VISUAL_PROFILE_ID;
    profileMatchCount: number;
  };
}

export interface PlaceKickFrameResult {
  completed: boolean;
  timingInput: PlaceKickTimingInput | null;
}

export interface PlaceKickPresentationContext {
  deltaSeconds: number;
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: {
    deterministicSeed: number;
    extraPoint: PlaceKickState;
  } | null;
}
