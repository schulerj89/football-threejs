import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGameplayModel, snapshotGameplayModel } from '../../src/playState';
import { CLEAR_WEATHER_PROFILE, OVERCAST_WEATHER_PROFILE } from '../../src/weather/WeatherProfile';
import { WeatherModel, calculateSunWorldDirection } from '../../src/weather/WeatherModel';
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

  it('renders the clear-day sun as a visible presentation disc with a broad glow', () => {
    const { controller } = createControllerFixture();
    const sunDisc = controller.group.getObjectByName('clear-weather-sun-disc');
    const sunGlow = controller.group.getObjectByName('clear-weather-sun-glow');

    expect(sunDisc).toBeInstanceOf(THREE.Mesh);
    expect(sunGlow).toBeInstanceOf(THREE.Mesh);
    expect((sunDisc as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>).material.side).toBe(THREE.DoubleSide);
    expect((sunGlow as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>).material.side).toBe(THREE.DoubleSide);
    expect(sunDisc?.renderOrder).toBeGreaterThan(controller.group.getObjectByName('clear-weather-sky-dome')?.renderOrder ?? -1000);
    expect(sunGlow?.renderOrder).toBeGreaterThan(controller.group.getObjectByName('clear-weather-sky-dome')?.renderOrder ?? -1000);
    expect(CLEAR_WEATHER_PROFILE.sky.sunDiscRadius).toBeGreaterThanOrEqual(14);
    expect(CLEAR_WEATHER_PROFILE.sky.sunGlowRadius).toBeGreaterThan(
      CLEAR_WEATHER_PROFILE.sky.sunDiscRadius * 2,
    );

    controller.dispose();
  });

  it('can render a grey overcast sky profile with muted stadium lighting', () => {
    const keyLight = new THREE.DirectionalLight();
    const hemisphereLight = new THREE.HemisphereLight();
    const controller = new WeatherPresentationController({
      hemisphereLight,
      keyLight,
      model: new WeatherModel(OVERCAST_WEATHER_PROFILE),
    });
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);

    controller.update(camera);

    expect(controller.getSnapshot()).toMatchObject({
      cloudiness: 0.9,
      condition: 'overcast',
      lightingIntensity: OVERCAST_WEATHER_PROFILE.lighting.keyLightIntensity,
      skyObjectCount: 3,
    });
    expect(keyLight.color.getHex()).toBe(OVERCAST_WEATHER_PROFILE.lighting.keyLightColor);
    expect(hemisphereLight.color.getHex()).toBe(OVERCAST_WEATHER_PROFILE.lighting.hemisphereSkyColor);
    expect(saturation(OVERCAST_WEATHER_PROFILE.sky.overheadColor)).toBeLessThan(
      saturation(CLEAR_WEATHER_PROFILE.sky.overheadColor),
    );
    expect(luminance(OVERCAST_WEATHER_PROFILE.sky.horizonColor)).toBeLessThan(
      luminance(CLEAR_WEATHER_PROFILE.sky.horizonColor),
    );

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

function luminance(color: number): number {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function saturation(color: number): number {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);

  return max === 0 ? 0 : (max - min) / max;
}
