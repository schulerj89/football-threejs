import * as THREE from 'three';
import { FIELD_BOUNDS } from '../fieldSpec';
import type { GameplaySnapshot } from '../playState';
import type { Vector2 } from '../playerModel';
import {
  createFieldFocus,
  createForwardTarget,
  getBallCarrier,
} from './CameraFocusResolver';
import type {
  FieldPlaneBounds,
  PresentationCameraConfig,
  PresentationCameraPhase,
} from './CameraTypes';
import { clamp, toVector3 } from './CameraMath';
import type { PresentationCameraShot } from './PresentationShotDefinitions';

export function createPresentationPhaseShot({
  config,
  formationBounds,
  phase,
  playDirection,
  sidelineDirection,
  snapshot,
}: {
  config: PresentationCameraConfig;
  formationBounds: FieldPlaneBounds;
  phase: PresentationCameraPhase;
  playDirection: Vector2;
  sidelineDirection: Vector2;
  snapshot: GameplaySnapshot;
}): PresentationCameraShot {
  const context = { config, playDirection, sidelineDirection };

  if (phase === 'preSnapEstablish') {
    return createFormationEstablishShot(context, formationBounds, phase);
  }

  if (phase === 'transitionToGameplay') {
    return createTransitionShot(context, snapshot, formationBounds, phase);
  }

  if (phase === 'passFlight') {
    return createPassFlightShot(context, snapshot, phase);
  }

  if (phase === 'touchdownResult') {
    return createTouchdownShot(context, snapshot, phase);
  }

  if (phase === 'deadBallResult') {
    return createDeadBallShot(context, snapshot, phase);
  }

  if (phase === 'returnToPreSnap') {
    return createReturnToPreSnapShot(context, snapshot, phase);
  }

  return createCarrierShot(context, snapshot, phase);
}

interface StaticShotContext {
  config: PresentationCameraConfig;
  playDirection: Vector2;
  sidelineDirection: Vector2;
}

function createFormationEstablishShot(
  context: StaticShotContext,
  formationBounds: FieldPlaneBounds,
  phase: PresentationCameraPhase,
): PresentationCameraShot {
  const config = context.config.phases[phase];
  const focus = createPresentationFieldFocus(context, formationBounds.center.x, formationBounds.center.z, 1.3);
  const distance = config.distance + formationBounds.size.z * 0.28;
  const sidelineOffset = (config.sidelineOffset ?? 0) + formationBounds.size.x * 0.12;

  return createStaticShot(context, {
    focus,
    lookTarget: createPresentationForwardTarget(context, focus, config.lookAhead),
    phase,
    position: offsetFromFocus(context, focus, {
      distanceBehind: distance,
      height: config.height,
      sidelineOffset,
    }),
  });
}

function createTransitionShot(
  context: StaticShotContext,
  snapshot: GameplaySnapshot,
  formationBounds: FieldPlaneBounds,
  phase: PresentationCameraPhase,
): PresentationCameraShot {
  const carrier = getBallCarrier(snapshot) ?? snapshot.player;
  const focus = snapshot.playState === 'live'
    ? createPresentationFieldFocus(context, carrier.position.x, carrier.position.z, 1.25)
    : createPresentationFieldFocus(context, formationBounds.center.x, snapshot.drive.lineOfScrimmage.z, 1.2);
  const config = context.config.phases[phase];

  return createStaticShot(context, {
    focus,
    lookTarget: createPresentationForwardTarget(context, focus, config.lookAhead),
    phase,
    position: offsetFromFocus(context, focus, {
      distanceBehind: config.distance,
      height: config.height,
    }),
  });
}

function createCarrierShot(
  context: StaticShotContext,
  snapshot: GameplaySnapshot,
  phase: PresentationCameraPhase,
): PresentationCameraShot {
  const carrier = getBallCarrier(snapshot) ?? snapshot.player;
  const config = context.config.phases[phase];
  const focus = createPresentationFieldFocus(context, carrier.position.x, carrier.position.z, 1.3);

  return createStaticShot(context, {
    focus,
    lookTarget: createPresentationForwardTarget(context, focus, config.lookAhead),
    phase,
    position: offsetFromFocus(context, focus, {
      distanceBehind: config.distance,
      height: config.height,
    }),
  });
}

function createPassFlightShot(
  context: StaticShotContext,
  snapshot: GameplaySnapshot,
  phase: PresentationCameraPhase,
): PresentationCameraShot {
  const config = context.config.phases[phase];

  if (snapshot.ball.state.kind !== 'inFlight') {
    return createCarrierShot(context, snapshot, 'liveCarrier');
  }

  const ball = snapshot.ball.position;
  const target = snapshot.ball.state.target;
  const focus = createPresentationFieldFocus(
    context,
    (ball.x + target.x) / 2,
    (ball.z + target.z) / 2,
    Math.max(1.4, Math.min(5, (ball.y + target.y) / 2 + 1.1)),
  );

  return createStaticShot(context, {
    focus,
    lookTarget: createPresentationFieldFocus(context, target.x, target.z, Math.max(1.1, target.y + 1)),
    phase,
    position: offsetFromFocus(context, focus, {
      distanceBehind: config.distance,
      height: config.height,
    }),
  });
}

function createDeadBallShot(
  context: StaticShotContext,
  snapshot: GameplaySnapshot,
  phase: PresentationCameraPhase,
): PresentationCameraShot {
  const config = context.config.phases[phase];
  const spot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.nextSnapSpot;
  const focus = createPresentationFieldFocus(context, spot.x, spot.z, 1.2);

  return createStaticShot(context, {
    focus,
    lookTarget: createPresentationForwardTarget(context, focus, config.lookAhead),
    phase,
    position: offsetFromFocus(context, focus, {
      distanceBehind: config.distance,
      height: config.height,
    }),
  });
}

function createTouchdownShot(
  context: StaticShotContext,
  snapshot: GameplaySnapshot,
  phase: PresentationCameraPhase,
): PresentationCameraShot {
  const config = context.config.phases[phase];
  const spot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.player.position;
  const focus = createPresentationFieldFocus(context, spot.x, spot.z, 1.25);

  return createStaticShot(context, {
    focus,
    lookTarget: createPresentationForwardTarget(context, focus, config.lookAhead),
    phase,
    position: offsetFromFocus(context, focus, {
      distanceBehind: -config.distance,
      height: config.height,
      sidelineOffset: config.sidelineOffset ?? 0,
    }),
  });
}

function createReturnToPreSnapShot(
  context: StaticShotContext,
  snapshot: GameplaySnapshot,
  phase: PresentationCameraPhase,
): PresentationCameraShot {
  const config = context.config.phases[phase];
  const snap = snapshot.nextSnapSpot ?? snapshot.drive.lineOfScrimmage;
  const focus = createPresentationFieldFocus(context, snap.x, snap.z, 1.2);

  return createStaticShot(context, {
    focus,
    lookTarget: createPresentationForwardTarget(context, focus, config.lookAhead),
    phase,
    position: offsetFromFocus(context, focus, {
      distanceBehind: config.distance,
      height: config.height,
    }),
  });
}

function createStaticShot(
  context: StaticShotContext,
  options: {
    focus: THREE.Vector3;
    lookTarget: THREE.Vector3;
    phase: PresentationCameraPhase;
    position: THREE.Vector3;
  },
): PresentationCameraShot {
  return {
    activeShotName: null,
    fieldOfView: context.config.fieldOfView,
    focus: options.focus,
    lookTarget: options.lookTarget,
    orbitCenter: null,
    orbitRadius: null,
    phase: options.phase,
    position: preventCameraClipping(context, options.position),
    restoreCamera: null,
    shotProgress: null,
  };
}

function offsetFromFocus(
  context: StaticShotContext,
  focus: THREE.Vector3,
  options: { distanceBehind: number; height: number; sidelineOffset?: number },
): THREE.Vector3 {
  return new THREE.Vector3(
    focus.x - context.playDirection.x * options.distanceBehind +
      context.sidelineDirection.x * (options.sidelineOffset ?? 0),
    options.height,
    focus.z - context.playDirection.z * options.distanceBehind +
      context.sidelineDirection.z * (options.sidelineOffset ?? 0),
  );
}

function createPresentationForwardTarget(
  context: StaticShotContext,
  focus: THREE.Vector3,
  lookAhead: number,
): THREE.Vector3 {
  return toVector3(createForwardTarget(focus, context.playDirection, lookAhead, context.config));
}

function createPresentationFieldFocus(
  context: StaticShotContext,
  x: number,
  z: number,
  y: number,
): THREE.Vector3 {
  return toVector3(createFieldFocus(x, z, y, context.config));
}

function preventCameraClipping(context: StaticShotContext, position: THREE.Vector3): THREE.Vector3 {
  const padding = context.config.cinematics.fieldPadding;

  return new THREE.Vector3(
    clamp(position.x, FIELD_BOUNDS.minX - padding, FIELD_BOUNDS.maxX + padding),
    Math.max(context.config.cinematics.minimumCameraHeight, position.y),
    clamp(position.z, FIELD_BOUNDS.minZ - padding, FIELD_BOUNDS.maxZ + padding),
  );
}
