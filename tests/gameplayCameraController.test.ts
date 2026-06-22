import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  GAMEPLAY_CAMERA_CONFIG,
  GameplayCameraController,
  resolveCinematicsSetting,
  resolveGameplayCameraMode,
  resolvePresentationShotPreview,
} from '../src/camera/GameplayCameraController';
import { resolveCameraShotPolicy } from '../src/camera/CameraShotPolicy';
import { PRESENTATION_CAMERA_CONFIG } from '../src/camera/PresentationCameraDirector';
import {
  attemptPass,
  createGameplayModel,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
  type GameplaySnapshot,
  type PlayResultType,
} from '../src/playState';
import {
  createFormationPreviewModel,
  snapshotFormationPreviewAsGameplay,
} from '../src/formationPreview';
import type { PlayerSnapshot } from '../src/playerModel';
import { SNAP_LANE_X, type SnapLane } from '../src/ballSpotting';

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

  it('resolves camera shot eligibility by camera mode', () => {
    expect(resolveCameraShotPolicy('tacticalOrthographic', 'full')).toMatchObject({
      allowCrowdCutaway: false,
      allowPerspectiveOverride: false,
      allowPostPlayOrbit: false,
      allowPrePlayOrbit: false,
    });
    expect(resolveCameraShotPolicy('offensePerspective', 'brief')).toMatchObject({
      allowCrowdCutaway: false,
      allowPerspectiveOverride: true,
      allowPostPlayOrbit: true,
      allowPrePlayOrbit: false,
    });
    expect(resolveCameraShotPolicy('offensePerspective', 'full')).toMatchObject({
      allowCrowdCutaway: false,
      allowPrePlayOrbit: false,
    });
    expect(resolveCameraShotPolicy('cinematicBroadcast', 'off')).toMatchObject({
      allowCrowdCutaway: false,
      allowPostPlayOrbit: false,
      allowPrePlayOrbit: false,
    });
    expect(resolveCameraShotPolicy('cinematicBroadcast', 'full')).toMatchObject({
      allowCrowdCutaway: false,
      allowPostPlayOrbit: true,
      allowPrePlayOrbit: true,
    });
  });

  it('uses the tactical orthographic camera by default', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const controller = new GameplayCameraController({ height: 900, width: 1440 });

    controller.update(snapshotGameplayModel(gameplay), 0);

    expect(controller.camera).toBeInstanceOf(THREE.OrthographicCamera);
    expect(controller.getDebugSnapshot()).toMatchObject({
      mode: 'tacticalOrthographic',
      state: 'tacticalOverview',
    });
  });

  it('frames the line of scrimmage in offense perspective before the snap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({ height: 900, width: 1440 });

    expect(controller.getMode()).toBe('tacticalOrthographic');
    expect(controller.toggleMode(snapshot)).toBe('offensePerspective');
    expect(controller.toggleMode(snapshot)).toBe('cinematicBroadcast');
    expect(controller.toggleMode(snapshot)).toBe('tacticalOrthographic');
  });

  it('uses a transient orbit camera without changing the selected gameplay mode', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'brief',
      height: 900,
      initialMode: 'tacticalOrthographic',
      shotPreview: 'prePlayOrbit180',
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

  it('keeps tactical mode orthographic under every cinematics setting', () => {
    const touchdownSnapshot = createDeadSnapshot('touchdown', { x: 2, z: 50 });

    for (const cinematics of ['off', 'brief', 'full'] as const) {
      const controller = new GameplayCameraController({
        cinematics,
        height: 900,
        initialMode: 'tacticalOrthographic',
        width: 1440,
      });

      controller.update(touchdownSnapshot, 0);

      expect(controller.camera).toBeInstanceOf(THREE.OrthographicCamera);
      expect(controller.getDebugSnapshot()).toMatchObject({
        mode: 'tacticalOrthographic',
        state: 'tacticalOverview',
      });
      expect(controller.getDebugSnapshot().activeShotName ?? null).toBeNull();
    }
  });

  it('does not start the pre-play orbit during normal pre-snap play selection', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });
    const controller = new GameplayCameraController({
      cinematics: 'brief',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });

    controller.update(snapshotGameplayModel(gameplay), 0);
    expect(controller.getDebugSnapshot().activeShotName ?? null).toBeNull();

    expect(selectPlay(gameplay, 'quick-pass-7')).toBe(true);
    controller.update(snapshotGameplayModel(gameplay), 0.016);

    expect(controller.getDebugSnapshot().activeShotName ?? null).toBeNull();
  });

  it('permits the pre-play orbit only for cinematic full mode', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });
    const snapshot = snapshotGameplayModel(gameplay);
    const tactical = new GameplayCameraController({
      cinematics: 'full',
      height: 900,
      initialMode: 'tacticalOrthographic',
      width: 1440,
    });
    const offense = new GameplayCameraController({
      cinematics: 'full',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });
    const cinematicBrief = new GameplayCameraController({
      cinematics: 'brief',
      height: 900,
      initialMode: 'cinematicBroadcast',
      width: 1440,
    });
    const cinematicFull = new GameplayCameraController({
      cinematics: 'full',
      height: 900,
      initialMode: 'cinematicBroadcast',
      width: 1440,
    });

    tactical.update(snapshot, 0);
    offense.update(snapshot, 0);
    cinematicBrief.update(snapshot, 0);
    cinematicFull.update(snapshot, 0);

    expect(tactical.getDebugSnapshot().activeShotName ?? null).toBeNull();
    expect(offense.getDebugSnapshot().activeShotName ?? null).toBeNull();
    expect(cinematicBrief.getDebugSnapshot().activeShotName ?? null).toBeNull();
    expect(cinematicFull.getDebugSnapshot().activeShotName).toBe('prePlayOrbit180');
  });

  it('cancels a presentation override when switching into tactical mode', () => {
    const snapshot = createDeadSnapshot('touchdown', { x: -1, z: 50 });
    const controller = new GameplayCameraController({
      cinematics: 'full',
      height: 900,
      initialMode: 'offensePerspective',
      width: 1440,
    });

    controller.update(snapshot, 0);
    expect(controller.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(controller.getDebugSnapshot().activeShotName).toBe('touchdownOrbit360');

    controller.setMode('tacticalOrthographic', snapshot);

    expect(controller.camera).toBeInstanceOf(THREE.OrthographicCamera);
    expect(controller.getDebugSnapshot()).toMatchObject({
      mode: 'tacticalOrthographic',
      state: 'tacticalOverview',
    });
    expect(controller.getDebugSnapshot().activeShotName ?? null).toBeNull();
  });

  it('can skip a transient orbit shot and restore the selected camera', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'brief',
      height: 900,
      initialMode: 'offensePerspective',
      shotPreview: 'prePlayOrbit180',
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

  it('clears cinematic-mode shot debug state immediately when a shot is skipped', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'brief',
      height: 900,
      initialMode: 'cinematicBroadcast',
      shotPreview: 'prePlayOrbit180',
      width: 1440,
    });

    controller.update(snapshot, 0);
    expect(controller.getDebugSnapshot().activeShotName).toBe('prePlayOrbit180');
    expect(controller.skipPresentationShot()).toBe(true);

    expect(controller.getDebugSnapshot()).toMatchObject({
      activeShotName: null,
      mode: 'cinematicBroadcast',
      state: 'cinematicBroadcast',
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
        shotPreview: 'prePlayOrbit180',
        width: 1440,
      });

      controller.update(snapshot, 0);
      const debug = controller.getDebugSnapshot();

      expect(debug.activeShotName).toBe('prePlayOrbit180');
      expect(debug.orbitCenter?.x).toBeCloseTo(snapshot.nextSnapSpot.x);
      expect(debug.orbitCenter?.z).toBeCloseTo(snapshot.nextSnapSpot.z);
      expect(debug.orbitRadius).toBeGreaterThan(0);
    }
  });

  it('calculates eleven-on-eleven pre-play orbit paths for every snap lane', () => {
    for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
      const preview = createFormationPreviewModel('11v11', lane);
      const snapshot = snapshotFormationPreviewAsGameplay(preview);
      const controller = new GameplayCameraController({
        cinematics: 'full',
        height: 900,
        initialMode: 'offensePerspective',
        shotPreview: 'prePlayOrbit180',
        width: 1440,
      });

      controller.update(snapshot, 0);
      const debug = controller.getDebugSnapshot();

      expect(debug.activeShotName).toBe('prePlayOrbit180');
      expect(debug.formationBounds?.playerIds).toHaveLength(22);
      expect(debug.orbitCenter?.x).toBeCloseTo(snapshot.nextSnapSpot.x);
      expect(debug.orbitCenter?.z).toBeCloseTo(snapshot.nextSnapSpot.z);
      expect(debug.orbitRadius).toBeGreaterThan(0);
    }
  });

  it('keeps the completed pre-play camera stable while switching plays before the snap', () => {
    const playIds = ['inside-zone-7', 'outside-zone-7', 'quick-pass-7', 'twin-slants-flat'];
    const frameSeconds = 0.016;

    for (const mode of ['tacticalOrthographic', 'offensePerspective', 'cinematicBroadcast'] as const) {
      for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
        const gameplay = createGameplayModel({ playbookId: '7v7' });
        moveGameplayToSnapLane(gameplay, lane);
        selectPlay(gameplay, playIds[0]);
        const controller = new GameplayCameraController({
          cinematics: 'brief',
          height: 900,
          initialMode: mode,
          width: 1440,
        });
        let snapshot = snapshotGameplayModel(gameplay);

        controller.update(snapshot, 0);
        for (let frame = 0; frame < 90; frame += 1) {
          controller.update(snapshot, frameSeconds);
        }

        const completedDebug = controller.getDebugSnapshot();
        const preSnapSequenceId = completedDebug.stability.preSnapSequenceId;
        expect(completedDebug.activeShotName ?? null).toBeNull();

        for (const playId of playIds.slice(1)) {
          expect(selectPlay(gameplay, playId)).toBe(true);
          snapshot = snapshotGameplayModel(gameplay);
          const before = controller.camera.position.clone();
          controller.update(snapshot, frameSeconds);
          const debug = controller.getDebugSnapshot();
          const maxTranslation = mode === 'cinematicBroadcast'
            ? PRESENTATION_CAMERA_CONFIG.maximumTransitionSpeed
            : GAMEPLAY_CAMERA_CONFIG.offensePerspective.maximumCameraTranslationPerSecond;
          const maxAngular = mode === 'cinematicBroadcast'
            ? PRESENTATION_CAMERA_CONFIG.maximumAngularChangePerSecond
            : GAMEPLAY_CAMERA_CONFIG.offensePerspective.maximumAngularChangePerSecond;

          expect(debug.activeShotName ?? null).toBeNull();
          expect(debug.stability.preSnapSequenceId).toBe(preSnapSequenceId);
          expect(debug.stability.reasonCameraTargetChanged).toBe('selectedPlayChangedPreservedAnchor');
          expect(debug.stability.selectedPlayId).toBe(playId);
          expect(debug.stability.perFrameDisplacement).toBeLessThanOrEqual(
            maxTranslation * frameSeconds + 0.001,
          );
          expect(debug.stability.perFrameAngularChange).toBeLessThanOrEqual(
            maxAngular * frameSeconds + 0.001,
          );
          expect(controller.camera.position.distanceTo(before)).toBeLessThanOrEqual(
            maxTranslation * frameSeconds + 0.001,
          );
        }

        expect(snapshot.selectedPlay.id).toBe(playIds.at(-1));
      }
    }
  });

  it('starts gameplay immediately after a pre-snap play change without waiting for camera settling', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });
    const controller = new GameplayCameraController({
      cinematics: 'brief',
      height: 900,
      initialMode: 'cinematicBroadcast',
      width: 1440,
    });

    controller.update(snapshotGameplayModel(gameplay), 0);
    expect(selectPlay(gameplay, 'twin-slants-flat')).toBe(true);
    controller.update(snapshotGameplayModel(gameplay), 0.016);

    expect(startPlay(gameplay)).toBe(true);
    expect(gameplay.playState).toBe('live');
  });

  it('updates orbit framing when resized', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new GameplayCameraController({
      cinematics: 'full',
      height: 900,
      initialMode: 'offensePerspective',
      shotPreview: 'prePlayOrbit180',
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
    const gameplay = createGameplayModel({ playbookId: '5v5' });
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

function moveGameplayToSnapLane(
  gameplay: ReturnType<typeof createGameplayModel>,
  lane: SnapLane,
): void {
  const x = SNAP_LANE_X[lane];
  gameplay.currentBallSpot = { x, z: gameplay.currentBallSpot.z };
  gameplay.nextSnapSpot = { x, z: gameplay.nextSnapSpot.z };
  gameplay.drive.lineOfScrimmage = { x, z: gameplay.drive.lineOfScrimmage.z };
  gameplay.drive.snapLane = lane;
}

function createDeadSnapshot(
  resultType: PlayResultType,
  endingBallSpot: { x: number; z: number },
): GameplaySnapshot {
  const gameplay = createGameplayModel({ playbookId: '5v5' });
  const snapshot = snapshotGameplayModel(gameplay);

  return {
    ...snapshot,
    exactDeadBallSpot: endingBallSpot,
    lastPlayResult: {
      endingBallSpot,
      id: 71,
      reason: resultType,
      scoringTeam: resultType === 'touchdown' ? 'offense' : null,
      startingBallSpot: snapshot.currentBallSpot,
      type: resultType,
      yardsGained: endingBallSpot.z - snapshot.currentBallSpot.z,
    },
    playState: 'dead',
  };
}
