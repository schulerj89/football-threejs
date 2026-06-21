import type { GameplaySnapshot } from '../playState';
import type { PlayerSnapshot, Vector2 } from '../playerModel';
import { GAMEPLAY_CAMERA_CONFIG } from './CameraConfiguration';
import type {
  CameraFocusResult,
  FieldPlaneBounds,
  GameplayCameraFocus,
  GameplayCameraLookAhead,
  GameplayFocusRequest,
} from './CameraTypes';
import { clamp, normalizeDirection } from './CameraMath';

const DEFAULT_GAMEPLAY_FOCUS_HEIGHT = 1.1;

export function resolveOffensePerspectiveFocus({
  deltaSeconds,
  resetLineOfScrimmageSeconds,
  snapshot,
}: GameplayFocusRequest): GameplayCameraFocus {
  const nextResetLineOfScrimmageSeconds = resetLineOfScrimmageSeconds > 0
    ? Math.max(0, resetLineOfScrimmageSeconds - deltaSeconds)
    : resetLineOfScrimmageSeconds;

  const result = resolveGameplayCameraFocus(snapshot, {
    resetLineOfScrimmageSeconds: nextResetLineOfScrimmageSeconds,
  });

  return {
    ...result,
    focus: result.focusPosition,
    nextResetLineOfScrimmageSeconds,
    target: result.targetPosition,
  };
}

export function resolveGameplayCameraFocus(
  snapshot: GameplaySnapshot,
  options: { resetLineOfScrimmageSeconds?: number } = {},
): CameraFocusResult {
  const ballState = snapshot.ball?.state;
  const ballPossession = snapshot.ball?.possession;

  if (snapshot.playState === 'dead') {
    return resolveDeadBallFocus(snapshot);
  }

  if (snapshot.playState === 'gameOver') {
    return resolveGameOverFocus(snapshot);
  }

  if (snapshot.playState === 'live' && ballState?.kind === 'inFlight') {
    return resolvePassFlightFocus(snapshot);
  }

  if (snapshot.playState === 'live' && ballPossession?.kind === 'player') {
    return resolveLivePossessionFocus(snapshot);
  }

  return resolvePreSnapFocus(snapshot, (options.resetLineOfScrimmageSeconds ?? 0) > 0);
}

// Missing or non-finite ball coordinates fall back in snapshot order only:
// pre-snap/reset -> nextSnapSpot; live possession -> carrier/player/current spot;
// pass flight -> in-flight start/current spot; dead -> exactDeadBallSpot/result/ball/current spot.
function resolveDeadBallFocus(snapshot: GameplaySnapshot): CameraFocusResult {
  const deadBallSpot =
    toFiniteFocus(snapshot.exactDeadBallSpot) ??
    toFiniteFocus(snapshot.lastPlayResult?.endingBallSpot);
  if (deadBallSpot) {
    return createCameraFocusResult({
      focusPosition: deadBallSpot,
      focusSource: 'deadBallSpot',
      phase: 'deadBall',
      state: 'deadBall',
    });
  }

  const ballFocus = toFiniteFocus(snapshot.ball?.position);
  if (ballFocus) {
    return createCameraFocusResult({
      focusPosition: ballFocus,
      focusSource: 'ball',
      phase: 'deadBall',
      state: 'deadBall',
    });
  }

  return createCameraFocusResult({
    focusPosition: requireFallbackFocus(snapshot.nextBallSpot, snapshot.currentBallSpot, snapshot.nextSnapSpot),
    focusSource: 'currentBallSpotFallback',
    phase: 'deadBall',
    state: 'deadBall',
  });
}

function resolveGameOverFocus(snapshot: GameplaySnapshot): CameraFocusResult {
  const ballFocus = toFiniteFocus(snapshot.ball?.position);
  if (ballFocus) {
    return createCameraFocusResult({
      focusPosition: ballFocus,
      focusSource: 'ball',
      phase: 'gameOver',
      state: 'gameOver',
    });
  }

  return createCameraFocusResult({
    focusPosition: requireFallbackFocus(snapshot.currentBallSpot, snapshot.nextSnapSpot),
    focusSource: 'currentBallSpotFallback',
    phase: 'gameOver',
    state: 'gameOver',
  });
}

function resolvePassFlightFocus(snapshot: GameplaySnapshot): CameraFocusResult {
  const inFlightState = snapshot.ball.state.kind === 'inFlight' ? snapshot.ball.state : null;
  const focusPosition =
    toFiniteFocus(snapshot.ball.position) ??
    toFiniteFocus(inFlightState?.start) ??
    requireFallbackFocus(snapshot.currentBallSpot, snapshot.nextSnapSpot);
  const focusSource = toFiniteFocus(snapshot.ball.position)
    ? 'ball'
    : toFiniteFocus(inFlightState?.start)
      ? 'inFlightStartFallback'
      : 'currentBallSpotFallback';
  const lookAhead = createLookAhead(
    GAMEPLAY_CAMERA_CONFIG.offensePerspective.passFlightLookAhead,
    resolvePassFlightDirection(inFlightState),
  );
  const framingTargetPosition = toFiniteFocus(inFlightState?.target) ?? undefined;

  return createCameraFocusResult({
    focusPosition,
    focusSource,
    framingTargetPosition,
    lookAhead,
    phase: 'passFlight',
    state: 'passFlight',
  });
}

function resolveLivePossessionFocus(snapshot: GameplaySnapshot): CameraFocusResult {
  const ballFocus = toFiniteFocus(snapshot.ball?.position);
  if (ballFocus) {
    return createCameraFocusResult({
      focusPosition: ballFocus,
      focusSource: 'ball',
      lookAhead: createLookAhead(
        GAMEPLAY_CAMERA_CONFIG.offensePerspective.liveBallLookAhead,
        GAMEPLAY_CAMERA_CONFIG.playDirection,
      ),
      phase: 'livePossession',
      state: 'carrierFollow',
    });
  }

  const carrierId = snapshot.ball?.possession.kind === 'player'
    ? snapshot.ball.possession.playerId
    : null;
  const carrier = carrierId ? findPlayer(snapshot.players, carrierId) : null;
  const carrierFocus = toFiniteFocus(carrier?.position ?? snapshot.player?.position, 1.25);
  if (carrierFocus) {
    return createCameraFocusResult({
      focusPosition: carrierFocus,
      focusSource: 'carrierFallback',
      lookAhead: createLookAhead(
        GAMEPLAY_CAMERA_CONFIG.offensePerspective.liveBallLookAhead,
        GAMEPLAY_CAMERA_CONFIG.playDirection,
      ),
      phase: 'livePossession',
      state: 'carrierFollow',
    });
  }

  return createCameraFocusResult({
    focusPosition: requireFallbackFocus(snapshot.currentBallSpot, snapshot.nextSnapSpot),
    focusSource: 'currentBallSpotFallback',
    lookAhead: createLookAhead(
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.liveBallLookAhead,
      GAMEPLAY_CAMERA_CONFIG.playDirection,
    ),
    phase: 'livePossession',
    state: 'carrierFollow',
  });
}

function resolvePreSnapFocus(snapshot: GameplaySnapshot, isResettingLineOfScrimmage: boolean): CameraFocusResult {
  const focusPosition = requireFallbackFocus(snapshot.nextSnapSpot, snapshot.currentBallSpot);

  return createCameraFocusResult({
    cameraDistanceBehindFocus: GAMEPLAY_CAMERA_CONFIG.offensePerspective.preSnapDistanceBehindFocus,
    cameraFieldOfView: GAMEPLAY_CAMERA_CONFIG.offensePerspective.preSnapFieldOfView,
    cameraHeight: GAMEPLAY_CAMERA_CONFIG.offensePerspective.preSnapHeight,
    focusPosition,
    focusSource: isResettingLineOfScrimmage ? 'nextSnapSpot' : 'snapBall',
    phase: isResettingLineOfScrimmage ? 'resetLineOfScrimmage' : 'preSnap',
    state: isResettingLineOfScrimmage ? 'resetLineOfScrimmage' : 'preSnapFormation',
  });
}

interface CameraFocusResultInput {
  cameraDistanceBehindFocus?: number;
  cameraFieldOfView?: number;
  cameraHeight?: number;
  focusPosition: { x: number; y: number; z: number };
  focusSource: CameraFocusResult['focusSource'];
  framingTargetPosition?: { x: number; y: number; z: number };
  lookAhead?: GameplayCameraLookAhead;
  phase: CameraFocusResult['phase'];
  state: CameraFocusResult['state'];
}

function createCameraFocusResult(input: CameraFocusResultInput): CameraFocusResult {
  const targetLookAhead = input.lookAhead ??
    createLookAhead(
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.forwardLookAhead,
      GAMEPLAY_CAMERA_CONFIG.playDirection,
    );

  return {
    ...input,
    targetPosition: createGameplayLookTarget(input.focusPosition, targetLookAhead),
  };
}

function createLookAhead(distance: number, direction: Vector2): GameplayCameraLookAhead {
  return {
    direction: normalizeDirection(direction),
    distance,
  };
}

function resolvePassFlightDirection(
  inFlightState: Extract<GameplaySnapshot['ball']['state'], { kind: 'inFlight' }> | null,
): Vector2 {
  const start = toFiniteFocus(inFlightState?.start);
  const target = toFiniteFocus(inFlightState?.target);

  if (!start || !target) {
    return GAMEPLAY_CAMERA_CONFIG.playDirection;
  }

  return normalizeDirection({
    x: target.x - start.x,
    z: target.z - start.z,
  });
}

function createGameplayLookTarget(
  focus: { x: number; y: number; z: number },
  lookAhead: GameplayCameraLookAhead,
): { x: number; y: number; z: number } {
  return createGameplayFieldFocus(
    focus.x + lookAhead.direction.x * lookAhead.distance,
    focus.z + lookAhead.direction.z * lookAhead.distance,
    focus.y,
  );
}

function toFiniteFocus(
  point: { x?: unknown; y?: unknown; z?: unknown } | null | undefined,
  fallbackY = DEFAULT_GAMEPLAY_FOCUS_HEIGHT,
): { x: number; y: number; z: number } | null {
  if (!isFiniteNumber(point?.x) || !isFiniteNumber(point?.z)) {
    return null;
  }

  return createGameplayFieldFocus(
    point.x,
    point.z,
    isFiniteNumber(point.y) ? point.y : fallbackY,
  );
}

function requireFallbackFocus(
  ...spots: ({ x?: unknown; y?: unknown; z?: unknown } | null | undefined)[]
): { x: number; y: number; z: number } {
  for (const spot of spots) {
    const focus = toFiniteFocus(spot);

    if (focus) {
      return focus;
    }
  }

  return createGameplayFieldFocus(0, 0, DEFAULT_GAMEPLAY_FOCUS_HEIGHT);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

function createGameplayFieldFocus(
  x: number,
  z: number,
  y: number,
): { x: number; y: number; z: number } {
  return createFieldFocus(x, z, y, GAMEPLAY_CAMERA_CONFIG.offensePerspective);
}

function findPlayer(players: PlayerSnapshot[], playerId: string): PlayerSnapshot | null {
  return players.find((player) => player.id === playerId) ?? null;
}
