import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  GameplayCameraController,
  resolveCinematicsSetting,
  resolveGameplayCameraMode,
  resolvePresentationShotPreview,
} from '../src/camera/GameplayCameraController';
import {
  attemptPass,
  createGameplayModel,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
} from '../src/playState';
import {
  createFormationPreviewModel,
  snapshotFormationPreviewAsGameplay,
} from '../src/formationPreview';
import type { PlayerSnapshot } from '../src/playerModel';

describe('gameplay camera controller', () => {
  it('resolves camera URL aliases', () => {
    expect(resolveGameplayCameraMode(null)).toBe('tacticalOrthographic');
    expect(resolveGameplayCameraMode('tactical')).toBe('tacticalOrthographic');
    expect(resolveGameplayCameraMode('offense')).toBe('offensePerspective');
    expect(resolveGameplayCameraMode('offensePerspective')).toBe('offensePerspective');
    expect(resolveGameplayCameraMode('cinematic')).toBe('cinematicBroadcast');
    expect(resolveGameplayCameraMode('cinematicBroadcast')).toBe('cinematicBroadcast');
    expect(resolveCinematicsSetting(null)).toBe('off');
    expect(resolveCinematicsSetting('off')).toBe('off');
    expect(resolveCinematicsSetting('brief')).toBe('brief');
    expect(resolveCinematicsSetting('full')).toBe('full');
    expect(resolveCinematicsSetting('bad')).toBe('off');
    expect(resolvePresentationShotPreview('prePlayOrbit180')).toBe('prePlayOrbit180');
    expect(resolvePresentationShotPreview('touchdownOrbit360')).toBe('touchdownOrbit360');
    expect(resolvePresentationShotPreview('bad')).toBeNull();
  });

  it('uses the tactical orthographic camera by default', () => {
    const gameplay = createGameplayModel();
    const controller = new GameplayCameraController({ height: 900, width: 1440 });

    controller.update(snapshotGameplayModel(gameplay), 0);

    expect(controller.camera).toBeInstanceOf(THREE.OrthographicCamera);
    expect(controller.getDebugSnapshot()).toMatchObject({
      mode: 'tacticalOrthographic',
      state: 'tacticalOverview',
    });
  });

  it('frames the line of scrimmage in offense perspective before the snap', () => {
    const gameplay = createGameplayModel();
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'off',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });

    controller.update(snapshot, 0);

    const cameraSnapshot = controller.getDebugSnapshot();
    expect(controller.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(cameraSnapshot).toMatchObject({
      mode: 'offensePerspective',
      state: 'preSnapFormation',
    });
    expect(cameraSnapshot.focusPosition.z).toBeCloseTo(snapshot.drive.lineOfScrimmage.z);
    expect(cameraSnapshot.cameraPosition.z).toBeLessThan(cameraSnapshot.focusPosition.z);
    expect(cameraSnapshot.targetPosition.z).toBeGreaterThan(cameraSnapshot.focusPosition.z);
  });

  it('tracks an in-flight pass toward the pass target', () => {
    const gameplay = createGameplayModel();
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

    expect(snapshot.ball.state.kind).toBe('inFlight');
    if (snapshot.ball.state.kind !== 'inFlight') {
      throw new Error('Expected pass to be in flight');
    }

    const cameraSnapshot = controller.getDebugSnapshot();
    expect(cameraSnapshot.state).toBe('passFlight');
    expect(cameraSnapshot.focusPosition.x).toBeCloseTo(snapshot.ball.position.x);
    expect(cameraSnapshot.focusPosition.z).toBeCloseTo(snapshot.ball.position.z);
    expect(cameraSnapshot.targetPosition.x).toBeCloseTo(snapshot.ball.state.target.x);
    expect(cameraSnapshot.targetPosition.z).toBeCloseTo(snapshot.ball.state.target.z);
  });

  it('frames every 7v7 preview player in both camera modes', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const snapshot = snapshotFormationPreviewAsGameplay(preview);
    const tactical = new GameplayCameraController({
      cinematics: 'off',
      height: 900,
      initialMode: 'tacticalOrthographic',
      width: 1440,
    });
    const offense = new GameplayCameraController({
      cinematics: 'off',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });

    tactical.update(snapshot, 0);
    offense.update(snapshot, 0);

    expect(getUnframedPlayerIds(tactical.camera, snapshot.players)).toEqual([]);
    expect(getUnframedPlayerIds(offense.camera, snapshot.players)).toEqual([]);
  });

  it('runs cinematic mode through presentation phases and frames 7v7 preview players', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const snapshot = snapshotFormationPreviewAsGameplay(preview);
    const cinematic = new GameplayCameraController({
      height: 900,
      initialMode: 'cinematicBroadcast',
      width: 1440,
    });

    cinematic.update(snapshot, 0);

    const debug = cinematic.getDebugSnapshot();
    expect(cinematic.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(debug).toMatchObject({
      mode: 'cinematicBroadcast',
      presentationPhase: 'preSnapEstablish',
      state: 'cinematicBroadcast',
    });
    expect(debug.formationBounds?.playerIds).toEqual(snapshot.players.map((player) => player.id).sort());
    expect(getUnframedPlayerIds(cinematic.camera, snapshot.players)).toEqual([]);
  });

  it('cycles development camera modes without replacing existing modes', () => {
    const gameplay = createGameplayModel();
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({ height: 900, width: 1440 });

    expect(controller.getMode()).toBe('tacticalOrthographic');
    expect(controller.toggleMode(snapshot)).toBe('offensePerspective');
    expect(controller.toggleMode(snapshot)).toBe('cinematicBroadcast');
    expect(controller.toggleMode(snapshot)).toBe('tacticalOrthographic');
  });

  it('uses a transient orbit camera without changing the selected gameplay mode', () => {
    const gameplay = createGameplayModel();
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'brief',
      height: 900,
      initialMode: 'tacticalOrthographic',
      width: 1440,
    });

    controller.update(snapshot, 0);

    const debug = controller.getDebugSnapshot();
    expect(controller.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(controller.getMode()).toBe('tacticalOrthographic');
    expect(debug).toMatchObject({
      activeShotName: 'prePlayOrbit180',
      mode: 'tacticalOrthographic',
      restoreCamera: 'tacticalOrthographic',
      state: 'cinematicBroadcast',
    });
  });

  it('can skip a transient orbit shot and restore the selected camera', () => {
    const gameplay = createGameplayModel();
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'brief',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });

    controller.update(snapshot, 0);
    expect(controller.skipPresentationShot()).toBe(true);
    controller.update(snapshot, 0.016);

    expect(controller.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    const debug = controller.getDebugSnapshot();
    expect(debug.activeShotName).toBeUndefined();
    expect(debug).toMatchObject({
      mode: 'offensePerspective',
      state: 'preSnapFormation',
    });
  });

  it('calculates pre-play orbit paths for every snap lane', () => {
    for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
      const preview = createFormationPreviewModel('7v7', lane);
      const snapshot = snapshotFormationPreviewAsGameplay(preview);
      const controller = new GameplayCameraController({
        cinematics: 'full',
        height: 900,
        initialMode: 'offensePerspective',
        width: 1440,
      });

      controller.update(snapshot, 0);
      const debug = controller.getDebugSnapshot();

      expect(debug.activeShotName).toBe('prePlayOrbit180');
      expect(debug.orbitCenter?.x).toBeCloseTo(debug.formationBounds?.center.x ?? 0);
      expect(debug.orbitCenter?.z).toBeCloseTo(debug.formationBounds?.center.z ?? 0);
      expect(debug.orbitRadius).toBeGreaterThan(0);
    }
  });

  it('updates orbit framing when resized', () => {
    const gameplay = createGameplayModel();
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'full',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });

    controller.update(snapshot, 0);
    const wideRadius = controller.getDebugSnapshot().orbitRadius;
    controller.resize(390, 844);
    controller.update(snapshot, 0.016);
    const narrowRadius = controller.getDebugSnapshot().orbitRadius;

    expect(narrowRadius).toBeGreaterThan(wideRadius ?? 0);
  });

  it('resizes every camera mode without invalid projection data', () => {
    const gameplay = createGameplayModel();
    const snapshot = snapshotGameplayModel(gameplay);

    for (const mode of ['tacticalOrthographic', 'offensePerspective', 'cinematicBroadcast'] as const) {
      const controller = new GameplayCameraController({
        height: 720,
        initialMode: mode,
        width: 1280,
      });

      controller.resize(390, 844);
      controller.update(snapshot, 0);

      const camera = controller.camera;
      if (camera instanceof THREE.PerspectiveCamera) {
        expect(camera.aspect).toBeCloseTo(390 / 844);
        expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
      } else if (camera instanceof THREE.OrthographicCamera) {
        expect(camera.left).toBeLessThan(camera.right);
        expect(camera.bottom).toBeLessThan(camera.top);
        expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

function getUnframedPlayerIds(camera: THREE.Camera, players: PlayerSnapshot[]): string[] {
  camera.updateMatrixWorld(true);
  if (camera instanceof THREE.OrthographicCamera || camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }

  return players
    .filter((player) => {
      const point = new THREE.Vector3(player.position.x, 1.1, player.position.z).project(camera);

      return (
        Math.abs(point.x) > 1 ||
        Math.abs(point.y) > 1 ||
        point.z < -1 ||
        point.z > 1
      );
    })
    .map((player) => player.id);
}
