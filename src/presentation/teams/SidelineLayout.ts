import {
  FIELD_BOUNDS,
  type FieldBounds,
} from '../../fieldSpec';
import type { PlayerTeam } from '../../playerModel';
import type {
  SidelineDensity,
  SidelineCoachPlacement,
  SidelineLayout,
  SidelineLayoutOptions,
  SidelinePlayerPlacement,
  SidelinePoseId,
  SidelineRosterIdentity,
  SidelineTeamSide,
  SidelineVec3,
  SidelineZone,
  SidelineZoneId,
} from './SidelineTeamTypes';
import { resolveTunnelAnchor } from './TunnelTableauLayout';

const SIDELINE_LAYOUT_CONFIG = {
  cameraSafeEndMargin: 14,
  coachFieldSetback: 3.2,
  rowSpacing: 1.28,
  sidelineInset: 1.9,
  sidelineZoneDepth: 72,
  sidelineZoneWidth: 6.4,
  spacing: 3.2,
} as const;

export const SIDELINE_DENSITY_COUNTS: Record<SidelineDensity, number> = {
  high: 15,
  low: 5,
  medium: 10,
} as const;

const POSES: readonly SidelinePoseId[] = [
  'standing',
  'handsOnHips',
  'armsLow',
  'crouched',
  'slightLean',
] as const;

export function createSidelineLayout(options: SidelineLayoutOptions): SidelineLayout {
  const zones = createSidelineZones();
  const sidelinePlacements = options.sidelinePlayersEnabled === false
    ? []
    : [
        ...createSidelineTeamPlacements('user', options.density, options.rosterIdentities?.user),
        ...createSidelineTeamPlacements('opponent', options.density, options.rosterIdentities?.opponent),
      ];
  const coachPlacements = options.coachesEnabled
    ? [
        createSidelineCoachPlacement('user'),
        createSidelineCoachPlacement('opponent'),
      ]
    : [];
  const tunnelPlacements = options.tunnelTableauEnabled
    ? createTunnelTableauPlacements({
        appearanceIds: options.rosterAppearanceIds?.[options.featuredTunnelTeamSide ?? 'user'],
        identities: options.rosterIdentities?.[options.featuredTunnelTeamSide ?? 'user'],
        teamSide: options.featuredTunnelTeamSide ?? 'user',
      })
    : [];

  return {
    allPlacements: [...sidelinePlacements, ...tunnelPlacements],
    coachPlacements,
    protectedFieldBounds: FIELD_BOUNDS,
    sidelinePlacements,
    tunnelPlacements,
    zones,
  };
}

function createSidelineCoachPlacement(teamSide: SidelineTeamSide): SidelineCoachPlacement {
  const zoneId = teamSide === 'user' ? 'user-sideline' : 'opponent-sideline';
  const zone = createSidelineZones().find((candidate) => candidate.id === zoneId);
  const team = resolveGameplayTeam(teamSide);
  const inward = teamSide === 'user' ? 1 : -1;
  const position = zone
    ? {
        x: teamSide === 'user'
          ? zone.bounds.maxX - SIDELINE_LAYOUT_CONFIG.coachFieldSetback
          : zone.bounds.minX + SIDELINE_LAYOUT_CONFIG.coachFieldSetback,
        y: 0,
        z: zone.center.z,
      }
    : { x: 0, y: 0, z: 0 };

  return {
    appearanceId: `head-coach-${teamSide}`,
    facingRadians: Math.atan2(inward, 0),
    id: `head-coach-${teamSide}`,
    position,
    scale: 0.92,
    state: 'neutral',
    team,
    teamSide,
    zoneId,
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
  identities?: readonly SidelineRosterIdentity[],
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
    const identity = identities?.[index % Math.max(1, identities.length)];
    return createPlacement({
      appearanceId: identity?.appearanceId ?? `sideline-${teamSide}-${index}`,
      footballPosition: identity?.footballPosition,
      id: identity ? `sideline-${teamSide}-${identity.rosterPlayerId}` : `sideline-${teamSide}-${index}`,
      index,
      jerseyNumber: identity?.jerseyNumber,
      position,
      role: identity?.role,
      rosterPlayerId: identity?.rosterPlayerId,
      team,
      teamSide,
      zoneId,
    });
  });
}

function createTunnelTableauPlacements({
  appearanceIds,
  identities,
  teamSide,
}: {
  appearanceIds?: readonly string[];
  identities?: readonly SidelineRosterIdentity[];
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
      const identity = identities?.[index];
      const appearanceId = identity?.appearanceId ??
        appearanceIds?.[index] ??
        `tunnel-${teamSide}-starter-${index}`;
      placements.push(createPlacement({
        appearanceId,
        footballPosition: identity?.footballPosition,
        id: identity ? `tunnel-${teamSide}-${identity.rosterPlayerId}` : `tunnel-${teamSide}-${index}`,
        index,
        jerseyNumber: identity?.jerseyNumber,
        position: {
          x: centerX - inwardSign * rowIndex * 1.45,
          y: 0,
          z: zStart + column * 1.55,
        },
        role: identity?.role,
        rosterPlayerId: identity?.rosterPlayerId,
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
  footballPosition,
  id,
  index,
  jerseyNumber,
  position,
  role,
  rosterPlayerId,
  team,
  teamSide,
  zoneId,
}: {
  appearanceId: string;
  footballPosition?: SidelineRosterIdentity['footballPosition'];
  id: string;
  index: number;
  jerseyNumber?: number;
  position: SidelineVec3;
  role?: SidelineRosterIdentity['role'];
  rosterPlayerId?: string;
  team: PlayerTeam;
  teamSide: SidelineTeamSide;
  zoneId: SidelineZoneId;
}): SidelinePlayerPlacement {
  const inward = teamSide === 'user' ? 1 : -1;
  return {
    appearanceId,
    facingRadians: Math.atan2(inward, 0),
    footballPosition,
    id,
    jerseyNumber,
    position,
    pose: POSES[index % POSES.length],
    role,
    rosterPlayerId,
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
