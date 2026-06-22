import type { FieldBounds } from '../../fieldSpec';
import type { PlayerTeam } from '../../playerModel';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';

export type SidelineDensity = 'high' | 'low' | 'medium';
export type SidelineTeamSide = 'opponent' | 'user';
export type SidelineZoneId =
  | 'opponent-sideline'
  | 'opponent-tunnel'
  | 'user-sideline'
  | 'user-tunnel';
export type SidelinePoseId =
  | 'armsLow'
  | 'crouched'
  | 'handsOnHips'
  | 'neutral'
  | 'slightLean';

export interface SidelinePresentationSettings {
  density: SidelineDensity;
  enabled: boolean;
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
  id: string;
  position: SidelineVec3;
  pose: SidelinePoseId;
  scale: number;
  team: PlayerTeam;
  teamSide: SidelineTeamSide;
  zoneId: SidelineZoneId;
}

export interface SidelineLayout {
  allPlacements: readonly SidelinePlayerPlacement[];
  protectedFieldBounds: FieldBounds;
  sidelinePlacements: readonly SidelinePlayerPlacement[];
  tunnelPlacements: readonly SidelinePlayerPlacement[];
  zones: readonly SidelineZone[];
}

export interface SidelineLayoutOptions {
  density: SidelineDensity;
  featuredTunnelTeamSide?: SidelineTeamSide;
  rosterAppearanceIds?: Partial<Record<SidelineTeamSide, readonly string[]>>;
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
  density: SidelineDensity;
  enabled: boolean;
  noGameplayAuthority: boolean;
  sidelinePlayerCount: number;
  teamKey: string;
  tunnelPlayerCount: number;
  tunnelTableauEnabled: boolean;
  updateFrequencyHz: number;
  zones: readonly SidelineZone[];
}

export interface SidelineVisualTheme {
  teamKey: string;
  theme: TeamPresentationTheme;
}
