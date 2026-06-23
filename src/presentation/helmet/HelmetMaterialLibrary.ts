import * as THREE from 'three';

export type HelmetRuntimeMaterialComponent = 'faceguard' | 'shell';
export type HelmetMaterialFinishProfile = 'standard';

export interface HelmetMaterialRequest {
  color: number | string;
  component: HelmetRuntimeMaterialComponent;
  finish?: HelmetMaterialFinishProfile;
}

export interface HelmetMaterialCacheEntry {
  cacheKey: string;
  colorHex: string;
  component: HelmetRuntimeMaterialComponent;
  finish: HelmetMaterialFinishProfile;
  materialName: string;
  materialType: string;
}

export const HELMET_MATERIAL_PROFILES: Record<
  HelmetRuntimeMaterialComponent,
  {
    metalness: number;
    roughness: number;
  }
> = {
  faceguard: {
    metalness: 0.3,
    roughness: 0.4,
  },
  shell: {
    metalness: 0.1,
    roughness: 0.46,
  },
};

const standardMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const unlitMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

export function getHelmetRuntimeMaterial(
  request: HelmetMaterialRequest,
): THREE.MeshStandardMaterial {
  const component = request.component;
  const finish = request.finish ?? 'standard';
  const colorHex = normalizeMaterialHex(request.color);
  const cacheKey = createHelmetMaterialCacheKey(component, colorHex, finish);
  const cached = standardMaterialCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const profile = HELMET_MATERIAL_PROFILES[component];
  const material = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: 0x000000,
    metalness: profile.metalness,
    opacity: 1,
    roughness: profile.roughness,
    side: THREE.FrontSide,
    transparent: false,
    vertexColors: false,
  });

  material.name = `football-helmet-${component}-${finish}-${colorHex.slice(1).toLowerCase()}`;
  material.map = null;
  material.emissiveMap = null;
  material.normalMap = null;
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.alphaMap = null;
  material.aoMap = null;
  material.lightMap = null;
  material.needsUpdate = true;
  standardMaterialCache.set(cacheKey, material);
  return material;
}

export function getHelmetUnlitExactMaterial(
  request: HelmetMaterialRequest,
): THREE.MeshBasicMaterial {
  const component = request.component;
  const finish = request.finish ?? 'standard';
  const colorHex = normalizeMaterialHex(request.color);
  const cacheKey = `unlit:${createHelmetMaterialCacheKey(component, colorHex, finish)}`;
  const cached = unlitMaterialCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const material = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.FrontSide,
    transparent: false,
    vertexColors: false,
    wireframe: false,
  });

  material.name = `football-helmet-${component}-unlit-${colorHex.slice(1).toLowerCase()}`;
  material.map = null;
  material.alphaMap = null;
  material.needsUpdate = true;
  unlitMaterialCache.set(cacheKey, material);
  return material;
}

export function createHelmetMaterialCacheKey(
  component: HelmetRuntimeMaterialComponent,
  color: number | string,
  finish: HelmetMaterialFinishProfile = 'standard',
): string {
  return `${component}:${normalizeMaterialHex(color).toLowerCase()}:${finish}`;
}

export function getHelmetMaterialCacheSnapshot(): HelmetMaterialCacheEntry[] {
  return [...standardMaterialCache.entries()].map(([cacheKey, material]) => {
    const [component, colorHex, finish] = cacheKey.split(':') as [
      HelmetRuntimeMaterialComponent,
      string,
      HelmetMaterialFinishProfile,
    ];

    return {
      cacheKey,
      colorHex,
      component,
      finish,
      materialName: material.name,
      materialType: material.type,
    };
  });
}

export function resetHelmetMaterialLibraryForTests(): void {
  standardMaterialCache.clear();
  unlitMaterialCache.clear();
}

export function normalizeMaterialHex(color: number | string): string {
  if (typeof color === 'number') {
    return `#${color.toString(16).padStart(6, '0').slice(-6)}`;
  }

  const normalized = color.trim();
  const candidate = normalized.startsWith('#') ? normalized : `#${normalized}`;

  if (/^#[0-9a-fA-F]{6}$/.test(candidate)) {
    return candidate.toLowerCase();
  }

  return '#ffffff';
}
