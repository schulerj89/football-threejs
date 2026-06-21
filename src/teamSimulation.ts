import type { PlayableFieldBounds } from './field';
import {
  getBlockingLaneTarget,
  getCoverageAssignmentReceiverId,
  getReceiverRouteSpeed,
  getReceiverRouteTarget,
  type PlayDefinition,
} from './playbook';
import type { FootballSpot } from './fieldScale';
import { DEFENDER_CONFIG, updateDefenderPursuit } from './defenderModel';
import type { PlayerModel, Vector2 } from './playerModel';

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
}

export const BLOCKING_CONFIG = {
  blockerLaneSpeed: 8.5,
  engageDistance: 2.1,
  disengageDistance: 3.4,
  engagedDefenderSpeedMultiplier: 0.35,
  minimumSeparationPadding: 0,
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

  releaseSeparatedEngagements(players, blocking);
  updateBlockers(players, blocking, options.lineOfScrimmage, options.play, delta);
  updateReceivers(players, options.lineOfScrimmage, options.play, delta);
  acquireBlockingEngagements(players, blocking);
  updateDefenders(players, blocking, runner, options.play, delta);
  keepNonCarriersInsidePlayableField(players, runner.id, options.bounds);
  resolvePlayerOverlaps(players);
  keepNonCarriersInsidePlayableField(players, runner.id, options.bounds);
  releaseSeparatedEngagements(players, blocking);
}

export function acquireBlockingEngagements(players: PlayerModel[], blocking: BlockingState): void {
  const blockers = players.filter((player) => player.team === 'offense' && player.role === 'blocker');
  const defenders = players.filter((player) => player.team === 'defense' && player.role === 'defender');

  for (const blocker of blockers) {
    if (getEngagementForBlocker(blocking, blocker.id)) {
      continue;
    }

    const defender = findNearestEligibleDefender(blocker, defenders, blocking);
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
): void {
  for (const receiver of players) {
    if (receiver.team !== 'offense' || receiver.role !== 'receiver') {
      continue;
    }

    const routeTarget = getReceiverRouteTarget(receiver, lineOfScrimmage, play);
    const routeSpeed = getReceiverRouteSpeed(receiver, play);

    if (!routeTarget || routeSpeed <= 0) {
      receiver.velocity.x = 0;
      receiver.velocity.z = 0;
      continue;
    }

    receiver.currentState = receiver.currentState === 'userControlled'
      ? 'userControlled'
      : 'runningRoute';
    if (receiver.currentState === 'runningRoute') {
      movePlayerToward(receiver, routeTarget, routeSpeed, deltaSeconds);
    }
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

  for (const defender of players) {
    if (defender.team !== 'defense') {
      continue;
    }

    const isEngaged = engagedDefenderIds.has(defender.id);
    defender.currentState = isEngaged ? 'engaged' : 'pursuing';
    const coverageTarget =
      defender.role === 'coverageDefender'
        ? getCoverageTarget(players, play, defender.id)
        : null;
    const target = coverageTarget ?? runner;
    updateDefenderPursuit(
      defender,
      target,
      deltaSeconds,
      isEngaged ? BLOCKING_CONFIG.engagedDefenderSpeedMultiplier : 1,
    );
  }
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
