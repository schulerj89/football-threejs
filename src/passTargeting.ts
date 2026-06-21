import type { Vector3 } from './ballModel';
import type { FieldBounds } from './fieldSpec';
import type { FootballSpot } from './fieldScale';
import {
  sampleRouteAtDistance,
  type ReceiverRouteState,
  type ResolvedReceiverRoute,
} from './receiverRoutes';

export interface PassTargetingConfig {
  catchRadius: number;
  catchTargetHeight: number;
  iterations: number;
  maxCatchHeight: number;
  maxFlightSeconds: number;
  minCatchHeight: number;
  minFlightSeconds: number;
  passSpeed: number;
  playableBounds: FieldBounds;
}

export interface PassTargetSolution {
  iterations: number;
  predictedFlightSeconds: number;
  predictedReceiverPosition: FootballSpot;
  predictedReceiverRouteDistance: number;
  target: Vector3;
}

export interface RouteAwarePassTargetInput {
  ballStart: Vector3;
  config: PassTargetingConfig;
  receiverPosition: FootballSpot;
  route: ResolvedReceiverRoute | null;
  routeSpeedYardsPerSecond: number;
  routeState: ReceiverRouteState | null;
}

export type CatchEvaluationReason =
  | 'aboveCatchHeight'
  | 'belowCatchHeight'
  | 'catch'
  | 'outsideCatchRadius';

export interface SweptCatchEvaluation {
  ballHeightAtClosestApproach: number;
  catchable: boolean;
  closestBallPosition: Vector3;
  closestReceiverPosition: FootballSpot;
  closestT: number;
  horizontalMissDistance: number;
  reason: CatchEvaluationReason;
}

const PASS_TARGET_EPSILON = 0.000001;

export function solveRouteAwarePassTarget(
  input: RouteAwarePassTargetInput,
): PassTargetSolution {
  const config = input.config;
  const routeDistance = clamp(
    input.routeState?.distanceAlongRoute ?? 0,
    0,
    input.route?.totalLength ?? 0,
  );

  if (
    !input.route ||
    input.route.totalLength <= PASS_TARGET_EPSILON ||
    input.routeState?.completed ||
    routeDistance >= input.route.totalLength - PASS_TARGET_EPSILON
  ) {
    const predictedReceiverPosition = clampSpot(input.receiverPosition, config.playableBounds);
    const target = {
      x: predictedReceiverPosition.x,
      y: config.catchTargetHeight,
      z: predictedReceiverPosition.z,
    };

    return {
      iterations: 0,
      predictedFlightSeconds: estimatePassFlightSeconds(input.ballStart, target, config),
      predictedReceiverPosition,
      predictedReceiverRouteDistance: routeDistance,
      target,
    };
  }

  let predictedReceiverRouteDistance = routeDistance;
  let predictedReceiverPosition = clampSpot(input.receiverPosition, config.playableBounds);
  let predictedFlightSeconds = estimatePassFlightSeconds(
    input.ballStart,
    {
      x: predictedReceiverPosition.x,
      y: config.catchTargetHeight,
      z: predictedReceiverPosition.z,
    },
    config,
  );

  const iterations = Math.max(0, Math.floor(config.iterations));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    predictedReceiverRouteDistance = clamp(
      routeDistance + Math.max(0, input.routeSpeedYardsPerSecond) * predictedFlightSeconds,
      routeDistance,
      input.route.totalLength,
    );
    predictedReceiverPosition = clampSpot(
      sampleRouteAtDistance(input.route, predictedReceiverRouteDistance),
      config.playableBounds,
    );
    predictedFlightSeconds = estimatePassFlightSeconds(
      input.ballStart,
      {
        x: predictedReceiverPosition.x,
        y: config.catchTargetHeight,
        z: predictedReceiverPosition.z,
      },
      config,
    );
  }

  return {
    iterations,
    predictedFlightSeconds,
    predictedReceiverPosition,
    predictedReceiverRouteDistance,
    target: {
      x: predictedReceiverPosition.x,
      y: config.catchTargetHeight,
      z: predictedReceiverPosition.z,
    },
  };
}

export function estimatePassFlightSeconds(
  start: Vector3,
  target: Vector3,
  config: Pick<PassTargetingConfig, 'maxFlightSeconds' | 'minFlightSeconds' | 'passSpeed'>,
): number {
  const horizontalDistance = Math.hypot(target.x - start.x, target.z - start.z);

  return clamp(
    horizontalDistance / Math.max(PASS_TARGET_EPSILON, config.passSpeed),
    config.minFlightSeconds,
    config.maxFlightSeconds,
  );
}

export function evaluateSweptCatch(
  previousBallPosition: Vector3,
  currentBallPosition: Vector3,
  previousReceiverPosition: FootballSpot,
  currentReceiverPosition: FootballSpot,
  config: Pick<PassTargetingConfig, 'catchRadius' | 'maxCatchHeight' | 'minCatchHeight'>,
): SweptCatchEvaluation {
  const relativeStart = {
    x: previousBallPosition.x - previousReceiverPosition.x,
    z: previousBallPosition.z - previousReceiverPosition.z,
  };
  const relativeEnd = {
    x: currentBallPosition.x - currentReceiverPosition.x,
    z: currentBallPosition.z - currentReceiverPosition.z,
  };
  const relativeDelta = {
    x: relativeEnd.x - relativeStart.x,
    z: relativeEnd.z - relativeStart.z,
  };
  const relativeDeltaLengthSquared =
    relativeDelta.x * relativeDelta.x + relativeDelta.z * relativeDelta.z;
  const closestT = relativeDeltaLengthSquared <= PASS_TARGET_EPSILON
    ? 0
    : clamp(
        -(
          relativeStart.x * relativeDelta.x +
          relativeStart.z * relativeDelta.z
        ) / relativeDeltaLengthSquared,
        0,
        1,
      );
  const closestBallPosition = {
    x: lerp(previousBallPosition.x, currentBallPosition.x, closestT),
    y: lerp(previousBallPosition.y, currentBallPosition.y, closestT),
    z: lerp(previousBallPosition.z, currentBallPosition.z, closestT),
  };
  const closestReceiverPosition = {
    x: lerp(previousReceiverPosition.x, currentReceiverPosition.x, closestT),
    z: lerp(previousReceiverPosition.z, currentReceiverPosition.z, closestT),
  };
  const horizontalMissDistance = Math.hypot(
    closestBallPosition.x - closestReceiverPosition.x,
    closestBallPosition.z - closestReceiverPosition.z,
  );
  const ballHeightAtClosestApproach = closestBallPosition.y;
  const reason = getCatchEvaluationReason(
    horizontalMissDistance,
    ballHeightAtClosestApproach,
    config,
  );

  return {
    ballHeightAtClosestApproach,
    catchable: reason === 'catch',
    closestBallPosition,
    closestReceiverPosition,
    closestT,
    horizontalMissDistance,
    reason,
  };
}

function getCatchEvaluationReason(
  horizontalMissDistance: number,
  ballHeight: number,
  config: Pick<PassTargetingConfig, 'catchRadius' | 'maxCatchHeight' | 'minCatchHeight'>,
): CatchEvaluationReason {
  if (horizontalMissDistance > config.catchRadius) {
    return 'outsideCatchRadius';
  }

  if (ballHeight < config.minCatchHeight) {
    return 'belowCatchHeight';
  }

  if (ballHeight > config.maxCatchHeight) {
    return 'aboveCatchHeight';
  }

  return 'catch';
}

function clampSpot(spot: FootballSpot, bounds: FieldBounds): FootballSpot {
  return {
    x: clamp(spot.x, bounds.minX, bounds.maxX),
    z: clamp(spot.z, bounds.minZ, bounds.maxZ),
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
