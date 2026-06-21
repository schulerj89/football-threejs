import type { SnapPlacement } from './ballSpotting';
import type { FootballSpot } from './fieldScale';
import {
  resolveFormation,
  resolveFormationTarget,
  type FormationPlayDefinition,
  type FormationPoint,
} from './formationLayout';

export interface ReceiverRouteDefinition {
  id: string;
  speedYardsPerSecond: number;
  waypoints: readonly RouteWaypointDefinition[];
}

export interface RouteWaypointDefinition {
  id: string;
  point: FormationPoint;
}

export interface ResolvedReceiverRoute {
  cumulativeLengths: readonly number[];
  id: string;
  points: readonly FootballSpot[];
  receiverId: string;
  segmentLengths: readonly number[];
  totalLength: number;
}

export interface ReceiverRouteState {
  completed: boolean;
  distanceAlongRoute: number;
  receiverId: string;
  routeId: string;
  segmentIndex: number;
}

export interface ReceiverRoutePlayDefinition extends FormationPlayDefinition {
  receiverRoutes?: Record<string, ReceiverRouteDefinition>;
}

export interface RouteProjection {
  distanceAlongRoute: number;
  distanceToRoute: number;
  point: FootballSpot;
  segmentIndex: number;
}

export interface ReceiverRouteAuditSnapshot {
  activeSegmentEnd: FootballSpot;
  activeSegmentStart: FootballSpot;
  completionPercentage: number;
  crossTrackErrorYards: number;
  distanceAlongRoute: number;
  exceedsTolerance: boolean;
  nearestPoint: FootballSpot;
  receiverId: string;
  routeId: string;
  segmentIndex: number;
  totalLength: number;
}

export const RECEIVER_ROUTE_AUDIT_CONFIG = {
  corridorToleranceYards: 0.75,
} as const;

const ROUTE_EPSILON = 0.000001;

export function resolveReceiverRoute(
  play: ReceiverRoutePlayDefinition,
  receiverId: string,
  snapPlacement: SnapPlacement,
): ResolvedReceiverRoute | null {
  const route = play.receiverRoutes?.[receiverId];

  if (!route) {
    return null;
  }

  const formation = resolveFormation(play, snapPlacement);
  const receiver = formation.slots.find((slot) => slot.id === receiverId);

  if (!receiver) {
    throw new Error(`Cannot resolve route ${route.id} for missing receiver ${receiverId}`);
  }

  const points = [
    { ...receiver.position },
    ...route.waypoints.map((waypoint) => ({
      ...resolveFormationTarget(play, waypoint.point, snapPlacement),
    })),
  ];
  const segmentLengths = calculateSegmentLengths(points);
  const cumulativeLengths = calculateCumulativeLengths(segmentLengths);
  const totalLength = cumulativeLengths[cumulativeLengths.length - 1] ?? 0;

  return {
    cumulativeLengths,
    id: route.id,
    points,
    receiverId,
    segmentLengths,
    totalLength,
  };
}

export function createReceiverRouteState(
  route: ReceiverRouteDefinition,
  receiverId: string,
): ReceiverRouteState {
  return {
    completed: false,
    distanceAlongRoute: 0,
    receiverId,
    routeId: route.id,
    segmentIndex: 0,
  };
}

export function createReceiverRouteStateMap(
  play: ReceiverRoutePlayDefinition,
): Record<string, ReceiverRouteState> {
  return Object.fromEntries(
    Object.entries(play.receiverRoutes ?? {}).map(([receiverId, route]) => [
      receiverId,
      createReceiverRouteState(route, receiverId),
    ]),
  );
}

export function resolveEligibleReceiverRoutes(
  play: ReceiverRoutePlayDefinition,
  snapPlacement: SnapPlacement,
): ResolvedReceiverRoute[] {
  const receiverIds = play.pass?.eligibleReceiverIds ?? Object.keys(play.receiverRoutes ?? {});

  return receiverIds.flatMap((receiverId) => {
    const route = resolveReceiverRoute(play, receiverId, snapPlacement);

    return route ? [route] : [];
  });
}

export function resetReceiverRouteState(
  state: ReceiverRouteState,
): void {
  state.completed = false;
  state.distanceAlongRoute = 0;
  state.segmentIndex = 0;
}

export function sampleRouteAtDistance(
  route: ResolvedReceiverRoute,
  distanceAlongRoute: number,
): FootballSpot {
  if (route.points.length === 0) {
    return { x: 0, z: 0 };
  }

  if (route.points.length === 1 || route.totalLength <= ROUTE_EPSILON) {
    return { ...route.points[0] };
  }

  const distance = clamp(distanceAlongRoute, 0, route.totalLength);
  const segmentIndex = getSegmentIndexAtDistance(route, distance);
  const segmentStartDistance = segmentIndex === 0
    ? 0
    : route.cumulativeLengths[segmentIndex - 1];
  const segmentLength = route.segmentLengths[segmentIndex] ?? 0;
  const segmentT = segmentLength <= ROUTE_EPSILON
    ? 0
    : (distance - segmentStartDistance) / segmentLength;
  const start = route.points[segmentIndex];
  const end = route.points[segmentIndex + 1] ?? start;

  return {
    x: lerp(start.x, end.x, segmentT),
    z: lerp(start.z, end.z, segmentT),
  };
}

export function getRouteTangentAtDistance(
  route: ResolvedReceiverRoute,
  distanceAlongRoute: number,
): FootballSpot {
  if (route.points.length < 2) {
    return { x: 0, z: 1 };
  }

  const segmentIndex = getSegmentIndexAtDistance(
    route,
    clamp(distanceAlongRoute, 0, route.totalLength),
  );

  for (let index = segmentIndex; index < route.segmentLengths.length; index += 1) {
    const tangent = calculateSegmentTangent(route.points[index], route.points[index + 1]);
    if (tangent) {
      return tangent;
    }
  }

  for (let index = segmentIndex - 1; index >= 0; index -= 1) {
    const tangent = calculateSegmentTangent(route.points[index], route.points[index + 1]);
    if (tangent) {
      return tangent;
    }
  }

  return { x: 0, z: 1 };
}

export function projectPointOntoRoute(
  route: ResolvedReceiverRoute,
  point: FootballSpot,
): RouteProjection {
  if (route.points.length === 0) {
    return {
      distanceAlongRoute: 0,
      distanceToRoute: 0,
      point: { x: 0, z: 0 },
      segmentIndex: 0,
    };
  }

  if (route.points.length === 1) {
    return {
      distanceAlongRoute: 0,
      distanceToRoute: distanceBetween(point, route.points[0]),
      point: { ...route.points[0] },
      segmentIndex: 0,
    };
  }

  let bestProjection: RouteProjection | null = null;
  let distanceBeforeSegment = 0;

  for (let segmentIndex = 0; segmentIndex < route.segmentLengths.length; segmentIndex += 1) {
    const start = route.points[segmentIndex];
    const end = route.points[segmentIndex + 1];
    const projection = projectPointOntoSegment(point, start, end);
    const distanceAlongRoute =
      distanceBeforeSegment + projection.segmentT * route.segmentLengths[segmentIndex];
    const candidate = {
      distanceAlongRoute,
      distanceToRoute: distanceBetween(point, projection.point),
      point: projection.point,
      segmentIndex,
    };

    if (!bestProjection || candidate.distanceToRoute < bestProjection.distanceToRoute) {
      bestProjection = candidate;
    }

    distanceBeforeSegment += route.segmentLengths[segmentIndex];
  }

  return bestProjection!;
}

export function calculateCrossTrackError(
  route: ResolvedReceiverRoute,
  point: FootballSpot,
): number {
  return projectPointOntoRoute(route, point).distanceToRoute;
}

export function createReceiverRouteAuditSnapshot(
  route: ResolvedReceiverRoute,
  receiverPosition: FootballSpot,
  routeState?: ReceiverRouteState,
  toleranceYards: number = RECEIVER_ROUTE_AUDIT_CONFIG.corridorToleranceYards,
): ReceiverRouteAuditSnapshot {
  const projection = projectPointOntoRoute(route, receiverPosition);
  const distanceAlongRoute = clamp(
    routeState?.distanceAlongRoute ?? projection.distanceAlongRoute,
    0,
    route.totalLength,
  );
  const segmentIndex = clampSegmentIndex(
    route,
    routeState?.segmentIndex ?? getSegmentIndexAtDistance(route, distanceAlongRoute),
  );
  const activeSegmentStart = route.points[segmentIndex] ?? route.points[0] ?? { x: 0, z: 0 };
  const activeSegmentEnd = route.points[segmentIndex + 1] ??
    route.points[route.points.length - 1] ??
    activeSegmentStart;
  const crossTrackErrorYards = projection.distanceToRoute;

  return {
    activeSegmentEnd: { ...activeSegmentEnd },
    activeSegmentStart: { ...activeSegmentStart },
    completionPercentage: route.totalLength <= ROUTE_EPSILON
      ? 1
      : distanceAlongRoute / route.totalLength,
    crossTrackErrorYards,
    distanceAlongRoute,
    exceedsTolerance: crossTrackErrorYards > toleranceYards,
    nearestPoint: { ...projection.point },
    receiverId: route.receiverId,
    routeId: route.id,
    segmentIndex,
    totalLength: route.totalLength,
  };
}

export function advanceRouteState(
  state: ReceiverRouteState,
  route: ResolvedReceiverRoute,
  deltaSeconds: number,
  speedYardsPerSecond: number,
): ReceiverRouteState {
  const distanceDelta = Math.max(0, speedYardsPerSecond) * Math.max(0, deltaSeconds);
  const nextDistance = clamp(
    state.distanceAlongRoute + distanceDelta,
    state.distanceAlongRoute,
    route.totalLength,
  );
  const nextSegmentIndex = getSegmentIndexAtDistance(route, nextDistance);

  return {
    completed: nextDistance >= route.totalLength - ROUTE_EPSILON,
    distanceAlongRoute: nextDistance,
    receiverId: state.receiverId,
    routeId: state.routeId,
    segmentIndex: nextSegmentIndex,
  };
}

export function getRouteDefinition(
  play: ReceiverRoutePlayDefinition,
  receiverId: string,
): ReceiverRouteDefinition | null {
  return play.receiverRoutes?.[receiverId] ?? null;
}

export function getRouteFinalPoint(route: ResolvedReceiverRoute): FootballSpot {
  return { ...route.points[route.points.length - 1] };
}

function calculateSegmentLengths(points: readonly FootballSpot[]): number[] {
  const lengths: number[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    lengths.push(distanceBetween(points[index], points[index + 1]));
  }

  return lengths;
}

function calculateCumulativeLengths(segmentLengths: readonly number[]): number[] {
  let runningLength = 0;

  return segmentLengths.map((length) => {
    runningLength += length;
    return runningLength;
  });
}

function getSegmentIndexAtDistance(
  route: ResolvedReceiverRoute,
  distanceAlongRoute: number,
): number {
  if (route.segmentLengths.length === 0) {
    return 0;
  }

  const distance = clamp(distanceAlongRoute, 0, route.totalLength);

  for (let index = 0; index < route.cumulativeLengths.length; index += 1) {
    if (distance <= route.cumulativeLengths[index] + ROUTE_EPSILON) {
      return index;
    }
  }

  return route.segmentLengths.length - 1;
}

function clampSegmentIndex(route: ResolvedReceiverRoute, segmentIndex: number): number {
  if (route.segmentLengths.length === 0) {
    return 0;
  }

  return Math.min(route.segmentLengths.length - 1, Math.max(0, Math.floor(segmentIndex)));
}

function calculateSegmentTangent(
  start: FootballSpot,
  end: FootballSpot | undefined,
): FootballSpot | null {
  if (!end) {
    return null;
  }

  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const length = Math.hypot(deltaX, deltaZ);

  if (length <= ROUTE_EPSILON) {
    return null;
  }

  return {
    x: deltaX / length,
    z: deltaZ / length,
  };
}

function projectPointOntoSegment(
  point: FootballSpot,
  start: FootballSpot,
  end: FootballSpot,
): { point: FootballSpot; segmentT: number } {
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;

  if (lengthSquared <= ROUTE_EPSILON) {
    return { point: { ...start }, segmentT: 0 };
  }

  const segmentT = clamp(
    ((point.x - start.x) * deltaX + (point.z - start.z) * deltaZ) / lengthSquared,
    0,
    1,
  );

  return {
    point: {
      x: start.x + deltaX * segmentT,
      z: start.z + deltaZ * segmentT,
    },
    segmentT,
  };
}

function distanceBetween(first: FootballSpot, second: FootballSpot): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
