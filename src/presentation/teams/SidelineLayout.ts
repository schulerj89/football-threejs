import {
  FIELD_BOUNDS,
  type FieldBounds,
} from '../../fieldSpec';
import type { PlayerTeam } from '../../playerModel';
import type {
  SidelineDensity,
  SidelineLayout,
  SidelineLayoutOptions,
  SidelinePlayerPlacement,
  SidelinePoseId,
  SidelineTeamSide,
  SidelineVec3,
  SidelineZone,
  SidelineZoneId,
} from './SidelineTeamTypes';
import { resolveTunnelAnchor } from './TunnelTableauLayout';

const SIDELINE_LAYOUT_CONFIG = {
  cameraSafeEndMargin: 14,
  rowSpacing: 1.28,
  sidelineInset: 1.9,
  sidelineZoneDepth: 72,
  sidelineZoneWidth: 6.4,
  spacing: 3.2,
} as const;

export const SIDELINE_DENSITY_COUNTS: Record<SidelineDensity, number> = {
  high: 12,
  low: 4,
  medium: 8,
} as const;

const POSES: readonly SidelinePoseId[] = [
  'neutral',
  'handsOnHips',
  'armsLow',
  'slightLean',
  'crouched',
] as const;

export function createSidelineLayout(options: SidelineLayoutOptions): SidelineLayout {
  const zones = createSidelineZones();
  const sidelinePlacements = [
    ...createSidelineTeamPlacements('user', options.density),
    ...createSidelineTeamPlacements('opponent', options.density),
  ];
  const tunnelPlacements = options.tunnelTableauEnabled
    ? createTunnelTableauPlacements({
        appearanceIds: options.rosterAppearanceIds?.[options.featuredTunnelTeamSide ?? 'user'],
        teamSide: options.featuredTunnelTeamSide ?? 'user',
      })
    : [];

  return {
    allPlacements: [...sidelinePlacements, ...tunnelPlacements],
    protectedFieldBounds: FIELD_BOUNDS,
    sidelinePlacements,
    tunnelPlacements,
    zones,
  };
}

export function createSidelineZones(): SidelineZone[] {
  const zMin = Math.max(
    FIELD_BOUNDS.minZ + SIDELINE_LAYOUT_CONFIG.cameraSafeEndMargin,
    -SIDELINE_LAYOUT_CONFIG.sidelineZoneDepth / 2,
  );
  const zMax = Math.min(
    FIELD_BOUNDS.maxZ - SIDELINE_LAYOUT_CONFIG.cameraSafeEndMargin,
    SIDELINE_LAYOUT_CONFIG.sidelineZoneDepth / 2,
  );
  const width = SIDELINE_LAYOUT_CONFIG.sidelineZoneWidth;

  return [
    createZone('user-sideline', 'user', {
      maxX: FIELD_BOUNDS.minX - SIDELINE_LAYOUT_CONFIG.sidelineInset,
      maxZ: zMax,
      minX: FIELD_BOUNDS.minX - SIDELINE_LAYOUT_CONFIG.sidelineInset - width,
      minZ: zMin,
    }),
    createZone('opponent-sideline', 'opponent', {
      maxX: FIELD_BOUNDS.maxX + SIDELINE_LAYOUT_CONFIG.sidelineInset + width,
      maxZ: zMax,
      minX: FIELD_BOUNDS.maxX + SIDELINE_LAYOUT_CONFIG.sidelineInset,
      minZ: zMin,
    }),
    createTunnelZone('user'),
    createTunnelZone('opponent'),
  ];
}

export function isSidelinePlacementInsideZone(
  placement: SidelinePlayerPlacement,
  zone: SidelineZone,
): boolean {
  return (
    placement.position.x >= zone.bounds.minX &&
    placement.position.x <= zone.bounds.maxX &&
    placement.position.z >= zone.bounds.minZ &&
    placement.position.z <= zone.bounds.maxZ
  );
}

export function isOutsideProtectedFieldBounds(
  point: { x: number; z: number },
  bounds: FieldBounds = FIELD_BOUNDS,
): boolean {
  return (
    point.x < bounds.minX ||
    point.x > bounds.maxX ||
    point.z < bounds.minZ ||
    point.z > bounds.maxZ
  );
}

export function mirrorSidelinePlacementX(
  placement: SidelinePlayerPlacement,
): SidelinePlayerPlacement {
  return {
    ...placement,
    facingRadians: -placement.facingRadians,
    position: {
      ...placement.position,
      x: -placement.position.x,
    },
  };
}

function createSidelineTeamPlacements(
  teamSide: SidelineTeamSide,
  density: SidelineDensity,
): SidelinePlayerPlacement[] {
  const count = SIDELINE_DENSITY_COUNTS[density];
  const zoneId = teamSide === 'user' ? 'user-sideline' : 'opponent-sideline';
  const zone = createSidelineZones().find((candidate) => candidate.id === zoneId);
  if (!zone) {
    return [];
  }

  const rowCount = count > 6 ? 2 : 1;
  const columns = Math.ceil(count / rowCount);
  const zStart = -((columns - 1) * SIDELINE_LAYOUT_CONFIG.spacing) / 2;
  const inwardSign = teamSide === 'user' ? 1 : -1;
  const baseX = teamSide === 'user'
    ? zone.bounds.maxX - 0.65
    : zone.bounds.minX + 0.65;
  const team = resolveGameplayTeam(teamSide);

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const position = {
      x: baseX - inwardSign * row * SIDELINE_LAYOUT_CONFIG.rowSpacing,
      y: 0,
      z: zStart + column * SIDELINE_LAYOUT_CONFIG.spacing,
    };
    return createPlacement({
      appearanceId: `sideline-${teamSide}-${index}`,
      id: `sideline-${teamSide}-${index}`,
      index,
      position,
      team,
      teamSide,
      zoneId,
    });
  });
}

function createTunnelTableauPlacements({
  appearanceIds,
  teamSide,
}: {
  appearanceIds?: readonly string[];
  teamSide: SidelineTeamSide;
}): SidelinePlayerPlacement[] {
  const zoneId = teamSide === 'user' ? 'user-tunnel' : 'opponent-tunnel';
  const zone = createSidelineZones().find((candidate) => candidate.id === zoneId);
  if (!zone) {
    return [];
  }
  const team = resolveGameplayTeam(teamSide);
  const rows = [4, 4, 3];
  const inwardSign = teamSide === 'user' ? 1 : -1;
  const centerX = teamSide === 'user' ? zone.bounds.maxX - 1.8 : zone.bounds.minX + 1.8;
  const centerZ = (zone.bounds.minZ + zone.bounds.maxZ) / 2;
  const placements: SidelinePlayerPlacement[] = [];

  rows.forEach((rowSize, rowIndex) => {
    const zStart = centerZ - ((rowSize - 1) * 1.55) / 2;
    for (let column = 0; column < rowSize; column += 1) {
      const index = placements.length;
      const appearanceId = appearanceIds?.[index] ?? `tunnel-${teamSide}-starter-${index}`;
      placements.push(createPlacement({
        appearanceId,
        id: `tunnel-${teamSide}-${index}`,
        index,
        position: {
          x: centerX - inwardSign * rowIndex * 1.45,
          y: 0,
          z: zStart + column * 1.55,
        },
        team,
        teamSide,
        zoneId,
      }));
      placements[placements.length - 1].facingRadians = resolveTunnelAnchor(teamSide).facingRadians;
    }
  });

  return placements;
}

function createPlacement({
  appearanceId,
  id,
  index,
  position,
  team,
  teamSide,
  zoneId,
}: {
  appearanceId: string;
  id: string;
  index: number;
  position: SidelineVec3;
  team: PlayerTeam;
  teamSide: SidelineTeamSide;
  zoneId: SidelineZoneId;
}): SidelinePlayerPlacement {
  const inward = teamSide === 'user' ? 1 : -1;
  return {
    appearanceId,
    facingRadians: Math.atan2(inward, 0),
    id,
    position,
    pose: POSES[index % POSES.length],
    scale: 0.86 + (stableHash(id) % 9) / 100,
    team,
    teamSide,
    zoneId,
  };
}

function createZone(
  id: SidelineZoneId,
  teamSide: SidelineTeamSide,
  bounds: FieldBounds,
): SidelineZone {
  return {
    bounds,
    center: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: 0,
      z: (bounds.minZ + bounds.maxZ) / 2,
    },
    id,
    teamSide,
  };
}

function createTunnelZone(teamSide: SidelineTeamSide): SidelineZone {
  const anchor = resolveTunnelAnchor(teamSide);
  const width = 12;
  const depth = 16;
  return createZone(
    teamSide === 'user' ? 'user-tunnel' : 'opponent-tunnel',
    teamSide,
    {
      maxX: anchor.position.x + width / 2,
      maxZ: anchor.position.z + depth / 2,
      minX: anchor.position.x - width / 2,
      minZ: anchor.position.z - depth / 2,
    },
  );
}

function resolveGameplayTeam(teamSide: SidelineTeamSide): PlayerTeam {
  return teamSide === 'user' ? 'offense' : 'defense';
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
