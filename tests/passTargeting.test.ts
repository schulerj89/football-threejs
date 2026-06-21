import { describe, expect, it } from 'vitest';
import { PASSING_CONFIG, type Vector3 } from '../src/ballModel';
import { PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { createSnapPlacementForLane } from '../src/formationPreview';
import { getPlay } from '../src/playbook';
import {
  createReceiverRouteState,
  getRouteDefinition,
  resolveReceiverRoute,
  sampleRouteAtDistance,
  type ReceiverRouteState,
  type ResolvedReceiverRoute,
} from '../src/receiverRoutes';
import {
  evaluateSweptCatch,
  solveRouteAwarePassTarget,
  type PassTargetSolution,
} from '../src/passTargeting';

describe('pass targeting', () => {
  it('predicts from the receiver declared route instead of a fixed lead vector', () => {
    const { route, routeState, solution } = solveForRoute('slant-flat', 'offense-wr', 0);
    const expectedPoint = sampleRouteAtDistance(route, solution.predictedReceiverRouteDistance);

    expect(solution.predictedReceiverRouteDistance).toBeGreaterThan(0);
    expect(solution.predictedReceiverPosition).toEqual(expectedPoint);
    expect(solution.target).toMatchObject({
      x: expectedPoint.x,
      y: PASSING_CONFIG.catchTargetHeight,
      z: expectedPoint.z,
    });
    expect(routeState.distanceAlongRoute).toBe(0);
  });

  it('throws before a slant break to a post-break route position', () => {
    const { route, solution } = solveForRoute('slant-flat', 'offense-wr', 0);
    const firstSegmentLength = route.segmentLengths[0];

    expect(solution.predictedReceiverRouteDistance).toBeGreaterThan(firstSegmentLength);
    expect(solution.predictedReceiverPosition.x).toBeLessThan(route.points[1].x);
    expect(solution.predictedReceiverPosition.z).toBeGreaterThan(route.points[1].z);
  });

  it('throws after a slant break along the diagonal segment', () => {
    const initial = solveForRoute('slant-flat', 'offense-wr', 0);
    const afterBreakDistance = initial.route.segmentLengths[0] + 1;
    const { route, solution } = solveForRoute('slant-flat', 'offense-wr', afterBreakDistance);
    const currentPoint = sampleRouteAtDistance(route, afterBreakDistance);

    expect(solution.predictedReceiverRouteDistance).toBeGreaterThan(afterBreakDistance);
    expect(solution.predictedReceiverPosition.x).toBeLessThan(currentPoint.x);
    expect(solution.predictedReceiverPosition.z).toBeGreaterThan(currentPoint.z);
  });

  it('leads a flat route toward the boundary', () => {
    const { receiverPosition, solution } = solveForRoute('slant-flat', 'offense-rb', 0);

    expect(solution.predictedReceiverPosition.x).toBeLessThan(receiverPosition.x);
    expect(solution.predictedReceiverPosition.z).toBeGreaterThan(receiverPosition.z);
  });

  it('keeps predictions inside playable bounds for every snap lane', () => {
    for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
      for (const receiverId of ['offense-wr', 'offense-rb'] as const) {
        const { solution } = solveForRoute('slant-flat', receiverId, 0, lane);

        expect(solution.predictedReceiverPosition.x).toBeGreaterThanOrEqual(PLAYABLE_FIELD_BOUNDS.minX);
        expect(solution.predictedReceiverPosition.x).toBeLessThanOrEqual(PLAYABLE_FIELD_BOUNDS.maxX);
        expect(solution.predictedReceiverPosition.z).toBeGreaterThanOrEqual(PLAYABLE_FIELD_BOUNDS.minZ);
        expect(solution.predictedReceiverPosition.z).toBeLessThanOrEqual(PLAYABLE_FIELD_BOUNDS.maxZ);
      }
    }
  });

  it('resolves left, middle, and right hash passes from the snap-relative route', () => {
    const left = solveForRoute('slant-flat', 'offense-rb', 0, 'leftHash').solution;
    const middle = solveForRoute('slant-flat', 'offense-rb', 0, 'middle').solution;
    const right = solveForRoute('slant-flat', 'offense-rb', 0, 'rightHash').solution;

    expect(left.predictedReceiverPosition.x).toBeCloseTo(-right.predictedReceiverPosition.x);
    expect(left.predictedReceiverPosition.z).toBeCloseTo(right.predictedReceiverPosition.z);
    expect(middle.predictedReceiverPosition.x).toBeLessThan(0);
  });

  it('does not create an extreme lead once a route is complete', () => {
    const base = solveForRoute('slant-flat', 'offense-wr', 0);
    const receiverPosition = sampleRouteAtDistance(base.route, base.route.totalLength);
    const solution = solveTarget(base.route, {
      completed: true,
      distanceAlongRoute: base.route.totalLength,
      receiverId: base.route.receiverId,
      routeId: base.route.id,
      segmentIndex: base.route.segmentLengths.length - 1,
    }, receiverPosition);

    expect(solution.iterations).toBe(0);
    expect(solution.target.x).toBeCloseTo(receiverPosition.x);
    expect(solution.target.z).toBeCloseTo(receiverPosition.z);
  });

  it('catches a ball that crosses the receiver catch corridor between frames', () => {
    const evaluation = evaluateSweptCatch(
      { x: -3, y: 2, z: 0 },
      { x: 3, y: 2, z: 0 },
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      PASSING_CONFIG,
    );

    expect(evaluation.catchable).toBe(true);
    expect(evaluation.horizontalMissDistance).toBeCloseTo(0);
    expect(evaluation.reason).toBe('catch');
  });

  it('keeps a ball outside the catch corridor incomplete', () => {
    const evaluation = evaluateSweptCatch(
      { x: -3, y: 2, z: 4 },
      { x: 3, y: 2, z: 4 },
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      PASSING_CONFIG,
    );

    expect(evaluation.catchable).toBe(false);
    expect(evaluation.horizontalMissDistance).toBeGreaterThan(PASSING_CONFIG.catchRadius);
    expect(evaluation.reason).toBe('outsideCatchRadius');
  });
});

type SnapLane = 'leftHash' | 'middle' | 'rightHash';

function solveForRoute(
  playId: 'slant-flat',
  receiverId: 'offense-wr' | 'offense-rb',
  distanceAlongRoute: number,
  lane: SnapLane = 'middle',
): {
  receiverPosition: { x: number; z: number };
  route: ResolvedReceiverRoute;
  routeState: ReceiverRouteState;
  solution: PassTargetSolution;
} {
  const play = getPlay(playId);
  const snapPlacement = createSnapPlacementForLane(lane);
  const route = resolveReceiverRoute(play, receiverId, snapPlacement);
  const routeDefinition = getRouteDefinition(play, receiverId);

  if (!route || !routeDefinition) {
    throw new Error(`Expected route for ${receiverId}`);
  }

  const routeState = createReceiverRouteState(routeDefinition, receiverId);
  routeState.distanceAlongRoute = distanceAlongRoute;
  routeState.segmentIndex = Math.min(
    route.segmentLengths.length - 1,
    Math.max(0, route.cumulativeLengths.findIndex((length) => distanceAlongRoute <= length)),
  );
  routeState.completed = distanceAlongRoute >= route.totalLength;

  return {
    receiverPosition: sampleRouteAtDistance(route, distanceAlongRoute),
    route,
    routeState,
    solution: solveTarget(
      route,
      routeState,
      sampleRouteAtDistance(route, distanceAlongRoute),
      routeDefinition.speedYardsPerSecond,
      {
        x: snapPlacement.spot.x,
        y: 1.2,
        z: snapPlacement.spot.z - 5,
      },
    ),
  };
}

function solveTarget(
  route: ResolvedReceiverRoute,
  routeState: ReceiverRouteState,
  receiverPosition: { x: number; z: number },
  routeSpeedYardsPerSecond = 9.5,
  ballStart: Vector3 = { x: 0, y: 1.2, z: -5 },
): PassTargetSolution {
  return solveRouteAwarePassTarget({
    ballStart,
    config: {
      ...PASSING_CONFIG,
      iterations: PASSING_CONFIG.targetingIterations,
      playableBounds: PLAYABLE_FIELD_BOUNDS,
    },
    receiverPosition,
    route,
    routeSpeedYardsPerSecond,
    routeState,
  });
}
