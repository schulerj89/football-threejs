import type { FootballSpot } from '../fieldScale';
import type { GameplaySnapshot } from '../playState';
import { OFFICIAL_POSITIONING_CONFIG } from './OfficialConfiguration';
import {
  createOfficialFormationInputFromSnapshot,
  createOfficialFormationKey,
  resolveOfficialFormation,
  resolveOfficialTargets,
} from './OfficialFormation';
import type {
  OfficialCrewState,
  OfficialFormationInput,
  OfficialModel,
} from './OfficialTypes';

type PositioningConfig = typeof OFFICIAL_POSITIONING_CONFIG;

export interface OfficialSimulationUpdateOptions {
  active?: boolean;
  config?: PositioningConfig;
}

export function createOfficialCrewState(
  source: GameplaySnapshot | OfficialFormationInput,
  config: PositioningConfig = OFFICIAL_POSITIONING_CONFIG,
): OfficialCrewState {
  const input = toFormationInput(source);
  return {
    lastFormationKey: createOfficialFormationKey(input),
    lastPlayState: input.playState,
    lastTargetKey: createOfficialFormationKey(input),
    officials: resolveOfficialFormation(input, config),
    targetUpdateAccumulatorSeconds: 0,
  };
}

export function resetOfficialCrewState(
  state: OfficialCrewState,
  source: GameplaySnapshot | OfficialFormationInput,
  config: PositioningConfig = OFFICIAL_POSITIONING_CONFIG,
): void {
  const input = toFormationInput(source);
  state.officials = resolveOfficialFormation(input, config);
  state.lastFormationKey = createOfficialFormationKey(input);
  state.lastTargetKey = state.lastFormationKey;
  state.lastPlayState = input.playState;
  state.targetUpdateAccumulatorSeconds = 0;
}

export function updateOfficialCrewState(
  state: OfficialCrewState,
  source: GameplaySnapshot | OfficialFormationInput,
  deltaSeconds: number,
  options: OfficialSimulationUpdateOptions = {},
): void {
  const config = options.config ?? OFFICIAL_POSITIONING_CONFIG;
  const active = options.active ?? true;
  const input = toFormationInput(source);
  const delta = Math.min(0.1, Math.max(0, deltaSeconds));
  const formationKey = createOfficialFormationKey(input);

  if (!active) {
    return;
  }

  if (input.playState !== 'live' && input.playState !== 'dead') {
    if (state.lastFormationKey !== formationKey || state.lastPlayState !== input.playState) {
      resetOfficialCrewState(state, input, config);
    } else {
      syncDistancesFromBall(state.officials, input.ballPosition);
    }
    return;
  }

  state.targetUpdateAccumulatorSeconds += delta;
  const targetIntervalSeconds = 1 / config.liveTargetUpdateHz;
  const shouldRefreshTargets =
    state.lastPlayState !== input.playState ||
    state.lastTargetKey !== formationKey ||
    state.targetUpdateAccumulatorSeconds >= targetIntervalSeconds;

  if (shouldRefreshTargets) {
    const targets = resolveOfficialTargets(input, config);
    for (const target of targets) {
      const official = state.officials.find((candidate) => candidate.id === target.id);
      if (!official) {
        continue;
      }
      official.targetPosition = { ...target.targetPosition };
      official.poseIntent = target.poseIntent;
      official.updateState = target.updateState;
      official.distanceFromBall = target.distanceFromBall;
      official.facingRadians = rotateToward(
        official.facingRadians,
        target.facingRadians,
        config.turnRateRadiansPerSecond * Math.max(delta, targetIntervalSeconds),
      );
    }
    state.lastTargetKey = formationKey;
    state.targetUpdateAccumulatorSeconds %= targetIntervalSeconds;
  }

  for (const official of state.officials) {
    moveOfficialTowardTarget(official, delta, config);
    official.distanceFromBall = distance(official.position, input.ballPosition);
  }

  state.lastPlayState = input.playState;
}

export function snapshotOfficialState(state: OfficialCrewState): OfficialModel[] {
  return state.officials.map((official) => ({
    ...official,
    position: { ...official.position },
    targetPosition: { ...official.targetPosition },
  }));
}

function toFormationInput(
  source: GameplaySnapshot | OfficialFormationInput,
): OfficialFormationInput {
  if ('ball' in source) {
    return createOfficialFormationInputFromSnapshot(source);
  }

  return source;
}

function syncDistancesFromBall(officials: OfficialModel[], ball: FootballSpot): void {
  for (const official of officials) {
    official.distanceFromBall = distance(official.position, ball);
  }
}

function moveOfficialTowardTarget(
  official: OfficialModel,
  deltaSeconds: number,
  config: PositioningConfig,
): void {
  const dx = official.targetPosition.x - official.position.x;
  const dz = official.targetPosition.z - official.position.z;
  const distanceToTarget = Math.hypot(dx, dz);

  if (distanceToTarget <= 0.0001) {
    official.position.x = official.targetPosition.x;
    official.position.z = official.targetPosition.z;
    return;
  }

  const step = config.liveMaxSpeedYardsPerSecond * deltaSeconds;

  if (distanceToTarget <= step) {
    official.position.x = official.targetPosition.x;
    official.position.z = official.targetPosition.z;
    return;
  }

  const ratio = step / distanceToTarget;
  official.position.x += dx * ratio;
  official.position.z += dz * ratio;
}

function rotateToward(current: number, target: number, maxStep: number): number {
  const difference = wrapAngle(target - current);

  if (Math.abs(difference) <= maxStep) {
    return target;
  }

  return current + Math.sign(difference) * maxStep;
}

function wrapAngle(angle: number): number {
  let wrapped = angle;

  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2;
  }
  while (wrapped < -Math.PI) {
    wrapped += Math.PI * 2;
  }

  return wrapped;
}

function distance(a: FootballSpot, b: FootballSpot): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
