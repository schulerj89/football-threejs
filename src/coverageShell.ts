import { createCenterSnapPlacement, type SnapPlacement } from './ballSpotting';
import { FIELD_DIRECTION, PLAYABLE_FIELD_BOUNDS } from './fieldSpec';
import type { FootballSpot } from './fieldScale';
import {
  resolveFormation,
  type ResolvedFormation,
  type ResolvedFormationSlot,
} from './formationLayout';
import type { PlayerModel } from './playerModel';
import type { PlayDefinition } from './playbook';

export type CoverageShell = 'man' | 'cover2Zone';
export type CoverageZoneKind = 'deepHalf' | 'deepMiddle' | 'flat' | 'hookCurl';

export interface CoverageZone {
  anchor: CoverageZoneAnchor;
  defenderId: string;
  footballPoints: FootballSpot[];
  kind: CoverageZoneKind;
  label: string;
  landmark: FootballSpot;
}

export interface CoverageZoneAnchor {
  formationPosition: FootballSpot;
  playerId: string;
  position: FootballSpot;
  source: 'formation' | 'player';
}

export interface ResolveCoverageZonesOptions {
  formation?: ResolvedFormation;
  playerPositions?: ReadonlyMap<string, FootballSpot>;
}

type CoverageZoneShape = Omit<CoverageZone, 'anchor'>;

export const COVERAGE_SHELL_CONFIG = {
  flatDepthEndYards: 10,
  flatDepthStartYards: 2,
  hookDepthEndYards: 13,
  hookDepthStartYards: 5,
  deepDepthEndYards: 26,
  deepDepthStartYards: 12,
  outsideFlatStartYards: 14,
  outsideFlatEndYards: 26,
  hookHalfWidthYards: 8,
  deepHalfWidthYards: 26,
  minimumThreatInfluenceYards: 0.25,
  threatInfluence: 0.45,
  zoneHoldRadiusYards: 0.55,
  zonePatrolSpeedMultiplier: 0.72,
} as const;

const LEFT_ZONE_DEFENDER_IDS = new Set([
  'defense-corner-left',
  'defense-cover-wr',
]);

const RIGHT_ZONE_DEFENDER_IDS = new Set([
  'defense-corner-right',
]);

const LEFT_HOOK_DEFENDER_IDS = new Set([
  'defense-linebacker-left',
  'defense-linebacker',
  'defense-cover-rb',
]);

const RIGHT_HOOK_DEFENDER_IDS = new Set([
  'defense-linebacker-right',
]);

export function resolveCoverageShell(play: PlayDefinition): CoverageShell {
  if (play.kind !== 'pass') {
    return 'man';
  }

  return play.pass?.coverageShell ?? 'cover2Zone';
}

export function resolveCoverageZones(
  play: PlayDefinition,
  snapPlacement: SnapPlacement = createCenterSnapPlacement({ x: 0, z: 0 }),
  options: ResolveCoverageZonesOptions = {},
): CoverageZone[] {
  if (resolveCoverageShell(play) !== 'cover2Zone') {
    return [];
  }

  const formation = options.formation ?? resolveFormation(play, snapPlacement);
  const coverageSlots = formation.slots.filter((slot) =>
    slot.team === 'defense' && slot.role === 'coverageDefender');
  const hasStrongSafety = coverageSlots.some((slot) => slot.id === 'defense-safety-strong');

  return coverageSlots.flatMap((slot) => {
    const zone = resolveCoverageZoneForSlot(slot, snapPlacement, formation.fieldSide, hasStrongSafety);
    return zone
      ? [anchorCoverageZone(zone, slot, options.playerPositions?.get(slot.id))]
      : [];
  });
}

export function getCoverageZoneForDefender(
  play: PlayDefinition,
  defenderId: string,
  snapPlacement: SnapPlacement,
): CoverageZone | null {
  return resolveCoverageZones(play, snapPlacement)
    .find((zone) => zone.defenderId === defenderId) ?? null;
}

export function resolveCoverageZoneTarget(
  defender: PlayerModel,
  players: readonly PlayerModel[],
  zone: CoverageZone,
): FootballSpot {
  const threat = findNearestThreatInZone(players, zone);

  if (!threat) {
    return { ...zone.landmark };
  }

  const target = {
    x: zone.landmark.x + (threat.position.x - zone.landmark.x) * COVERAGE_SHELL_CONFIG.threatInfluence,
    z: zone.landmark.z + (threat.position.z - zone.landmark.z) * COVERAGE_SHELL_CONFIG.threatInfluence,
  };

  if (
    Math.hypot(
      target.x - zone.landmark.x,
      target.z - zone.landmark.z,
    ) < COVERAGE_SHELL_CONFIG.minimumThreatInfluenceYards
  ) {
    return { ...zone.landmark };
  }

  return clampToZone(target, zone, defender.collisionRadius);
}

export function isPointInsideCoverageZone(point: FootballSpot, zone: CoverageZone): boolean {
  const { minX, maxX, minZ, maxZ } = getZoneBounds(zone);

  return point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ;
}

function resolveCoverageZoneForSlot(
  slot: ResolvedFormationSlot,
  snapPlacement: SnapPlacement,
  fieldSide: 'left' | 'right',
  hasStrongSafety: boolean,
): CoverageZoneShape | null {
  if (LEFT_ZONE_DEFENDER_IDS.has(slot.id)) {
    return createFlatZone(slot.id, 'left', snapPlacement);
  }

  if (RIGHT_ZONE_DEFENDER_IDS.has(slot.id)) {
    return createFlatZone(slot.id, 'right', snapPlacement);
  }

  if (slot.id === 'defense-safety') {
    return hasStrongSafety
      ? createDeepHalfZone(slot.id, fieldSide === 'left' ? 'left' : 'right', snapPlacement)
      : createDeepMiddleZone(slot.id, snapPlacement);
  }

  if (slot.id === 'defense-safety-strong') {
    return createHookCurlZone(slot.id, fieldSide === 'left' ? 'right' : 'left', snapPlacement);
  }

  if (LEFT_HOOK_DEFENDER_IDS.has(slot.id)) {
    return createHookCurlZone(slot.id, slot.position.x <= snapPlacement.spot.x ? 'left' : 'right', snapPlacement);
  }

  if (RIGHT_HOOK_DEFENDER_IDS.has(slot.id)) {
    return createHookCurlZone(slot.id, slot.position.x <= snapPlacement.spot.x ? 'left' : 'right', snapPlacement);
  }

  return slot.position.x < snapPlacement.spot.x
    ? createHookCurlZone(slot.id, 'left', snapPlacement)
    : createHookCurlZone(slot.id, 'right', snapPlacement);
}

function createFlatZone(
  defenderId: string,
  side: 'left' | 'right',
  snapPlacement: SnapPlacement,
): CoverageZoneShape {
  const { minX, maxX } = resolveSnapRelativeBounds(
    snapPlacement,
    side,
    COVERAGE_SHELL_CONFIG.outsideFlatStartYards,
    COVERAGE_SHELL_CONFIG.outsideFlatEndYards,
  );
  const minZ = depthFromLine(snapPlacement, COVERAGE_SHELL_CONFIG.flatDepthStartYards);
  const maxZ = depthFromLine(snapPlacement, COVERAGE_SHELL_CONFIG.flatDepthEndYards);

  return createZone(defenderId, 'flat', `C2 ${side} flat`, minX, maxX, minZ, maxZ);
}

function createHookCurlZone(
  defenderId: string,
  side: 'left' | 'right',
  snapPlacement: SnapPlacement,
): CoverageZoneShape {
  const direction = side === 'left' ? -1 : 1;
  const { minX, maxX } = resolveSnapRelativeBounds(
    snapPlacement,
    side,
    0,
    COVERAGE_SHELL_CONFIG.hookHalfWidthYards * 2,
  );
  const minZ = depthFromLine(snapPlacement, COVERAGE_SHELL_CONFIG.hookDepthStartYards);
  const maxZ = depthFromLine(snapPlacement, COVERAGE_SHELL_CONFIG.hookDepthEndYards);
  const label = direction < 0 ? 'C2 left hook' : 'C2 right hook';

  return createZone(defenderId, 'hookCurl', label, minX, maxX, minZ, maxZ);
}

function createDeepHalfZone(
  defenderId: string,
  side: 'left' | 'right',
  snapPlacement: SnapPlacement,
): CoverageZoneShape {
  const { minX, maxX } = resolveSnapRelativeBounds(
    snapPlacement,
    side,
    0,
    COVERAGE_SHELL_CONFIG.deepHalfWidthYards,
  );
  const minZ = depthFromLine(snapPlacement, COVERAGE_SHELL_CONFIG.deepDepthStartYards);
  const maxZ = depthFromLine(snapPlacement, COVERAGE_SHELL_CONFIG.deepDepthEndYards);

  return createZone(defenderId, 'deepHalf', `C2 ${side} half`, minX, maxX, minZ, maxZ);
}

function createDeepMiddleZone(
  defenderId: string,
  snapPlacement: SnapPlacement,
): CoverageZoneShape {
  const minX = snapPlacement.spot.x - COVERAGE_SHELL_CONFIG.deepHalfWidthYards;
  const maxX = snapPlacement.spot.x + COVERAGE_SHELL_CONFIG.deepHalfWidthYards;
  const minZ = depthFromLine(snapPlacement, COVERAGE_SHELL_CONFIG.deepDepthStartYards);
  const maxZ = depthFromLine(snapPlacement, COVERAGE_SHELL_CONFIG.deepDepthEndYards);

  return createZone(defenderId, 'deepMiddle', 'C2 deep middle', minX, maxX, minZ, maxZ);
}

function createZone(
  defenderId: string,
  kind: CoverageZoneKind,
  label: string,
  minX: number,
  maxX: number,
  firstZ: number,
  secondZ: number,
): CoverageZoneShape {
  const minZ = Math.min(firstZ, secondZ);
  const maxZ = Math.max(firstZ, secondZ);
  const clampedMinX = Math.max(PLAYABLE_FIELD_BOUNDS.minX, Math.min(minX, maxX));
  const clampedMaxX = Math.min(PLAYABLE_FIELD_BOUNDS.maxX, Math.max(minX, maxX));
  const clampedMinZ = Math.max(PLAYABLE_FIELD_BOUNDS.minZ, minZ);
  const clampedMaxZ = Math.min(PLAYABLE_FIELD_BOUNDS.maxZ, maxZ);
  const footballPoints = [
    { x: clampedMinX, z: clampedMinZ },
    { x: clampedMaxX, z: clampedMinZ },
    { x: clampedMaxX, z: clampedMaxZ },
    { x: clampedMinX, z: clampedMaxZ },
  ];

  return {
    defenderId,
    footballPoints,
    kind,
    label,
    landmark: {
      x: (clampedMinX + clampedMaxX) / 2,
      z: (clampedMinZ + clampedMaxZ) / 2,
    },
  };
}

function anchorCoverageZone(
  zone: CoverageZoneShape,
  slot: ResolvedFormationSlot,
  playerPosition: FootballSpot | undefined,
): CoverageZone {
  const anchorPosition = playerPosition
    ? { ...playerPosition }
    : { ...slot.position };
  const offset = {
    x: anchorPosition.x - slot.position.x,
    z: anchorPosition.z - slot.position.z,
  };

  return {
    ...zone,
    anchor: {
      formationPosition: { ...slot.position },
      playerId: slot.id,
      position: anchorPosition,
      source: playerPosition ? 'player' : 'formation',
    },
    footballPoints: zone.footballPoints.map((point) => ({
      x: point.x + offset.x,
      z: point.z + offset.z,
    })),
    landmark: {
      x: zone.landmark.x + offset.x,
      z: zone.landmark.z + offset.z,
    },
  };
}

function resolveSnapRelativeBounds(
  snapPlacement: SnapPlacement,
  side: 'left' | 'right',
  nearOffsetYards: number,
  farOffsetYards: number,
): { minX: number; maxX: number } {
  const direction = side === 'left' ? -1 : 1;
  const nearX = snapPlacement.spot.x + direction * nearOffsetYards;
  const farX = snapPlacement.spot.x + direction * farOffsetYards;

  return {
    minX: Math.min(nearX, farX),
    maxX: Math.max(nearX, farX),
  };
}

function depthFromLine(snapPlacement: SnapPlacement, yards: number): number {
  return snapPlacement.spot.z + yards * FIELD_DIRECTION.playDirectionZ;
}

function findNearestThreatInZone(
  players: readonly PlayerModel[],
  zone: CoverageZone,
): PlayerModel | null {
  const receiversInZone = players.filter((player) =>
    player.team === 'offense' &&
    player.role === 'receiver' &&
    isPointInsideCoverageZone(player.position, zone));
  let nearestThreat: PlayerModel | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const receiver of receiversInZone) {
    const distance = Math.hypot(
      receiver.position.x - zone.landmark.x,
      receiver.position.z - zone.landmark.z,
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestThreat = receiver;
    }
  }

  return nearestThreat;
}

function clampToZone(
  point: FootballSpot,
  zone: CoverageZone,
  paddingYards: number,
): FootballSpot {
  const { minX, maxX, minZ, maxZ } = getZoneBounds(zone);

  return {
    x: clamp(point.x, minX + paddingYards, maxX - paddingYards),
    z: clamp(point.z, minZ + paddingYards, maxZ - paddingYards),
  };
}

function getZoneBounds(zone: CoverageZone): {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
} {
  return {
    maxX: Math.max(...zone.footballPoints.map((point) => point.x)),
    maxZ: Math.max(...zone.footballPoints.map((point) => point.z)),
    minX: Math.min(...zone.footballPoints.map((point) => point.x)),
    minZ: Math.min(...zone.footballPoints.map((point) => point.z)),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.min(max, Math.max(min, value));
}
