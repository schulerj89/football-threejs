import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GAMEPLAY_CAMERA_CONFIG } from '../../src/camera/CameraConfiguration';
import { resolveGameplayCameraFocus } from '../../src/camera/CameraFocusResolver';
import { GameplayCameraController } from '../../src/camera/GameplayCameraController';
import {
  attemptPass,
  createGameplayModel,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
  updateGameplayModel,
} from '../../src/playState';
import type { GameplaySnapshot } from '../../src/playState';

describe('gameplay camera focus resolver', () => {
  it('focuses the pre-snap camera on the authoritative snap spot', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    snapshot.nextSnapSpot.x = 8;
    snapshot.nextSnapSpot.z = -14;
    snapshot.players[0].position.x = -20;
    snapshot.players[1].position.x = 20;

    const focus = resolveGameplayCameraFocus(snapshot);

    expect(focus.phase).toBe('preSnap');
    expect(focus.focusSource).toBe('snapBall');
    expect(focus.focusPosition.x).toBeCloseTo(snapshot.nextSnapSpot.x);
    expect(focus.focusPosition.z).toBeCloseTo(snapshot.nextSnapSpot.z);
  });

  it('uses authoritative ball position instead of carrier root during live possession', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    startPlay(gameplay);
    const snapshot = snapshotGameplayModel(gameplay);
    snapshot.ball.position = {
      x: snapshot.player.position.x + 3,
      y: 0.72,
      z: snapshot.player.position.z + 2,
    };

    const focus = resolveGameplayCameraFocus(snapshot);

    expect(focus.phase).toBe('livePossession');
    expect(focus.focusSource).toBe('ball');
    expect(focus.focusPosition).toEqual(snapshot.ball.position);
  });

  it('uses only the configured small look-ahead for an in-flight pass', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    selectPlay(gameplay, 'slant-flat');
    startPlay(gameplay);
    attemptPass(gameplay);
    const snapshot = snapshotGameplayModel(gameplay);

    if (snapshot.ball.state.kind !== 'inFlight') {
      throw new Error('Expected pass to be in flight');
    }

    const focus = resolveGameplayCameraFocus(snapshot);
    const actualLookAhead = horizontalDistance(focus.focusPosition, focus.targetPosition);
    const passTargetDistance = horizontalDistance(focus.focusPosition, snapshot.ball.state.target);

    expect(focus.phase).toBe('passFlight');
    expect(focus.focusSource).toBe('ball');
    expect(focus.focusPosition).toEqual(snapshot.ball.position);
    expect(focus.lookAhead?.distance).toBe(GAMEPLAY_CAMERA_CONFIG.offensePerspective.passFlightLookAhead);
    expect(actualLookAhead).toBeLessThanOrEqual(
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.passFlightLookAhead + 0.001,
    );
    expect(actualLookAhead).toBeLessThan(passTargetDistance);
    expect(focus.framingTargetPosition?.x).toBeCloseTo(snapshot.ball.state.target.x);
    expect(focus.framingTargetPosition?.z).toBeCloseTo(snapshot.ball.state.target.z);
  });

  it('focuses the exact dead-ball spot and reset transition spot', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const deadSnapshot = snapshotGameplayModel(gameplay);
    deadSnapshot.playState = 'dead';
    deadSnapshot.exactDeadBallSpot = { x: 6, z: -9 };

    const deadFocus = resolveGameplayCameraFocus(deadSnapshot);
    expect(deadFocus.phase).toBe('deadBall');
    expect(deadFocus.focusSource).toBe('deadBallSpot');
    expect(deadFocus.focusPosition.x).toBeCloseTo(6);
    expect(deadFocus.focusPosition.z).toBeCloseTo(-9);

    const resetSnapshot = snapshotGameplayModel(gameplay);
    resetSnapshot.nextSnapSpot = { x: -7, z: -18 };
    const resetFocus = resolveGameplayCameraFocus(resetSnapshot, {
      resetLineOfScrimmageSeconds: 0.4,
    });
    expect(resetFocus.phase).toBe('resetLineOfScrimmage');
    expect(resetFocus.focusSource).toBe('nextSnapSpot');
    expect(resetFocus.focusPosition.x).toBeCloseTo(resetSnapshot.nextSnapSpot.x);
    expect(resetFocus.focusPosition.z).toBeCloseTo(resetSnapshot.nextSnapSpot.z);
  });

  it('follows the ball during an active touchdown runout before returning to exact dead-ball focus', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    startPlay(gameplay);
    gameplay.player.position.z = 49.5;
    updateGameplayModel(gameplay, 0);
    updateGameplayModel(gameplay, 1 / 60);

    const runoutSnapshot = snapshotGameplayModel(gameplay);
    const runoutFocus = resolveGameplayCameraFocus(runoutSnapshot);

    expect(runoutSnapshot.lastPlayResult?.type).toBe('touchdown');
    expect(runoutSnapshot.touchdownRunout?.completed).toBe(false);
    expect(runoutFocus.focusSource).toBe('ball');
    expect(runoutFocus.focusPosition.z).toBeCloseTo(runoutSnapshot.ball.position.z);

    for (let step = 0; step < 70; step += 1) {
      updateGameplayModel(gameplay, 1 / 60);
    }

    const completedSnapshot = snapshotGameplayModel(gameplay);
    const completedFocus = resolveGameplayCameraFocus(completedSnapshot);
    expect(completedSnapshot.touchdownRunout?.completed).toBe(true);
    expect(completedFocus.focusSource).toBe('deadBallSpot');
    expect(completedFocus.focusPosition.z).toBeCloseTo(
      completedSnapshot.lastPlayResult?.endingBallSpot.z ?? Number.NaN,
    );
  });

  it('falls back deterministically when live possession ball coordinates are missing', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    startPlay(gameplay);
    const snapshot = snapshotGameplayModel(gameplay);
    const carrier = getCarrier(snapshot);
    (snapshot.ball as { position?: unknown }).position = undefined;

    const focus = resolveGameplayCameraFocus(snapshot);

    expect(focus.focusSource).toBe('carrierFallback');
    expect(focus.focusPosition.x).toBeCloseTo(carrier.position.x);
    expect(focus.focusPosition.z).toBeCloseTo(carrier.position.z);
  });
});

describe('gameplay camera ball projection', () => {
  it('keeps the ball near NDC center during ordinary live possession', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    startPlay(gameplay);
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'off',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });

    controller.update(snapshot, 0);

    const ndc = projectBallToNdc(controller.camera, snapshot.ball.position);
    expect(Math.abs(ndc.x)).toBeLessThanOrEqual(
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.ballCenterNdcTolerance,
    );
    expect(Math.abs(ndc.y)).toBeLessThanOrEqual(
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.ballCenterNdcTolerance,
    );
  });

  it('keeps an in-flight pass near NDC center with ball-centered look-ahead', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    selectPlay(gameplay, 'slant-flat');
    startPlay(gameplay);
    attemptPass(gameplay);
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'off',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });

    controller.update(snapshot, 0);

    const ndc = projectBallToNdc(controller.camera, snapshot.ball.position);
    expect(Math.abs(ndc.x)).toBeLessThanOrEqual(
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.ballCenterNdcTolerance,
    );
    expect(Math.abs(ndc.y)).toBeLessThanOrEqual(
      GAMEPLAY_CAMERA_CONFIG.offensePerspective.ballCenterNdcTolerance,
    );
  });
});

function getCarrier(snapshot: GameplaySnapshot): GameplaySnapshot['player'] {
  const possession = snapshot.ball.possession;
  if (possession.kind !== 'player') {
    throw new Error('Expected ball possession');
  }

  return snapshot.players.find((player) => player.id === possession.playerId) ??
    snapshot.player;
}

function projectBallToNdc(
  camera: THREE.Camera,
  position: { x: number; y: number; z: number },
): THREE.Vector3 {
  camera.updateMatrixWorld(true);
  if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }

  return new THREE.Vector3(position.x, position.y, position.z).project(camera);
}

function horizontalDistance(
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
