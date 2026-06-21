import { describe, expect, it } from 'vitest';
import { createSnapPlacementForLane } from '../src/formationPreview';
import { PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { resolveFormation } from '../src/formationLayout';
import { ALL_PLAYS, getPlay } from '../src/playbook';
import {
  advanceRouteState,
  calculateCrossTrackError,
  createReceiverRouteAuditSnapshot,
  createReceiverRouteRuntimeMap,
  createReceiverRouteState,
  getRouteFinalPoint,
  getRouteTangentAtDistance,
  projectPointOntoRoute,
  resolveReceiverRoute,
  sampleRouteAtDistance,
  type ResolvedReceiverRoute,
} from '../src/receiverRoutes';

describe('receiver routes', () => {
  it('resolves every route from the receiver formation position in declared waypoint order', () => {
    const play = getPlay('slant-flat');
    const snapPlacement = createSnapPlacementForLane('middle');
    const formation = resolveFormation(play, snapPlacement);
    const receiver = getSlot(formation, 'offense-wr');
    const route = expectResolvedRoute(resolveReceiverRoute(play, 'offense-wr', snapPlacement));

    expect(route.points[0]).toEqual(receiver.position);
    expect(route.points[1]).toEqual({
      x: receiver.position.x,
      z: snapPlacement.spot.z + 4,
    });
    expect(route.points[2]).toEqual({
      x: 0,
      z: snapPlacement.spot.z + 11,
    });
  });

  it('starts every declared route at the receiver resolved formation position', () => {
    for (const play of ALL_PLAYS) {
      for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
        const snapPlacement = createSnapPlacementForLane(lane);
        const formation = resolveFormation(play, snapPlacement);

        for (const receiverId of Object.keys(play.receiverRoutes ?? {})) {
          const receiver = getSlot(formation, receiverId);
          const route = expectResolvedRoute(resolveReceiverRoute(play, receiverId, snapPlacement));

          expect(route.points[0]).toEqual(receiver.position);
        }
      }
    }
  });

  it('creates fresh resolved runtime routes for a play and snap placement', () => {
    const play = getPlay('slant-flat');
    const snapPlacement = createSnapPlacementForLane('middle');
    const firstRuntime = createReceiverRouteRuntimeMap(play, snapPlacement);
    const secondRuntime = createReceiverRouteRuntimeMap(play, snapPlacement);
    const firstRoute = firstRuntime['offense-wr'].route;
    const secondRoute = secondRuntime['offense-wr'].route;

    expect(Object.keys(firstRuntime)).toEqual(Object.keys(play.receiverRoutes ?? {}));
    expect(firstRuntime['offense-wr'].definition).toBe(play.receiverRoutes?.['offense-wr']);
    expect(firstRoute).toEqual(resolveReceiverRoute(play, 'offense-wr', snapPlacement));
    expect(firstRoute).not.toBe(secondRoute);
    expect(firstRoute.points).not.toBe(secondRoute.points);
    expect(firstRoute.segmentLengths).not.toBe(secondRoute.segmentLengths);
    expect(firstRoute.cumulativeLengths).not.toBe(secondRoute.cumulativeLengths);
  });

  it('calculates segment lengths and total route length in football yards', () => {
    const route = makeRoute([
      { x: 0, z: 0 },
      { x: 3, z: 4 },
      { x: 6, z: 4 },
    ]);

    expect(route.segmentLengths).toEqual([5, 3]);
    expect(route.cumulativeLengths).toEqual([5, 8]);
    expect(route.totalLength).toBe(8);
  });

  it('samples route distance at the start, middle of a segment, and final point', () => {
    const route = makeRoute([
      { x: 0, z: 0 },
      { x: 0, z: 10 },
      { x: 10, z: 10 },
    ]);

    expect(sampleRouteAtDistance(route, 0)).toEqual({ x: 0, z: 0 });
    expect(sampleRouteAtDistance(route, 5)).toEqual({ x: 0, z: 5 });
    expect(sampleRouteAtDistance(route, route.totalLength)).toEqual({ x: 10, z: 10 });
  });

  it('advances route state by speed times delta time independent of frame count', () => {
    const routeDefinition = {
      id: 'test-route',
      speedYardsPerSecond: 9,
      waypoints: [],
    };
    const route = makeRoute([
      { x: 0, z: 0 },
      { x: 0, z: 100 },
    ]);
    let oneSecond = createReceiverRouteState(routeDefinition, 'receiver');
    oneSecond = advanceRouteState(oneSecond, route, 1, routeDefinition.speedYardsPerSecond);

    let sixtyFps = createReceiverRouteState(routeDefinition, 'receiver');
    for (let index = 0; index < 60; index += 1) {
      sixtyFps = advanceRouteState(sixtyFps, route, 1 / 60, routeDefinition.speedYardsPerSecond);
    }

    let thirtyFps = createReceiverRouteState(routeDefinition, 'receiver');
    for (let index = 0; index < 30; index += 1) {
      thirtyFps = advanceRouteState(thirtyFps, route, 1 / 30, routeDefinition.speedYardsPerSecond);
    }

    expect(oneSecond.distanceAlongRoute).toBeCloseTo(9);
    expect(sixtyFps.distanceAlongRoute).toBeCloseTo(9);
    expect(thirtyFps.distanceAlongRoute).toBeCloseTo(9);
  });

  it('follows segments in order rather than aiming directly at the final waypoint', () => {
    const route = makeRoute([
      { x: 0, z: 0 },
      { x: 0, z: 4 },
      { x: 12, z: 4 },
    ]);

    expect(sampleRouteAtDistance(route, 4)).toEqual({ x: 0, z: 4 });
    expect(sampleRouteAtDistance(route, 5)).toEqual({ x: 1, z: 4 });
    expect(sampleRouteAtDistance(route, 5)).not.toEqual(getRouteFinalPoint(route));
  });

  it('projects points onto a route and reports cross-track error', () => {
    const route = makeRoute([
      { x: 0, z: 0 },
      { x: 0, z: 10 },
    ]);
    const projection = projectPointOntoRoute(route, { x: 3, z: 4 });

    expect(projection.point).toEqual({ x: 0, z: 4 });
    expect(projection.distanceAlongRoute).toBe(4);
    expect(calculateCrossTrackError(route, { x: 3, z: 4 })).toBe(3);
    expect(getRouteTangentAtDistance(route, 2)).toEqual({ x: 0, z: 1 });
  });

  it('reports approximately zero cross-track error when a receiver is on the route', () => {
    const route = makeRoute([
      { x: 0, z: 0 },
      { x: 0, z: 10 },
    ]);
    const audit = createReceiverRouteAuditSnapshot(route, { x: 0, z: 4 });

    expect(audit.nearestPoint).toEqual({ x: 0, z: 4 });
    expect(audit.crossTrackErrorYards).toBeCloseTo(0);
    expect(audit.exceedsTolerance).toBe(false);
  });

  it('reports approximately one yard of cross-track error from a straight route', () => {
    const route = makeRoute([
      { x: 0, z: 0 },
      { x: 0, z: 10 },
    ]);
    const audit = createReceiverRouteAuditSnapshot(route, { x: 1, z: 4 }, undefined, 0.75);

    expect(audit.nearestPoint).toEqual({ x: 0, z: 4 });
    expect(audit.crossTrackErrorYards).toBeCloseTo(1);
    expect(audit.exceedsTolerance).toBe(true);
  });

  it('projects correctly near segment junctions', () => {
    const route = makeRoute([
      { x: 0, z: 0 },
      { x: 0, z: 5 },
      { x: 8, z: 5 },
    ]);
    const projection = projectPointOntoRoute(route, { x: 0.4, z: 5.2 });

    expect(projection.segmentIndex).toBe(1);
    expect(projection.point.x).toBeCloseTo(0.4);
    expect(projection.point.z).toBeCloseTo(5);
    expect(projection.distanceAlongRoute).toBeCloseTo(5.4);
  });

  it('produces distinct slant and flat paths', () => {
    const play = getPlay('slant-flat');
    const snapPlacement = createSnapPlacementForLane('middle');
    const slant = expectResolvedRoute(resolveReceiverRoute(play, 'offense-wr', snapPlacement));
    const flat = expectResolvedRoute(resolveReceiverRoute(play, 'offense-rb', snapPlacement));

    expect(slant.points).not.toEqual(flat.points);
    expect(slant.points[1].x).toBeGreaterThan(flat.points[1].x);
    expect(getRouteFinalPoint(flat).x).toBeLessThan(0);
  });

  it('mirrors field and boundary aware routes across left and right hash placements', () => {
    const play = getPlay('slant-flat');
    const leftHash = expectResolvedRoute(
      resolveReceiverRoute(play, 'offense-rb', createSnapPlacementForLane('leftHash')),
    );
    const rightHash = expectResolvedRoute(
      resolveReceiverRoute(play, 'offense-rb', createSnapPlacementForLane('rightHash')),
    );

    expect(leftHash.points.length).toBe(rightHash.points.length);
    for (let index = 0; index < leftHash.points.length; index += 1) {
      expect(leftHash.points[index].x).toBeCloseTo(-rightHash.points[index].x);
      expect(leftHash.points[index].z).toBeCloseTo(rightHash.points[index].z);
    }
  });

  it('keeps every resolved route waypoint inside the playable field bounds', () => {
    for (const play of ALL_PLAYS) {
      for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
        const snapPlacement = createSnapPlacementForLane(lane);

        for (const receiverId of Object.keys(play.receiverRoutes ?? {})) {
          const route = expectResolvedRoute(resolveReceiverRoute(play, receiverId, snapPlacement));

          for (const point of route.points) {
            expect(point.x).toBeGreaterThanOrEqual(PLAYABLE_FIELD_BOUNDS.minX);
            expect(point.x).toBeLessThanOrEqual(PLAYABLE_FIELD_BOUNDS.maxX);
            expect(point.z).toBeGreaterThanOrEqual(PLAYABLE_FIELD_BOUNDS.minZ);
            expect(point.z).toBeLessThanOrEqual(PLAYABLE_FIELD_BOUNDS.maxZ);
          }
        }
      }
    }
  });
});

function makeRoute(points: ResolvedReceiverRoute['points']): ResolvedReceiverRoute {
  const segmentLengths: number[] = [];
  const cumulativeLengths: number[] = [];
  let totalLength = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const length = Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].z - points[index].z,
    );
    segmentLengths.push(length);
    totalLength += length;
    cumulativeLengths.push(totalLength);
  }

  return {
    cumulativeLengths,
    id: 'test-route',
    points,
    receiverId: 'receiver',
    segmentLengths,
    totalLength,
  };
}

function expectResolvedRoute(route: ResolvedReceiverRoute | null): ResolvedReceiverRoute {
  if (!route) {
    throw new Error('Expected route to resolve');
  }

  return route;
}

function getSlot(
  formation: ReturnType<typeof resolveFormation>,
  playerId: string,
): ReturnType<typeof resolveFormation>['slots'][number] {
  const slot = formation.slots.find((candidate) => candidate.id === playerId);

  if (!slot) {
    throw new Error(`Missing slot ${playerId}`);
  }

  return slot;
}
