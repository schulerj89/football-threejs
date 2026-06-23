import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGameplayModel, snapshotGameplayModel } from '../../src/playState';
import { calculateSunWorldDirection } from '../../src/weather/WeatherModel';
import { WeatherPresentationController } from '../../src/weather/WeatherPresentationController';

describe('clear weather presentation', () => {
  it('keeps the sky centered on the active camera', () => {
    const { camera, controller } = createControllerFixture();
    camera.position.set(12, 24, -36);

    controller.update(camera);

    expect(controller.group.position.x).toBeCloseTo(camera.position.x);
    expect(controller.group.position.y).toBeCloseTo(camera.position.y);
    expect(controller.group.position.z).toBeCloseTo(camera.position.z);
    expect(controller.getSnapshot()).toMatchObject({
      condition: 'clear',
      skyEnabled: true,
      skyObjectCount: 3,
    });
    controller.dispose();
  });

  it('aligns the visible sun and key light with the same direction', () => {
    const { camera, controller, keyLight } = createControllerFixture();
    camera.position.set(-18, 40, 22);

    controller.update(camera);

    const snapshot = controller.getSnapshot();
    const expectedDirection = calculateSunWorldDirection(snapshot);
    const lightDirection = keyLight.position.clone().normalize();
    const sunVisualDirection = new THREE.Vector3(
      snapshot.sunDiscWorldPosition.x - camera.position.x,
      snapshot.sunDiscWorldPosition.y - camera.position.y,
      snapshot.sunDiscWorldPosition.z - camera.position.z,
    ).normalize();

    expect(lightDirection.dot(toVector3(expectedDirection))).toBeGreaterThan(0.999);
    expect(sunVisualDirection.dot(toVector3(expectedDirection))).toBeGreaterThan(0.999);
    expect(keyLight.castShadow).toBe(false);
    controller.dispose();
  });

  it('does not alter gameplay snapshots', () => {
    const gameplay = createGameplayModel();
    const before = snapshotGameplayModel(gameplay);
    const { camera, controller } = createControllerFixture();

    controller.update(camera);

    expect(snapshotGameplayModel(gameplay)).toEqual(before);
    controller.dispose();
  });

  it('does not accumulate owned scene objects through repeated matches', () => {
    const scene = new THREE.Scene();
    const keyLight = new THREE.DirectionalLight();
    const hemisphereLight = new THREE.HemisphereLight();
    const camera = new THREE.PerspectiveCamera();
    scene.add(keyLight, hemisphereLight);
    const baseObjectCount = scene.children.length;

    for (let index = 0; index < 8; index += 1) {
      const controller = new WeatherPresentationController({
        hemisphereLight,
        keyLight,
      });
      scene.add(controller.group);
      controller.update(camera);
      expect(scene.children).toContain(controller.group);
      scene.remove(controller.group);
      controller.dispose();
    }

    expect(scene.children).toHaveLength(baseObjectCount);
  });
});

function createControllerFixture(): {
  camera: THREE.PerspectiveCamera;
  controller: WeatherPresentationController;
  hemisphereLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
} {
  const keyLight = new THREE.DirectionalLight();
  const hemisphereLight = new THREE.HemisphereLight();
  const controller = new WeatherPresentationController({
    hemisphereLight,
    keyLight,
  });
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  return {
    camera,
    controller,
    hemisphereLight,
    keyLight,
  };
}

function toVector3(vector: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}
