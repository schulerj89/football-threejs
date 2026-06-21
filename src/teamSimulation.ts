import type { PlayableFieldBounds } from './field';
import { resolveSnapPlacement } from './ballSpotting';
import {
  getBlockingLaneTarget,
  getCoverageAssignmentReceiverId,
  getDeepHelpReceiverIds,
  getProtectionAssignmentDefenderId,
  type PlayDefinition,
} from './playbook';
import type { FootballSpot } from './fieldScale';
import { DEFENDER_CONFIG, updateDefenderPursuit } from './defenderModel';
import type { PlayerModel, Vector2 } from './playerModel';
import {
  advanceRouteState,
  createReceiverRouteState,
  getRouteDefinition,
  getRouteTangentAtDistance,
  resolveReceiverRoute,
  sampleRouteAtDistance,
  type ReceiverRouteState,
} from './receiverRoutes';
import type { FramePerformanceProfiler } from './performance/FramePerformanceProfiler';

export interface BlockingEngagement {
  blockerId: string;
  defenderId: string;
}

export interface BlockingState {
  engagements: BlockingEngagement[];
}

export interface RushingDrillAiOptions {
  bounds: PlayableFieldBounds;
  deltaSeconds: number;
  lineOfScrimmage: FootballSpot;
  play: PlayDefinition;
  profiler?: FramePerformanceProfiler;
  receiverRouteStates?: Record<string, ReceiverRouteState>;
}

export const BLOCKING_CONFIG = {
  blockerLaneSpeed: 8.5,
  engageDistance: 2.1,
  disengageDistance: 3.4,
  engagedDefenderSpeedMultiplier: 0.35,
  minimumSeparationPadding: 0,
} as const;

export const RECEIVER_ROUTE_FOLLOWING_CONFIG = {
  maxRecoverySpeedYardsPerSecond: 5,
} as const;

export function createBlockingState(): BlockingState {
  return { engagements: [] };
}

export function resetBlockingState(blocking: BlockingState): void {
  blocking.engagements.length = 0;
}

export function updateRushingDrillAi(
  players: PlayerModel[],
  blocking: BlockingState,
  runner: PlayerModel,
  options: RushingDrillAiOptions,
): void {
  const delta = Math.max(0, Math.min(options.deltaSeconds, 0.1));
  const profiler = options.profiler;

  if (profiler?.enabled) {
    profiler.measure('blockingAndEngagement', () => releaseSeparatedEngagements(players, blocking));
    profiler.measure('offensiveAssignments', () => {
      updateBlockers(players, blocking, options.lineOfScrimmage, options.play, delta);
    });
    profiler.measure('receiverRouteUpdates', () => {
      updateReceivers(
        players,
        options.lineOfScrimmage,
        options.play,
        delta,
        options.receiverRouteStates,
      );
    });
    profiler.measure('blockingAndEngagement', () => {
      acquireBlockingEngagements(players, blocking, options.play);
    });
    profiler.measure('defensiveAi', () => {
      updateDefenders(players, blocking, runner, options.play, delta);
    });
  } else {
    releaseSeparatedEngagements(players, blocking);
    updateBlockers(players, blocking, options.lineOfScrimmage, options.play, delta);
    updateReceivers(
      players,
      options.lineOfScrimmage,
      options.play,
      delta,
      options.receiverRouteStates,
    );
    acquireBlockingEngagements(players, blocking, options.play);
    updateDefenders(players, blocking, runner, options.play, delta);
  }
  keepNonCarriersInsidePlayableField(players, runner.id, options.bounds);
  if (profiler?.enabled) {
    profiler.measure('playerCollisionSeparation', () => resolvePlayerOverlaps(players));
  } else {
    resolvePlayerOverlaps(players);
  }
  keepNonCarriersInsidePlayableField(players, runner.id, options.bounds);
  if (profiler?.enabled) {
    profiler.measure('blockingAndEngagement', () => releaseSeparatedEngagements(players, blocking));
  } else {
    releaseSeparatedEngagements(players, blocking);
  }
}

export function acquireBlockingEngagements(
  players: PlayerModel[],
  blocking: BlockingState,
  play?: PlayDefinition,
): void {
  const blockers = players.filter((player) => player.team === 'offense' && player.role === 'blocker');
  const defenders = players.filter((player) => player.team === 'defense' && player.role === 'defender');

  for (const blocker of blockers) {
    if (getEngagementForBlocker(blocking, blocker.id)) {
      continue;
    }

    const assignedDefenderId = play
      ? getProtectionAssignmentDefenderId(play, blocker.id)
      : null;
    const defender = assignedDefenderId
      ? findAssignedDefender(blocker, assignedDefenderId, defenders, blocking)
      : findNearestEligibleDefender(blocker, defenders, blocking);
    if (!defender) {
      continue;
    }

    blocking.engagements.push({ blockerId: blocker.id, defenderId: defender.id });
    blocker.currentState = 'engaged';
    defender.currentState = 'engaged';
  }
}

export function releaseSeparatedEngagements(players: PlayerModel[], blocking: BlockingState): void {
  for (let index = blocking.engagements.length - 1; index >= 0; index -= 1) {
    const engagement = blocking.engagements[index];
    const blocker = findPlayer(players, engagement.blockerId);
    const defender = findPlayer(players, engagement.defenderId);

    if (
      !blocker ||
      !defender ||
      distanceBetween(blocker, defender) > BLOCKING_CONFIG.disengageDistance
    ) {
      if (blocker && blocker.role === 'blocker') {
        blocker.currentState = 'movingToLane';
      }
      if (defender && defender.role === 'defender') {
        defender.currentState = 'pursuing';
      }
      blocking.engagements.splice(index, 1);
    }
  }
}

export function resolvePlayerOverlaps(players: PlayerModel[]): void {
  for (let outer = 0; outer < players.length; outer += 1) {
    for (let inner = outer + 1; inner < players.length; inner += 1) {
      const first = players[outer];
      const second = players[inner];
      const minimumDistance =
        first.collisionRadius + second.collisionRadius + BLOCKING_CONFIG.minimumSeparationPadding;
      const deltaX = second.position.x - first.position.x;
      const deltaZ = second.position.z - first.position.z;
      const distance = Math.hypot(deltaX, deltaZ);

      if (distance >= minimumDistance) {
        continue;
      }

      const normal = distance === 0
        ? deterministicSeparationNormal(first.id, second.id)
        : { x: deltaX / distance, z: deltaZ / distance };
      const correction = (minimumDistance - distance) / 2;

      first.position.x -= normal.x * correction;
      first.position.z -= normal.z * correction;
      second.position.x += normal.x * correction;
      second.position.z += normal.z * correction;
    }
  }
}

export function getEngagedDefenderIds(blocking: BlockingState): Set<string> {
  return new Set(blocking.engagements.map((engagement) => engagement.defenderId));
}

function updateBlockers(
  players: PlayerModel[],
  blocking: BlockingState,
  lineOfScrimmage: FootballSpot,
  play: PlayDefinition,
  deltaSeconds: number,
): void {
  for (const blocker of players) {
    if (blocker.team !== 'offense' || blocker.role !== 'blocker') {
      continue;
    }

    if (getEngagementForBlocker(blocking, blocker.id)) {
      blocker.velocity.x = 0;
      blocker.velocity.z = 0;
      blocker.currentState = 'engaged';
      continue;
    }

    blocker.currentState = 'movingToLane';
    movePlayerToward(
      blocker,
      getBlockingLaneTarget(blocker, lineOfScrimmage, play),
      BLOCKING_CONFIG.blockerLaneSpeed,
      deltaSeconds,
    );
  }
}

function updateReceivers(
  players: PlayerModel[],
  lineOfScrimmage: FootballSpot,
  play: PlayDefinition,
  deltaSeconds: number,
  receiverRouteStates?: Record<string, ReceiverRouteState>,
): void {
  const localRouteStates: Record<string, ReceiverRouteState> = {};
  const routeStates = receiverRouteStates ?? localRouteStates;
  const snapPlacement = resolveSnapPlacement(lineOfScrimmage);

  for (const receiver of players) {
    if (receiver.team !== 'offense' || receiver.role !== 'receiver') {
      continue;
    }

    if (receiver.currentState === 'userControlled') {
      continue;
    }

    const routeDefinition = getRouteDefinition(play, receiver.id);
    const route = resolveReceiverRoute(play, receiver.id, snapPlacement);

    if (!routeDefinition || !route || routeDefinition.speedYardsPerSecond <= 0) {
      receiver.velocity.x = 0;
      receiver.velocity.z = 0;
      continue;
    }

    const routeState = routeStates[receiver.id] ??
      createReceiverRouteState(routeDefinition, receiver.id);
    const nextRouteState = advanceRouteState(
      routeState,
      route,
      deltaSeconds,
      routeDefinition.speedYardsPerSecond,
    );
    routeStates[receiver.id] = nextRouteState;
    receiver.currentState = 'runningRoute';
    moveReceiverAlongRoute(receiver, route, nextRouteState, routeDefinition.speedYardsPerSecond, deltaSeconds);
  }
}

function updateDefenders(
  players: PlayerModel[],
  blocking: BlockingState,
  runner: PlayerModel,
  play: PlayDefinition,
  deltaSeconds: number,
): void {
  const engagedDefenderIds = getEngagedDefenderIds(blocking);
  const passCompleted = play.kind === 'pass' && runner.role !== 'quarterback';

  for (const defender of players) {
    if (defender.team !== 'defense') {
      continue;
    }

    const isEngaged = engagedDefenderIds.has(defender.id);
    defender.currentState = isEngaged ? 'engaged' : 'pursuing';
    const coverageTarget =
      defender.role === 'coverageDefender' && !passCompleted
        ? getCoverageTarget(players, play, defender.id)
        : null;
    const deepHelpTarget =
      defender.role === 'coverageDefender' && !coverageTarget && !passCompleted
        ? getDeepHelpTarget(players, play, defender.id)
        : null;
    const target = coverageTarget ?? deepHelpTarget ?? runner;
    updateDefenderPursuit(
      defender,
      target,
      deltaSeconds,
      isEngaged ? BLOCKING_CONFIG.engagedDefenderSpeedMultiplier : 1,
    );
  }
}

function findAssignedDefender(
  blocker: PlayerModel,
  defenderId: string,
  defenders: PlayerModel[],
  blocking: BlockingState,
): PlayerModel | null {
  const defender = defenders.find((candidate) => candidate.id === defenderId);

  if (
    !defender ||
    getEngagedDefenderIds(blocking).has(defender.id) ||
    distanceBetween(blocker, defender) > BLOCKING_CONFIG.engageDistance
  ) {
    return null;
  }

  return defender;
}

function getCoverageTarget(
  players: PlayerModel[],
  play: PlayDefinition,
  defenderId: string,
): PlayerModel | null {
  const receiverId = getCoverageAssignmentReceiverId(play, defenderId);

  if (!receiverId) {
    return null;
  }

  return players.find((player) => player.id === receiverId) ?? null;
}

function getDeepHelpTarget(
  players: PlayerModel[],
  play: PlayDefinition,
  defenderId: string,
): PlayerModel | null {
  const receiverIds = getDeepHelpReceiverIds(play, defenderId);

  if (receiverIds.length === 0) {
    return null;
  }

  const receivers = receiverIds
    .map((receiverId) => players.find((player) => player.id === receiverId))
    .filter((player): player is PlayerModel => !!player);

  if (receivers.length === 0) {
    return null;
  }

  const midpoint = {
    x: receivers.reduce((sum, receiver) => sum + receiver.position.x, 0) / receivers.length,
    z: receivers.reduce((sum, receiver) => sum + receiver.position.z, 0) / receivers.length,
  };

  return {
    ...receivers[0],
    position: midpoint,
  };
}

function findNearestEligibleDefender(
  blocker: PlayerModel,
  defenders: PlayerModel[],
  blocking: BlockingState,
): PlayerModel | null {
  const engagedDefenderIds = getEngagedDefenderIds(blocking);
  let nearestDefender: PlayerModel | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const defender of defenders) {
    if (engagedDefenderIds.has(defender.id)) {
      continue;
    }

    const distance = distanceBetween(blocker, defender);
    if (distance > BLOCKING_CONFIG.engageDistance || distance >= nearestDistance) {
      continue;
    }

    nearestDefender = defender;
    nearestDistance = distance;
  }

  return nearestDefender;
}

function movePlayerToward(
  player: PlayerModel,
  target: FootballSpot,
  speed: number,
  deltaSeconds: number,
): void {
  const deltaX = target.x - player.position.x;
  const deltaZ = target.z - player.position.z;
  const distance = Math.hypot(deltaX, deltaZ);

  if (distance === 0) {
    player.velocity.x = 0;
    player.velocity.z = 0;
    return;
  }

  const stepDistance = Math.min(distance, speed * deltaSeconds);
  const normalX = deltaX / distance;
  const normalZ = deltaZ / distance;

  player.velocity.x = normalX * speed;
  player.velocity.z = normalZ * speed;
  player.position.x += normalX * stepDistance;
  player.position.z += normalZ * stepDistance;
  player.facingRadians = Math.atan2(normalX, normalZ);
}

function moveReceiverAlongRoute(
  receiver: PlayerModel,
  route: NonNullable<ReturnType<typeof resolveReceiverRoute>>,
  routeState: ReceiverRouteState,
  routeSpeedYardsPerSecond: number,
  deltaSeconds: number,
): void {
  const target = sampleRouteAtDistance(route, routeState.distanceAlongRoute);
  const tangent = getRouteTangentAtDistance(route, routeState.distanceAlongRoute);
  const deltaX = target.x - receiver.position.x;
  const deltaZ = target.z - receiver.position.z;
  const distance = Math.hypot(deltaX, deltaZ);
  const maxStepDistance =
    (routeSpeedYardsPerSecond + RECEIVER_ROUTE_FOLLOWING_CONFIG.maxRecoverySpeedYardsPerSecond) *
    Math.max(0, deltaSeconds);

  receiver.facingRadians = Math.atan2(tangent.x, tangent.z);

  if (distance === 0 || deltaSeconds <= 0) {
    receiver.velocity.x = 0;
    receiver.velocity.z = 0;
    return;
  }

  const stepDistance = Math.min(distance, maxStepDistance);
  const normalX = deltaX / distance;
  const normalZ = deltaZ / distance;

  receiver.position.x += normalX * stepDistance;
  receiver.position.z += normalZ * stepDistance;
  receiver.velocity.x = normalX * (stepDistance / deltaSeconds);
  receiver.velocity.z = normalZ * (stepDistance / deltaSeconds);
}

function keepNonCarriersInsidePlayableField(
  players: PlayerModel[],
  carrierId: string,
  bounds: PlayableFieldBounds,
): void {
  for (const player of players) {
    if (player.id === carrierId) {
      continue;
    }

    const minX = bounds.minX + player.collisionRadius;
    const maxX = bounds.maxX - player.collisionRadius;
    const minZ = bounds.minZ + player.collisionRadius;
    const maxZ = bounds.maxZ - player.collisionRadius;
    const clampedX = Math.min(maxX, Math.max(minX, player.position.x));
    const clampedZ = Math.min(maxZ, Math.max(minZ, player.position.z));

    if (clampedX !== player.position.x) {
      player.position.x = clampedX;
      player.velocity.x = 0;
    }

    if (clampedZ !== player.position.z) {
      player.position.z = clampedZ;
      player.velocity.z = 0;
    }
  }
}

function getEngagementForBlocker(
  blocking: BlockingState,
  blockerId: string,
): BlockingEngagement | undefined {
  return blocking.engagements.find((engagement) => engagement.blockerId === blockerId);
}

function findPlayer(players: PlayerModel[], playerId: string): PlayerModel | undefined {
  return players.find((player) => player.id === playerId);
}

function distanceBetween(first: PlayerModel, second: PlayerModel): number {
  return Math.hypot(first.position.x - second.position.x, first.position.z - second.position.z);
}

function deterministicSeparationNormal(firstId: string, secondId: string): Vector2 {
  const seed = hashString(firstId) - hashString(secondId);
  const angle = seed === 0 ? 0 : seed;

  return {
    x: Math.cos(angle),
    z: Math.sin(angle),
  };
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return hash || DEFENDER_CONFIG.initialFacingRadians;
}
