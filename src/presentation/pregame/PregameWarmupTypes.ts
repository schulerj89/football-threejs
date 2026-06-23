import type { FieldBounds } from '../../fieldSpec';
import type { PlayerTeam } from '../../playerModel';
import type { QuarterbackScoutingProfile } from '../../roster/QuarterbackScoutingProfile';
import type { RosterPlayer } from '../../roster/RosterPlayer';
import type { SidelineTeamSide } from '../teams/SidelineTeamTypes';
import type { FootballPlayerVisualReadiness } from '../players/FootballPlayerVisualFactory';

export type PregameWarmupGroupId =
  | 'offensiveLineStance'
  | 'quarterbackThrowing'
  | 'receiverWarmup'
  | 'runningBackFootwork';

export type PregameWarmupPoseId =
  | 'armsLow'
  | 'crouched'
  | 'handsOnHips'
  | 'neutral'
  | 'slightLean'
  | 'staggeredStance';

export type PregameWarmupRole =
  | 'center'
  | 'coachMarker'
  | 'cone'
  | 'football'
  | 'lineman'
  | 'quarterback'
  | 'receiver'
  | 'runningBack'
  | 'tightEnd';

export type PregameWarmupZoneId =
  | 'opponent-warmup'
  | 'user-warmup';

export interface PregameWarmupVec3 {
  x: number;
  y: number;
  z: number;
}

export interface PregameWarmupZone {
  bounds: FieldBounds;
  center: PregameWarmupVec3;
  id: PregameWarmupZoneId;
  teamSide: SidelineTeamSide;
}

export interface PregameWarmupPlacement {
  appearanceId: string;
  facingRadians: number;
  groupId: PregameWarmupGroupId;
  id: string;
  player: RosterPlayer | null;
  position: PregameWarmupVec3;
  pose: PregameWarmupPoseId;
  role: PregameWarmupRole;
  scale: number;
  team: PlayerTeam;
  teamSide: SidelineTeamSide;
  zoneId: PregameWarmupZoneId;
}

export interface PregameWarmupPropPlacement {
  facingRadians: number;
  groupId: PregameWarmupGroupId;
  id: string;
  position: PregameWarmupVec3;
  role: Extract<PregameWarmupRole, 'cone' | 'football'>;
  scale: number;
  teamSide: SidelineTeamSide;
  zoneId: PregameWarmupZoneId;
}

export interface PregameWarmupGroup {
  bounds: FieldBounds;
  groupId: PregameWarmupGroupId;
  id: string;
  placements: readonly PregameWarmupPlacement[];
  props: readonly PregameWarmupPropPlacement[];
  ready: boolean;
  teamSide: SidelineTeamSide;
}

export interface PregameWarmupLayout {
  groups: readonly PregameWarmupGroup[];
  opponentQuarterback: PregameWarmupPlacement | null;
  placements: readonly PregameWarmupPlacement[];
  props: readonly PregameWarmupPropPlacement[];
  protectedFieldBounds: FieldBounds;
  userQuarterback: PregameWarmupPlacement | null;
  zones: readonly PregameWarmupZone[];
}

export interface PregameWarmupSubjectBounds {
  center: PregameWarmupVec3;
  max: { x: number; z: number };
  min: { x: number; z: number };
  size: { x: number; z: number };
  source: string;
}

export interface PregameWarmupSnapshot {
  cloneCount: number;
  drawCalls: number;
  enabled: boolean;
  geometryCount: number;
  groupCount: number;
  groups: readonly PregameWarmupGroup[];
  instanceBufferBytes: number;
  materialCount: number;
  meshCount: number;
  noGameplayAuthority: true;
  opponentReady: boolean;
  playerCount: number;
  propCount: number;
  quarterback: {
    archetype: QuarterbackScoutingProfile['archetype'];
    appearance: PregameWarmupQuarterbackAppearanceAudit;
    bounds: PregameWarmupSubjectBounds;
    facingRadians: number;
    formattedName: string;
    jerseyNumber: number;
    ratings: QuarterbackScoutingProfile['ratings'];
    rosterPlayerId: string;
    strengths: readonly string[];
  } | null;
  ready: boolean;
  teamKey: string;
  textureCount: number;
  triangleCount: number;
  updateFrequencyHz: number;
  userReady: boolean;
  zones: readonly PregameWarmupZone[];
}

export interface PregameWarmupQuarterbackAppearanceAudit extends FootballPlayerVisualReadiness {
  rosterPlayerId: string | null;
}
