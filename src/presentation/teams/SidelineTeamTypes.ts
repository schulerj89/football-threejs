import type { FieldBounds } from '../../fieldSpec';
import type { PlayerRole, PlayerTeam } from '../../playerModel';
import type { FootballPosition } from '../../roster/RosterPlayer';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';

export type SidelineDensity = 'high' | 'low' | 'medium';
export type SidelineCoachState =
  | 'disappointedResult'
  | 'firstDownApproval'
  | 'neutral'
  | 'touchdownCelebration'
  | 'watchingPlay';
export type SidelineReactionState =
  | 'disappointed'
  | 'firstDown'
  | 'idle'
  | 'touchdown'
  | 'watching';
export type SidelineTeamSide = 'opponent' | 'user';
export type SidelineZoneId =
  | 'opponent-sideline'
  | 'opponent-tunnel'
  | 'user-sideline'
  | 'user-tunnel';
export type SidelinePoseId =
  | 'armsLow'
  | 'celebrating'
  | 'crouched'
  | 'disappointed'
  | 'handsOnHips'
  | 'neutral'
  | 'slightLean'
  | 'standing';

export interface SidelinePresentationSettings {
  coachesEnabled: boolean;
  density: SidelineDensity;
  enabled: boolean;
  sidelinePlayersEnabled: boolean;
  tunnelTableauEnabled: boolean;
}

export interface SidelineVec3 {
  x: number;
  y: number;
  z: number;
}

export interface SidelineZone {
  bounds: FieldBounds;
  center: SidelineVec3;
  id: SidelineZoneId;
  teamSide: SidelineTeamSide;
}

export interface SidelinePlayerPlacement {
  appearanceId: string;
  facingRadians: number;
  footballPosition?: FootballPosition;
  id: string;
  jerseyNumber?: number;
  position: SidelineVec3;
  pose: SidelinePoseId;
  role?: PlayerRole;
  rosterPlayerId?: string;
  scale: number;
  team: PlayerTeam;
  teamSide: SidelineTeamSide;
  zoneId: SidelineZoneId;
}

export interface SidelineCoachPlacement {
  appearanceId: string;
  facingRadians: number;
  id: string;
  position: SidelineVec3;
  scale: number;
  state: SidelineCoachState;
  team: PlayerTeam;
  teamSide: SidelineTeamSide;
  zoneId: SidelineZoneId;
}

export interface SidelineLayout {
  allPlacements: readonly SidelinePlayerPlacement[];
  coachPlacements: readonly SidelineCoachPlacement[];
  protectedFieldBounds: FieldBounds;
  sidelinePlacements: readonly SidelinePlayerPlacement[];
  tunnelPlacements: readonly SidelinePlayerPlacement[];
  zones: readonly SidelineZone[];
}

export interface SidelineRosterIdentity {
  appearanceId: string;
  footballPosition: FootballPosition;
  jerseyNumber: number;
  role: PlayerRole;
  rosterPlayerId: string;
}

export interface SidelineLayoutOptions {
  coachesEnabled?: boolean;
  density: SidelineDensity;
  featuredTunnelTeamSide?: SidelineTeamSide;
  rosterAppearanceIds?: Partial<Record<SidelineTeamSide, readonly string[]>>;
  rosterIdentities?: Partial<Record<SidelineTeamSide, readonly SidelineRosterIdentity[]>>;
  sidelinePlayersEnabled?: boolean;
  tunnelTableauEnabled: boolean;
}

export interface SidelineVisualMetrics {
  drawCalls: number;
  geometryCount: number;
  instanceBufferBytes: number;
  materialCount: number;
  meshCount: number;
  textureCount: number;
  triangleCount: number;
}

export interface SidelineTeamControllerSnapshot extends SidelineVisualMetrics {
  coachCount: number;
  coachesEnabled: boolean;
  coachStates: readonly {
    id: string;
    state: SidelineCoachState;
    teamSide: SidelineTeamSide;
  }[];
  density: SidelineDensity;
  enabled: boolean;
  lastReactionEventId: string | null;
  noGameplayAuthority: boolean;
  reactionState: SidelineReactionState;
  semanticTargets: {
    opponentCoach: SidelineVec3 | null;
    opponentSidelineGroup: SidelineVec3 | null;
    userCoach: SidelineVec3 | null;
    userSidelineGroup: SidelineVec3 | null;
  };
  sidelineRosterPlayerIds: readonly string[];
  sidelinePlayerCount: number;
  sidelinePlayersEnabled: boolean;
  teamKey: string;
  fullFootballPlayerVisualCount: number;
  tunnelRosterPlayerIds: readonly string[];
  tunnelPlayerCount: number;
  tunnelTableauEnabled: boolean;
  updateFrequencyHz: number;
  zones: readonly SidelineZone[];
}

export interface SidelineVisualTheme {
  teamKey: string;
  theme: TeamPresentationTheme;
}
