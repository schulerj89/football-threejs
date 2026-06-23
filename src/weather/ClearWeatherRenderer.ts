import * as THREE from 'three';
import { calculateSunWorldDirection } from './WeatherModel';
import type {
  WeatherProfile,
  WeatherSnapshot,
  WeatherVectorSnapshot,
} from './WeatherTypes';

export interface ClearWeatherRendererSnapshot {
  skyEnabled: boolean;
  skyObjectCount: number;
  sunDiscWorldPosition: WeatherVectorSnapshot;
  sunWorldDirection: WeatherVectorSnapshot;
}

export class ClearWeatherRenderer {
  readonly group = new THREE.Group();

  private readonly skyGeometry: THREE.SphereGeometry;
  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly skyMesh: THREE.Mesh;
  private readonly sunDiscGeometry: THREE.CircleGeometry;
  private readonly sunDiscMaterial: THREE.MeshBasicMaterial;
  private readonly sunDisc: THREE.Mesh;
  private readonly sunGlowGeometry: THREE.CircleGeometry;
  private readonly sunGlowMaterial: THREE.MeshBasicMaterial;
  private readonly sunGlow: THREE.Mesh;
  private sunDirection = new THREE.Vector3();
  private readonly sunWorldPosition = new THREE.Vector3();

  constructor(private readonly profile: WeatherProfile) {
    this.group.name = 'clear-weather';
    this.group.userData.weather = true;

    this.skyGeometry = new THREE.SphereGeometry(profile.sky.radius, 32, 16);
    this.skyMaterial = new THREE.ShaderMaterial({
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        horizonColor: { value: new THREE.Color(profile.sky.horizonColor) },
        overheadColor: { value: new THREE.Color(profile.sky.overheadColor) },
      },
      vertexShader: `
        varying vec3 vWorldDirection;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldDirection;
        uniform vec3 horizonColor;
        uniform vec3 overheadColor;
        void main() {
          float t = smoothstep(-0.05, 0.86, clamp(vWorldDirection.y, 0.0, 1.0));
          vec3 color = mix(horizonColor, overheadColor, t);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(this.skyGeometry, this.skyMaterial);
    this.skyMesh.name = 'clear-weather-sky-dome';
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = -1000;
    this.skyMesh.userData.weather = true;

    this.sunGlowGeometry = new THREE.CircleGeometry(profile.sky.sunGlowRadius, 32);
    this.sunGlowMaterial = new THREE.MeshBasicMaterial({
      color: profile.sky.sunGlowColor,
      depthWrite: false,
      opacity: 0.22,
      transparent: true,
      toneMapped: false,
    });
    this.sunGlow = new THREE.Mesh(this.sunGlowGeometry, this.sunGlowMaterial);
    this.sunGlow.name = 'clear-weather-sun-glow';
    this.sunGlow.frustumCulled = false;
    this.sunGlow.userData.weather = true;

    this.sunDiscGeometry = new THREE.CircleGeometry(profile.sky.sunDiscRadius, 32);
    this.sunDiscMaterial = new THREE.MeshBasicMaterial({
      color: profile.sky.sunColor,
      depthWrite: false,
      opacity: 0.92,
      transparent: true,
      toneMapped: false,
    });
    this.sunDisc = new THREE.Mesh(this.sunDiscGeometry, this.sunDiscMaterial);
    this.sunDisc.name = 'clear-weather-sun-disc';
    this.sunDisc.frustumCulled = false;
    this.sunDisc.userData.weather = true;

    this.group.add(this.skyMesh, this.sunGlow, this.sunDisc);
  }

  update(camera: THREE.Camera, snapshot: WeatherSnapshot): void {
    this.group.position.copy(camera.position);
    this.sunDirection = toVector3(calculateSunWorldDirection(snapshot));
    const sunPosition = this.sunDirection
      .clone()
      .multiplyScalar(this.profile.sky.sunDistance);
    this.sunGlow.position.copy(sunPosition);
    this.sunDisc.position.copy(sunPosition);
    this.sunDisc.getWorldPosition(this.sunWorldPosition);
    this.sunGlow.quaternion.copy(camera.quaternion);
    this.sunDisc.quaternion.copy(camera.quaternion);
  }

  getSnapshot(): ClearWeatherRendererSnapshot {
    return {
      skyEnabled: this.group.visible,
      skyObjectCount: this.group.children.length,
      sunDiscWorldPosition: toSnapshot(this.sunWorldPosition),
      sunWorldDirection: toSnapshot(this.sunDirection),
    };
  }

  dispose(): void {
    this.skyGeometry.dispose();
    this.skyMaterial.dispose();
    this.sunDiscGeometry.dispose();
    this.sunDiscMaterial.dispose();
    this.sunGlowGeometry.dispose();
    this.sunGlowMaterial.dispose();
  }
}

function toVector3(vector: WeatherVectorSnapshot): THREE.Vector3 {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

function toSnapshot(vector: THREE.Vector3): WeatherVectorSnapshot {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}
