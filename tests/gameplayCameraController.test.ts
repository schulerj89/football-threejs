import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  GameplayCameraController,
  resolveGameplayCameraMode,
} from '../src/camera/GameplayCameraController';
import {
  attemptPass,
  createGameplayModel,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
} from '../src/playState';

describe('gameplay camera controller', () => {
  it('resolves camera URL aliases', () => {
    expect(resolveGameplayCameraMode(null)).toBe('tacticalOrthographic');
    expect(resolveGameplayCameraMode('tactical')).toBe('tacticalOrthographic');
    expect(resolveGameplayCameraMode('offense')).toBe('offensePerspective');
    expect(resolveGameplayCameraMode('offensePerspective')).toBe('offensePerspective');
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
});
