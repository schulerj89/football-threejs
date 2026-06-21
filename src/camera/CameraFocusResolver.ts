import type { GameplaySnapshot } from '../playState';
import type { PlayerSnapshot, Vector2 } from '../playerModel';
import { GAMEPLAY_CAMERA_CONFIG } from './CameraConfiguration';
import type { FieldPlaneBounds, GameplayCameraFocus, GameplayFocusRequest } from './CameraTypes';
import { clamp } from './CameraMath';

export function resolveOffensePerspectiveFocus({
  deltaSeconds,
  resetLineOfScrimmageSeconds,
  snapshot,
}: GameplayFocusRequest): GameplayCameraFocus {
  const nextResetLineOfScrimmageSeconds = resetLineOfScrimmageSeconds > 0
    ? Math.max(0, resetLineOfScrimmageSeconds - deltaSeconds)
    : resetLineOfScrimmageSeconds;

  if (snapshot.playState === 'dead') {
    const deadBallSpot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.nextSnapSpot;
    const focus = createGameplayFieldFocus(deadBallSpot.x, deadBallSpot.z, 1.1);

    return {
      focus,
      nextResetLineOfScrimmageSeconds,
      state: 'deadBall',
      target: createGameplayForwardTarget(focus),
    };
  }

  if (snapshot.playState === 'gameOver') {
    const focus = createGameplayFieldFocus(
      snapshot.currentBallSpot.x,
      snapshot.currentBallSpot.z,
      1.1,
    );

    return {
      focus,
      nextResetLineOfScrimmageSeconds,
      state: 'gameOver',
      target: createGameplayForwardTarget(focus),
    };
  }

  if (snapshot.playState === 'live' && snapshot.ball.state.kind === 'inFlight') {
    const focus = createGameplayFieldFocus(
      snapshot.ball.position.x,
      snapshot.ball.position.z,
      Math.max(1.1, snapshot.ball.position.y),
    );
    const target = createGameplayFieldFocus(
      snapshot.ball.state.target.x,
      snapshot.ball.state.target.z,
      Math.max(1.1, snapshot.ball.state.target.y),
    );

    return {
      focus,
      nextResetLineOfScrimmageSeconds,
      state: 'passFlight',
      target,
    };
  }

  if (snapshot.playState === 'live' && snapshot.ball.possession.kind === 'player') {
    const carrier = findPlayer(snapshot.players, snapshot.ball.possession.playerId) ?? snapshot.player;
    const focus = createGameplayFieldFocus(carrier.position.x, carrier.position.z, 1.25);

    return {
      focus,
      nextResetLineOfScrimmageSeconds,
      state: 'carrierFollow',
      target: createGameplayForwardTarget(focus),
    };
  }

  const formationFocusX = calculateFormationFocusX(snapshot.players);
  const focus = createGameplayFieldFocus(formationFocusX, snapshot.drive.lineOfScrimmage.z, 1.15);

  return {
    focus,
    nextResetLineOfScrimmageSeconds,
    state: nextResetLineOfScrimmageSeconds > 0 ? 'resetLineOfScrimmage' : 'preSnapFormation',
    target: createGameplayForwardTarget(focus),
  };
}

export function calculateFormationBounds(players: PlayerSnapshot[]): FieldPlaneBounds {
  if (players.length === 0) {
    return {
      center: { x: 0, z: 0 },
      max: { x: 0, z: 0 },
      min: { x: 0, z: 0 },
      playerIds: [],
      size: { x: 0, z: 0 },
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const player of players) {
    minX = Math.min(minX, player.position.x - player.collisionRadius);
    maxX = Math.max(maxX, player.position.x + player.collisionRadius);
    minZ = Math.min(minZ, player.position.z - player.collisionRadius);
    maxZ = Math.max(maxZ, player.position.z + player.collisionRadius);
  }

  return {
    center: {
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
    },
    max: {
      x: maxX,
      z: maxZ,
    },
    min: {
      x: minX,
      z: minZ,
    },
    playerIds: players.map((player) => player.id).sort(),
    size: {
      x: maxX - minX,
      z: maxZ - minZ,
    },
  };
}

export function getBallCarrier(snapshot: GameplaySnapshot): PlayerSnapshot | null {
  const possession = snapshot.ball.possession;

  if (possession.kind !== 'player') {
    return null;
  }

  return snapshot.players.find((player) => player.id === possession.playerId) ?? null;
}

export function createPrePlayShotKey(
  snapshot: GameplaySnapshot,
  formationBounds: FieldPlaneBounds,
): string {
  return [
    snapshot.selectedPlay.id,
    snapshot.nextSnapSpot.x.toFixed(2),
    snapshot.nextSnapSpot.z.toFixed(2),
    formationBounds.center.x.toFixed(2),
    formationBounds.center.z.toFixed(2),
    formationBounds.size.x.toFixed(2),
    formationBounds.size.z.toFixed(2),
    formationBounds.playerIds.join(','),
  ].join('|');
}

export function createFieldFocus(
  x: number,
  z: number,
  y: number,
  bounds: {
    minimumFieldPosition: { x: number; z: number };
    maximumFieldPosition: { x: number; z: number };
  },
): { x: number; y: number; z: number } {
  return {
    x: clamp(x, bounds.minimumFieldPosition.x, bounds.maximumFieldPosition.x),
    y,
    z: clamp(z, bounds.minimumFieldPosition.z, bounds.maximumFieldPosition.z),
  };
}

export function createForwardTarget(
  focus: { x: number; y: number; z: number },
  playDirection: Vector2,
  lookAhead: number,
  bounds: {
    minimumFieldPosition: { x: number; z: number };
    maximumFieldPosition: { x: number; z: number };
  },
): { x: number; y: number; z: number } {
  return createFieldFocus(
    focus.x + playDirection.x * lookAhead,
    focus.z + playDirection.z * lookAhead,
    Math.max(1, focus.y * 0.7),
    bounds,
  );
}

function createGameplayForwardTarget(
  focus: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return {
    x: focus.x + GAMEPLAY_CAMERA_CONFIG.playDirection.x *
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.forwardLookAhead,
    y: 1.1,
    z: focus.z + GAMEPLAY_CAMERA_CONFIG.playDirection.z *
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.forwardLookAhead,
  };
}

function createGameplayFieldFocus(
  x: number,
  z: number,
  y: number,
): { x: number; y: number; z: number } {
  return createFieldFocus(x, z, y, GAMEPLAY_CAMERA_CONFIG.offensePerspective);
}

function calculateFormationFocusX(players: PlayerSnapshot[]): number {
  if (players.length === 0) {
    return 0;
  }

  const playerXs = players.map((player) => player.position.x);

  return (Math.min(...playerXs) + Math.max(...playerXs)) / 2;
}

function findPlayer(players: PlayerSnapshot[], playerId: string): PlayerSnapshot | null {
  return players.find((player) => player.id === playerId) ?? null;
}
