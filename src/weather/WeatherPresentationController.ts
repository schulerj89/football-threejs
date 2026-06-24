import * as THREE from 'three';
import { ClearWeatherRenderer } from './ClearWeatherRenderer';
import {
  createClearWeatherModel,
  calculateSunWorldDirection,
  type WeatherModel,
} from './WeatherModel';
import type {
  WeatherPresentationSnapshot,
  WeatherVectorSnapshot,
} from './WeatherTypes';

export interface WeatherPresentationControllerOptions {
  hemisphereLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  model?: WeatherModel;
}

export class WeatherPresentationController {
  readonly group: THREE.Group;

  private readonly model: WeatherModel;
  private readonly renderer: ClearWeatherRenderer;

  constructor(private readonly options: WeatherPresentationControllerOptions) {
    this.model = options.model ?? createClearWeatherModel();
    this.renderer = new ClearWeatherRenderer(this.model.getProfile());
    this.group = this.renderer.group;
    this.applyLighting();
  }

  update(camera: THREE.Camera): void {
    const snapshot = this.model.getSnapshot();
    this.renderer.update(camera, snapshot);
    this.applyLighting();
  }

  getSnapshot(): WeatherPresentationSnapshot {
    const snapshot = this.model.getSnapshot();
    const rendererSnapshot = this.renderer.getSnapshot();
    return {
      ...snapshot,
      lightingIntensity: this.options.keyLight.intensity,
      precipitationObjectCount: rendererSnapshot.precipitationObjectCount,
      skyEnabled: rendererSnapshot.skyEnabled,
      skyObjectCount: rendererSnapshot.skyObjectCount,
      sunDiscWorldPosition: rendererSnapshot.sunDiscWorldPosition,
      sunLightPosition: toSnapshot(this.options.keyLight.position),
      sunVisible: rendererSnapshot.sunVisible,
      sunWorldDirection: rendererSnapshot.sunWorldDirection,
    };
  }

  dispose(): void {
    this.renderer.dispose();
  }

  private applyLighting(): void {
    const profile = this.model.getProfile();
    const snapshot = this.model.getSnapshot();
    const sunDirection = calculateSunWorldDirection(snapshot);
    const sunPosition = new THREE.Vector3(
      sunDirection.x,
      sunDirection.y,
      sunDirection.z,
    ).multiplyScalar(100);

    this.options.keyLight.color.setHex(profile.lighting.keyLightColor);
    this.options.keyLight.intensity = profile.lighting.keyLightIntensity;
    this.options.keyLight.position.copy(sunPosition);
    this.options.keyLight.castShadow = false;

    this.options.hemisphereLight.color.setHex(profile.lighting.hemisphereSkyColor);
    this.options.hemisphereLight.groundColor.setHex(profile.lighting.hemisphereGroundColor);
    this.options.hemisphereLight.intensity = profile.lighting.hemisphereIntensity;
  }
}

export function createWeatherDebugOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'weather-debug-overlay';
  document.body.appendChild(overlay);
  return overlay;
}

export function syncWeatherDebugOverlay(
  overlay: HTMLElement,
  snapshot: WeatherPresentationSnapshot,
): void {
  overlay.textContent = [
    'WEATHER',
    `COND ${snapshot.condition}`,
    `SUN_AZ ${snapshot.sunAzimuthRadians.toFixed(2)}`,
    `SUN_EL ${snapshot.sunElevationRadians.toFixed(2)}`,
    `SUN_DIR ${formatVector(snapshot.sunWorldDirection)}`,
    `SUN_LIGHT ${formatVector(snapshot.sunLightPosition)}`,
    `SUN_VISIBLE ${snapshot.sunVisible ? 'yes' : 'no'}`,
    `RAIN ${snapshot.precipitation.toFixed(2)} objects ${snapshot.precipitationObjectCount}`,
    `WIND ${snapshot.windSpeedMph.toFixed(1)} mph @ ${snapshot.windDirectionRadians.toFixed(2)}`,
    `SKY ${snapshot.skyEnabled ? 'on' : 'off'}`,
    `LIGHT ${snapshot.lightingIntensity.toFixed(2)}`,
  ].join('\n');
}

function toSnapshot(vector: THREE.Vector3): WeatherVectorSnapshot {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function formatVector(vector: WeatherVectorSnapshot): string {
  return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
}
