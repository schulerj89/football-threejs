import * as THREE from 'three';
import type { CoinFace } from '../../match/CoinTossModel';

export interface CoinVisualResources {
  dispose: () => void;
  group: THREE.Group;
  mesh: THREE.Mesh;
}

export interface CoinAnimationPose {
  finalRotationX: number;
  positionY: number;
  progress: number;
  rotationX: number;
  rotationZ: number;
}

const COIN_VISUAL_CONFIG = {
  animationDurationSeconds: 2.8,
  edgeColor: 0xb08b45,
  fallHeight: 2.5,
  radius: 0.62,
  restingHeight: 1.55,
  segments: 48,
  spinTurns: 5,
  thickness: 0.11,
} as const;

let sharedGeometry: THREE.CylinderGeometry | null = null;
let sharedEdgeMaterial: THREE.MeshStandardMaterial | null = null;
let sharedHeadsMaterial: THREE.MeshStandardMaterial | null = null;
let sharedTailsMaterial: THREE.MeshStandardMaterial | null = null;
let sharedTextureLoader: THREE.TextureLoader | null = null;

export function createCoinVisualResources(): CoinVisualResources {
  const group = new THREE.Group();
  group.name = 'coin-toss-coin-root';
  group.userData.coinTossPresentation = true;

  const mesh = new THREE.Mesh(getCoinGeometry(), [
    getEdgeMaterial(),
    getHeadsMaterial(),
    getTailsMaterial(),
  ]);
  mesh.name = 'coin-toss-coin';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.rotation.z = Math.PI / 12;
  group.add(mesh);

  return {
    dispose: () => {
      group.clear();
    },
    group,
    mesh,
  };
}

export function calculateCoinAnimationPose(
  face: CoinFace,
  elapsedSeconds: number,
): CoinAnimationPose {
  const progress = clamp(elapsedSeconds / COIN_VISUAL_CONFIG.animationDurationSeconds, 0, 1);
  const eased = easeInOutCubic(progress);
  const finalRotationX = resolveCoinFinalRotationX(face);
  const rotationX = COIN_VISUAL_CONFIG.spinTurns * Math.PI * 2 * eased + finalRotationX * eased;
  const positionY = COIN_VISUAL_CONFIG.restingHeight +
    Math.sin(Math.PI * progress) * COIN_VISUAL_CONFIG.fallHeight;

  return {
    finalRotationX,
    positionY,
    progress,
    rotationX,
    rotationZ: Math.PI / 12 + Math.sin(progress * Math.PI * 2) * 0.18,
  };
}

export function resolveCoinFinalRotationX(face: CoinFace): number {
  return face === 'heads' ? 0 : Math.PI;
}

export function getCoinAnimationDurationSeconds(): number {
  return COIN_VISUAL_CONFIG.animationDurationSeconds;
}

export function disposeSharedCoinVisualResources(): void {
  sharedGeometry?.dispose();
  sharedGeometry = null;
  sharedEdgeMaterial?.dispose();
  sharedEdgeMaterial = null;
  disposeMaterialMap(sharedHeadsMaterial);
  sharedHeadsMaterial?.dispose();
  sharedHeadsMaterial = null;
  disposeMaterialMap(sharedTailsMaterial);
  sharedTailsMaterial?.dispose();
  sharedTailsMaterial = null;
}

function disposeMaterialMap(material: THREE.MeshStandardMaterial | null): void {
  material?.map?.dispose();
  if (material) {
    material.map = null;
  }
}

function getCoinGeometry(): THREE.CylinderGeometry {
  if (!sharedGeometry) {
    sharedGeometry = new THREE.CylinderGeometry(
      COIN_VISUAL_CONFIG.radius,
      COIN_VISUAL_CONFIG.radius,
      COIN_VISUAL_CONFIG.thickness,
      COIN_VISUAL_CONFIG.segments,
      1,
      false,
    );
    sharedGeometry.name = 'shared-coin-toss-cylinder';
  }

  return sharedGeometry;
}

function getEdgeMaterial(): THREE.MeshStandardMaterial {
  if (!sharedEdgeMaterial) {
    sharedEdgeMaterial = new THREE.MeshStandardMaterial({
      color: COIN_VISUAL_CONFIG.edgeColor,
      metalness: 0.75,
      roughness: 0.32,
    });
    sharedEdgeMaterial.name = 'shared-coin-edge-material';
  }

  return sharedEdgeMaterial;
}

function getHeadsMaterial(): THREE.MeshStandardMaterial {
  if (!sharedHeadsMaterial) {
    sharedHeadsMaterial = createCoinFaceMaterial(
      '/branding/coin/football-js-coin-heads.webp',
      0xd8c27d,
      'shared-coin-heads-material',
    );
  }

  return sharedHeadsMaterial;
}

function getTailsMaterial(): THREE.MeshStandardMaterial {
  if (!sharedTailsMaterial) {
    sharedTailsMaterial = createCoinFaceMaterial(
      '/branding/coin/football-js-coin-tails.webp',
      0xc9ae61,
      'shared-coin-tails-material',
    );
  }

  return sharedTailsMaterial;
}

function createCoinFaceMaterial(
  url: string,
  fallbackColor: number,
  name: string,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: fallbackColor,
    metalness: 0.72,
    roughness: 0.28,
  });
  material.name = name;

  getTextureLoader().load(
    url,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      material.map = texture;
      material.needsUpdate = true;
    },
    undefined,
    () => undefined,
  );

  return material;
}

function getTextureLoader(): THREE.TextureLoader {
  if (!sharedTextureLoader) {
    sharedTextureLoader = new THREE.TextureLoader();
  }
  return sharedTextureLoader;
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
