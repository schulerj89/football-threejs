import {
  FIELD_BOUNDS,
  FIELD_DIRECTION,
} from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { GameplaySnapshot } from '../playState';
import {
  OFFICIAL_CREW,
  OFFICIAL_POSITIONING_CONFIG,
  getSafeSidelineX,
} from './OfficialConfiguration';
import type {
  DirectionOfPlay,
  OfficialDefinition,
  OfficialFormationInput,
  OfficialModel,
  OfficialPoseIntent,
  OfficialUpdateState,
} from './OfficialTypes';

type PositioningConfig = typeof OFFICIAL_POSITIONING_CONFIG;

export function createOfficialFormationInputFromSnapshot(
  snapshot: GameplaySnapshot,
): OfficialFormationInput {
  return {
    ballPosition: {
      x: snapshot.ball.position.x,
      z: snapshot.ball.position.z,
    },
    deadBallSpot: snapshot.exactDeadBallSpot,
    directionOfPlay: FIELD_DIRECTION.playDirectionZ as DirectionOfPlay,
    lineOfScrimmage: snapshot.drive.lineOfScrimmage,
    playResultType: snapshot.lastPlayResult?.type ?? null,
    playState: snapshot.playState,
  };
}

export function resolveOfficialFormation(
  input: OfficialFormationInput,
  config: PositioningConfig = OFFICIAL_POSITIONING_CONFIG,
): OfficialModel[] {
  const direction = normalizeDirection(input.directionOfPlay);
  const poseIntent = resolvePoseIntent(input);
  const updateState = resolveUpdateState(input.playState);

  return OFFICIAL_CREW.map((definition) => {
    const targetPosition = resolveOfficialTarget(definition, input, direction, config);
    const facingRadians = faceToward(targetPosition, resolveFacingTarget(definition, input));

    return {
      assignedSideline: definition.assignedSideline,
      distanceFromBall: distance(targetPosition, input.ballPosition),
      facingRadians,
      id: definition.id,
      poseIntent,
      position: { ...targetPosition },
      role: definition.role,
      targetPosition: { ...targetPosition },
      updateState,
    };
  });
}

export function resolveOfficialTargets(
  input: OfficialFormationInput,
  config: PositioningConfig = OFFICIAL_POSITIONING_CONFIG,
): OfficialModel[] {
  return resolveOfficialFormation(input, config);
}

export function createOfficialFormationKey(input: OfficialFormationInput): string {
  const direction = normalizeDirection(input.directionOfPlay);

  return [
    input.playState,
    direction,
    input.ballPosition.x.toFixed(3),
    input.ballPosition.z.toFixed(3),
    input.lineOfScrimmage.x.toFixed(3),
    input.lineOfScrimmage.z.toFixed(3),
    input.playResultType ?? 'none',
  ].join('|');
}

export function isOfficialInsidePresentationBounds(official: OfficialModel): boolean {
  return isSpotInsidePresentationBounds(official.position);
}

export function isSpotInsidePresentationBounds(
  spot: FootballSpot,
  config: PositioningConfig = OFFICIAL_POSITIONING_CONFIG,
): boolean {
  return (
    spot.x >= FIELD_BOUNDS.minX + config.sidelineInsetYards &&
    spot.x <= FIELD_BOUNDS.maxX - config.sidelineInsetYards &&
    spot.z >= FIELD_BOUNDS.minZ + config.fieldEndInsetYards &&
    spot.z <= FIELD_BOUNDS.maxZ - config.fieldEndInsetYards
  );
}

function resolveOfficialTarget(
  definition: OfficialDefinition,
  input: OfficialFormationInput,
  direction: DirectionOfPlay,
  config: PositioningConfig,
): FootballSpot {
  if (input.playState === 'dead') {
    return resolveDeadBallTarget(definition, input, direction, config);
  }

  if (input.playState === 'live') {
    return resolveLiveTarget(definition, input, direction, config);
  }

  return resolvePreSnapTarget(definition, input, direction, config);
}

function resolvePreSnapTarget(
  definition: OfficialDefinition,
  input: OfficialFormationInput,
  direction: DirectionOfPlay,
  config: PositioningConfig,
): FootballSpot {
  const ball = input.ballPosition;
  const line = input.lineOfScrimmage;

  switch (definition.role) {
    case 'referee':
      return clampPresentationSpot({
        x: ball.x + resolveInteriorOffset(ball.x, config.refereeLateralOffsetYards),
        z: ball.z - direction * config.refereeDepthBehindOffenseYards,
      }, config);
    case 'umpire':
      return clampPresentationSpot({
        x: ball.x,
        z: line.z + direction * config.umpireDepthDefensiveYards,
      }, config);
    case 'downJudge':
    case 'lineJudge':
      return clampPresentationSpot({
        x: getSafeSidelineX(definition.assignedSideline ?? 'left'),
        z: line.z + direction * config.sidelineLineOffsetYards,
      }, config);
    case 'fieldJudge':
    case 'sideJudge':
      return clampPresentationSpot({
        x: getSafeSidelineX(definition.assignedSideline ?? 'right'),
        z: line.z + direction * config.deepJudgeDepthYards,
      }, config);
    case 'backJudge':
      return clampPresentationSpot({
        x: ball.x,
        z: line.z + direction * config.backJudgeDepthYards,
      }, config);
    default:
      return clampPresentationSpot(ball, config);
  }
}

function resolveLiveTarget(
  definition: OfficialDefinition,
  input: OfficialFormationInput,
  direction: DirectionOfPlay,
  config: PositioningConfig,
): FootballSpot {
  const ball = input.ballPosition;

  switch (definition.role) {
    case 'referee':
      return clampPresentationSpot({
        x: ball.x + resolveInteriorOffset(ball.x, config.refereeLateralOffsetYards),
        z: ball.z - direction * config.liveRefereeTrailYards,
      }, config);
    case 'umpire':
      return clampPresentationSpot({
        x: ball.x * 0.35,
        z: ball.z + direction * config.liveUmpireAheadYards,
      }, config);
    case 'downJudge':
    case 'lineJudge':
      return clampPresentationSpot({
        x: getSafeSidelineX(definition.assignedSideline ?? 'left'),
        z: ball.z + direction * config.liveSidelineLeadYards,
      }, config);
    case 'fieldJudge':
    case 'sideJudge':
      return clampPresentationSpot({
        x: getSafeSidelineX(definition.assignedSideline ?? 'right'),
        z: advanceDownfield(
          input.lineOfScrimmage.z + direction * config.deepJudgeDepthYards,
          ball.z + direction * config.liveDeepJudgeTrailYards,
          direction,
        ),
      }, config);
    case 'backJudge':
      return clampPresentationSpot({
        x: ball.x * 0.45,
        z: advanceDownfield(
          input.lineOfScrimmage.z + direction * config.backJudgeDepthYards,
          ball.z + direction * config.liveBackJudgeTrailYards,
          direction,
        ),
      }, config);
    default:
      return clampPresentationSpot(ball, config);
  }
}

function resolveDeadBallTarget(
  definition: OfficialDefinition,
  input: OfficialFormationInput,
  direction: DirectionOfPlay,
  config: PositioningConfig,
): FootballSpot {
  const spot = input.deadBallSpot ?? input.ballPosition;
  const nearestSideline = spot.x < 0 ? 'left' : 'right';
  const assignedSideline = definition.assignedSideline;
  const isNearestSidelineOfficial = assignedSideline === nearestSideline &&
    (definition.role === 'downJudge' || definition.role === 'lineJudge');

  if (isNearestSidelineOfficial) {
    return clampPresentationSpot({
      x: getSafeSidelineX(nearestSideline),
      z: spot.z + direction * config.deadBallApproachDepthYards,
    }, config);
  }

  switch (definition.role) {
    case 'referee':
      return clampPresentationSpot({
        x: spot.x + resolveInteriorOffset(spot.x, config.deadBallSpacingYards),
        z: spot.z - direction * config.deadBallSpacingYards,
      }, config);
    case 'umpire':
      return clampPresentationSpot({
        x: spot.x * 0.35,
        z: spot.z + direction * config.deadBallSpacingYards,
      }, config);
    case 'downJudge':
    case 'lineJudge':
      return clampPresentationSpot({
        x: getSafeSidelineX(assignedSideline ?? 'left'),
        z: spot.z,
      }, config);
    case 'fieldJudge':
    case 'sideJudge':
      return clampPresentationSpot({
        x: getSafeSidelineX(assignedSideline ?? 'right'),
        z: spot.z + direction * config.deadBallSpacingYards,
      }, config);
    case 'backJudge':
      return clampPresentationSpot({
        x: spot.x * 0.4,
        z: spot.z + direction * config.deadBallSpacingYards * 1.5,
      }, config);
    default:
      return clampPresentationSpot(spot, config);
  }
}

function resolveFacingTarget(
  definition: OfficialDefinition,
  input: OfficialFormationInput,
): FootballSpot {
  if (input.playState === 'dead') {
    return input.deadBallSpot ?? input.ballPosition;
  }

  if (definition.role === 'referee') {
    return input.ballPosition;
  }

  return input.playState === 'live' ? input.ballPosition : input.lineOfScrimmage;
}

function resolvePoseIntent(input: OfficialFormationInput): OfficialPoseIntent {
  if (input.playState === 'dead' && input.playResultType === 'touchdown') {
    return 'touchdown';
  }

  if (input.playState === 'live') {
    return 'tracking';
  }

  return 'neutral';
}

function resolveUpdateState(playState: OfficialFormationInput['playState']): OfficialUpdateState {
  if (playState === 'live') {
    return 'tracking';
  }

  if (playState === 'dead') {
    return 'deadBall';
  }

  return 'formation';
}

function clampPresentationSpot(
  spot: FootballSpot,
  config: PositioningConfig,
): FootballSpot {
  return {
    x: clamp(
      spot.x,
      FIELD_BOUNDS.minX + config.sidelineInsetYards,
      FIELD_BOUNDS.maxX - config.sidelineInsetYards,
    ),
    z: clamp(
      spot.z,
      FIELD_BOUNDS.minZ + config.fieldEndInsetYards,
      FIELD_BOUNDS.maxZ - config.fieldEndInsetYards,
    ),
  };
}

function normalizeDirection(direction: DirectionOfPlay | undefined): DirectionOfPlay {
  return direction === -1 ? -1 : 1;
}

function resolveInteriorOffset(x: number, offset: number): number {
  if (x > 0) {
    return -offset;
  }

  return offset;
}

function advanceDownfield(baseZ: number, candidateZ: number, direction: DirectionOfPlay): number {
  return direction > 0
    ? Math.max(baseZ, candidateZ)
    : Math.min(baseZ, candidateZ);
}

function faceToward(from: FootballSpot, target: FootballSpot): number {
  return Math.atan2(target.x - from.x, target.z - from.z);
}

function distance(a: FootballSpot, b: FootballSpot): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
