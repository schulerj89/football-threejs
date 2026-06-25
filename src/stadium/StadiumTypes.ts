export type StadiumSectionId =
  | 'cornerFarLeft'
  | 'cornerFarRight'
  | 'cornerNearLeft'
  | 'cornerNearRight'
  | 'endZoneFar'
  | 'endZoneNear'
  | 'sidelineLeft'
  | 'sidelineRight';

export type StadiumTextureRole =
  | 'concourseWall'
  | 'entryTunnel'
  | 'fasciaBand'
  | 'scoreboardScreen';

export type StadiumThemeId = 'classicBowl' | 'mountainBowl';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 extends Vec2 {
  y: number;
}

export interface StadiumBounds {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

export interface StadiumTierSpec {
  baseElevation: number;
  baseOffset: number;
  id: string;
  rowCount: number;
}

export interface StadiumTunnelSpec {
  centerDistanceAlongSection: number;
  id: string;
  sectionId: StadiumSectionId;
  width: number;
}

export interface StadiumSpec {
  aisleSpacing: number;
  cameraClearance: number;
  concourseHeight: number;
  cornerRadius: number;
  endZoneApron: number;
  exteriorWallHeight: number;
  fasciaHeight: number;
  fieldClearance: number;
  innerBowlDepth: number;
  innerBowlWidth: number;
  protectedFieldBounds: StadiumBounds;
  rowDepth: number;
  rowRise: number;
  rowsPerTier: number;
  scoreboardPosition: Vec3;
  seatSpacing: number;
  sidelineApron: number;
  tierCount: number;
  tierSeparation: number;
  tiers: readonly StadiumTierSpec[];
  tunnels: readonly StadiumTunnelSpec[];
}

export interface StadiumPathSample {
  center: Vec2;
  distanceAlongPath: number;
  distanceAlongSection: number;
  normal: Vec2;
  sectionId: StadiumSectionId;
  tangent: Vec2;
}

export interface StadiumPathSegment {
  end: Vec2;
  id: StadiumSectionId;
  length: number;
  start: Vec2;
  startDistance: number;
  type: 'arc' | 'line';
}

export interface StadiumPath {
  halfDepth: number;
  halfWidth: number;
  perimeterLength: number;
  segments: readonly StadiumPathSegment[];
}

export interface StadiumRowLayout {
  elevation: number;
  globalRow: number;
  offset: number;
  row: number;
  tier: number;
  tierId: string;
}

export interface SeatTransform {
  facingRadians: number;
  lod: 'far' | 'near';
  position: Vec3;
  row: number;
  scale: number;
  seatIndex: number;
  sectionId: StadiumSectionId;
  tier: number;
}

export interface SeatLayout {
  rows: readonly StadiumRowLayout[];
  seats: readonly SeatTransform[];
  seatCountBySection: Readonly<Record<StadiumSectionId, number>>;
  spec: StadiumSpec;
}

export interface StadiumGeometryMetrics {
  drawCalls: number;
  geometryCount: number;
  materialCount: number;
  seatCount: number;
  textureCount: number;
  triangles: number;
}

export interface StadiumControllerSnapshot extends StadiumGeometryMetrics {
  enabled: boolean;
  imageMaterialsEnabled: boolean;
  lowerTierRows: number;
  mountainBowl: MountainBowlBackdropSnapshot | null;
  themeId: StadiumThemeId;
  upperTierEnabled: boolean;
}

export interface MountainBowlBackdropSnapshot {
  baseBermCount: number;
  bounds: {
    maxX: number;
    maxY: number;
    maxZ: number;
    minX: number;
    minY: number;
    minZ: number;
  };
  edgeFeathered: boolean;
  rockFacetCount: number;
  valleySkirtSegmentCount: number;
  layerCount: number;
  materialCount: number;
  peakCount: number;
  ridgeCount: number;
  scenicBounds: {
    maxX: number;
    maxY: number;
    maxZ: number;
    minX: number;
    minY: number;
    minZ: number;
  };
  ridgeNames: readonly string[];
  retainingWallPanelCount: number;
  servicePathCount: number;
  snowCapCount: number;
  terraceShelfCount: number;
  treeLineCount: number;
  triangleCount: number;
}
