import * as THREE from 'three';
import { calculateSunWorldDirection } from './WeatherModel';
import type {
  WeatherProfile,
  WeatherSnapshot,
  WeatherVectorSnapshot,
} from './WeatherTypes';

export interface ClearWeatherRendererSnapshot {
  precipitationObjectCount: number;
  skyEnabled: boolean;
  skyObjectCount: number;
  sunDiscWorldPosition: WeatherVectorSnapshot;
  sunWorldDirection: WeatherVectorSnapshot;
  sunVisible: boolean;
}

export class ClearWeatherRenderer {
  readonly group = new THREE.Group();

  private readonly skyGeometry: THREE.SphereGeometry;
  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly skyMesh: THREE.Mesh;
  private readonly sunDiscGeometry: THREE.CircleGeometry | null = null;
  private readonly sunDiscMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly sunDisc: THREE.Mesh | null = null;
  private readonly sunGlowGeometry: THREE.CircleGeometry | null = null;
  private readonly sunGlowMaterial: THREE.MeshBasicMaterial | null = null;
  private readonly sunGlow: THREE.Mesh | null = null;
  private readonly rainGeometry: THREE.BufferGeometry | null = null;
  private readonly rainMaterial: THREE.LineBasicMaterial | null = null;
  private readonly rainLines: THREE.LineSegments | null = null;
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

    this.group.add(this.skyMesh);

    if (profile.sky.sunVisible) {
      this.sunGlowGeometry = new THREE.CircleGeometry(profile.sky.sunGlowRadius, 32);
      this.sunGlowMaterial = new THREE.MeshBasicMaterial({
        color: profile.sky.sunGlowColor,
        depthWrite: false,
        opacity: 0.34,
        side: THREE.DoubleSide,
        transparent: true,
        toneMapped: false,
      });
      this.sunGlow = new THREE.Mesh(this.sunGlowGeometry, this.sunGlowMaterial);
      this.sunGlow.name = 'clear-weather-sun-glow';
      this.sunGlow.frustumCulled = false;
      this.sunGlow.renderOrder = -990;
      this.sunGlow.userData.weather = true;

      this.sunDiscGeometry = new THREE.CircleGeometry(profile.sky.sunDiscRadius, 32);
      this.sunDiscMaterial = new THREE.MeshBasicMaterial({
        color: profile.sky.sunColor,
        depthWrite: false,
        opacity: 1,
        side: THREE.DoubleSide,
        transparent: true,
        toneMapped: false,
      });
      this.sunDisc = new THREE.Mesh(this.sunDiscGeometry, this.sunDiscMaterial);
      this.sunDisc.name = 'clear-weather-sun-disc';
      this.sunDisc.frustumCulled = false;
      this.sunDisc.renderOrder = -980;
      this.sunDisc.userData.weather = true;
      this.group.add(this.sunGlow, this.sunDisc);
    }

    if ((profile.sky.rainStreakCount ?? 0) > 0) {
      this.rainGeometry = createRainStreakGeometry(profile.sky.rainStreakCount ?? 0);
      this.rainMaterial = new THREE.LineBasicMaterial({
        color: profile.sky.rainColor ?? 0xb7c6cf,
        depthWrite: false,
        opacity: profile.sky.rainOpacity ?? 0.42,
        transparent: true,
      });
      this.rainLines = new THREE.LineSegments(this.rainGeometry, this.rainMaterial);
      this.rainLines.name = 'rain-weather-streaks';
      this.rainLines.frustumCulled = false;
      this.rainLines.renderOrder = -960;
      this.rainLines.userData.weather = true;
      this.group.add(this.rainLines);
    }
  }

  update(camera: THREE.Camera, snapshot: WeatherSnapshot): void {
    this.group.position.copy(camera.position);
    this.sunDirection = toVector3(calculateSunWorldDirection(snapshot));
    const sunPosition = this.sunDirection
      .clone()
      .multiplyScalar(this.profile.sky.sunDistance);
    this.sunWorldPosition.copy(camera.position).add(sunPosition);
    if (this.sunGlow && this.sunDisc) {
      this.sunGlow.position.copy(sunPosition);
      this.sunDisc.position.copy(sunPosition);
      this.sunDisc.getWorldPosition(this.sunWorldPosition);
      this.sunGlow.quaternion.copy(camera.quaternion);
      this.sunDisc.quaternion.copy(camera.quaternion);
    }
  }

  getSnapshot(): ClearWeatherRendererSnapshot {
    return {
      precipitationObjectCount: this.rainLines ? 1 : 0,
      skyEnabled: this.group.visible,
      skyObjectCount: this.group.children.length,
      sunDiscWorldPosition: toSnapshot(this.sunWorldPosition),
      sunWorldDirection: toSnapshot(this.sunDirection),
      sunVisible: this.sunDisc?.visible ?? false,
    };
  }

  dispose(): void {
    this.skyGeometry.dispose();
    this.skyMaterial.dispose();
    this.sunDiscGeometry?.dispose();
    this.sunDiscMaterial?.dispose();
    this.sunGlowGeometry?.dispose();
    this.sunGlowMaterial?.dispose();
    this.rainGeometry?.dispose();
    this.rainMaterial?.dispose();
  }
}

function createRainStreakGeometry(count: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const spreadX = 260;
  const spreadZ = 190;
  const minY = -16;
  const maxY = 96;

  for (let index = 0; index < count; index += 1) {
    const a = pseudoRandom(index, 17);
    const b = pseudoRandom(index, 43);
    const c = pseudoRandom(index, 89);
    const x = (a - 0.5) * spreadX;
    const y = minY + b * (maxY - minY);
    const z = (c - 0.5) * spreadZ;
    const slant = 1.6 + pseudoRandom(index, 131) * 1.8;
    const length = 10 + pseudoRandom(index, 197) * 10;
    positions.push(x, y, z, x - slant, y - length, z + slant * 0.35);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function pseudoRandom(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
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
