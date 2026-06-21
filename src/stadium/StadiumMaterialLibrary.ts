import * as THREE from 'three';
import type { StadiumTextureRole } from './StadiumTypes';

export interface StadiumMaterialLibraryOptions {
  anisotropy?: number;
  imageMaterialsEnabled: boolean;
}

export interface StadiumMaterialLibrary {
  concrete: THREE.Material;
  concourseWall: THREE.Material;
  exteriorWall: THREE.Material;
  fascia: THREE.Material;
  scoreboardScreen: THREE.Material;
  seating: THREE.Material;
  tunnel: THREE.Material;
  allMaterials: readonly THREE.Material[];
  dispose(): void;
}

const TEXTURE_PATHS: Record<StadiumTextureRole, string> = {
  concourseWall: '/textures/stadium/concourse-wall.svg',
  entryTunnel: '/textures/stadium/entry-tunnel.svg',
  fasciaBand: '/textures/stadium/fascia-band.svg',
  scoreboardScreen: '/textures/stadium/scoreboard-screen.svg',
};

const textureCache = new Map<StadiumTextureRole, THREE.Texture>();

export function createStadiumMaterialLibrary({
  anisotropy = 1,
  imageMaterialsEnabled,
}: StadiumMaterialLibraryOptions): StadiumMaterialLibrary {
  const concrete = new THREE.MeshLambertMaterial({ color: 0x596069 });
  const seating = new THREE.MeshLambertMaterial({ color: 0x2a3338 });
  const exteriorWall = new THREE.MeshLambertMaterial({ color: 0x3b4247 });
  const concourseWall = createTexturedMaterial({
    anisotropy,
    color: 0x48525a,
    enabled: imageMaterialsEnabled,
    repeat: { x: 12, y: 2 },
    role: 'concourseWall',
  });
  const fascia = createTexturedMaterial({
    anisotropy,
    color: 0x203a46,
    enabled: imageMaterialsEnabled,
    repeat: { x: 10, y: 1 },
    role: 'fasciaBand',
  });
  const scoreboardScreen = createTexturedMaterial({
    anisotropy,
    color: 0x0f2534,
    enabled: imageMaterialsEnabled,
    repeat: { x: 1, y: 1 },
    role: 'scoreboardScreen',
  });
  const tunnel = createTexturedMaterial({
    anisotropy,
    color: 0x2c3034,
    enabled: imageMaterialsEnabled,
    repeat: { x: 1, y: 1 },
    role: 'entryTunnel',
  });
  const allMaterials = [
    concrete,
    seating,
    exteriorWall,
    concourseWall,
    fascia,
    scoreboardScreen,
    tunnel,
  ];

  return {
    allMaterials,
    concrete,
    concourseWall,
    dispose: () => {
      for (const material of allMaterials) {
        material.dispose();
      }
    },
    exteriorWall,
    fascia,
    scoreboardScreen,
    seating,
    tunnel,
  };
}

export function getStadiumTextureCacheSnapshot(): {
  loadedRoles: StadiumTextureRole[];
  textureCount: number;
} {
  return {
    loadedRoles: [...textureCache.keys()],
    textureCount: textureCache.size,
  };
}

function createTexturedMaterial({
  anisotropy,
  color,
  enabled,
  repeat,
  role,
}: {
  anisotropy: number;
  color: number;
  enabled: boolean;
  repeat: { x: number; y: number };
  role: StadiumTextureRole;
}): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ color });
  material.name = `stadium-${role}`;

  if (!enabled) {
    return material;
  }

  const texture = loadStadiumTexture(role, anisotropy, repeat, () => {
    material.map = null;
    material.color.setHex(color);
    material.needsUpdate = true;
  });
  material.map = texture;
  material.color.setHex(0xffffff);
  return material;
}

function loadStadiumTexture(
  role: StadiumTextureRole,
  anisotropy: number,
  repeat: { x: number; y: number },
  onError?: () => void,
): THREE.Texture {
  const cached = textureCache.get(role);
  if (cached) {
    return cached;
  }

  const texture = new THREE.TextureLoader().load(
    TEXTURE_PATHS[role],
    undefined,
    undefined,
    () => {
      onError?.();
    },
  );
  texture.name = `stadium-${role}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat.x, repeat.y);
  texture.anisotropy = Math.max(1, Math.min(4, Math.floor(anisotropy)));
  textureCache.set(role, texture);
  return texture;
}
