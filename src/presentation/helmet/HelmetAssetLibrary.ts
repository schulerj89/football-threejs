import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PlayerTeam } from '../../playerModel';
import { getUniformColorNumber } from '../../teams/TeamThemeApplier';
import type { UniformPalette } from '../../teams/UniformPalette';
import {
  createHelmetMaterialCacheKey,
  getHelmetRuntimeMaterial,
  normalizeMaterialHex,
} from './HelmetMaterialLibrary';

export type HelmetAssetStatus = 'idle' | 'loading' | 'loaded' | 'error';
export type HelmetPart = 'accent' | 'faceguard' | 'shell';

export interface HelmetAssetLoadSnapshot {
  assetId: string;
  errorMessage: string | null;
  faceguardMeshNames: string[];
  shellMeshNames: string[];
  status: HelmetAssetStatus;
}

export interface HelmetPartMeshes {
  accentMeshes?: THREE.Mesh[];
  faceguardMeshes: THREE.Mesh[];
  shellMeshes: THREE.Mesh[];
}

export const HELMET_ASSET_ID = 'football-helmet-kit';

export const HELMET_ASSET_CONFIG = {
  accentMeshNames: ['stripe', 'helmetstripe', 'accent', 'trim'],
  assetUrl: '/models/helmet/football-helmet-kit.glb',
  canonicalRotation: {
    x: Math.PI / 2,
    y: 0,
    z: 0,
  },
  faceguardMeshNames: [
    'faceguard_standard',
    'faceguard',
    'face-guard',
    'face_guard',
    'facemask',
    'face-mask',
    'guard',
  ],
  faceguardOffset: {
    position: { x: 0, y: -0.04, z: 0.48 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
  shellMeshNames: ['helmet_shell', 'helmet-shell', 'shell', 'helmet'],
  teamColors: {
    defense: {
      faceguard: 0xf2f4f6,
      shell: 0xb83737,
    },
    offense: {
      faceguard: 0xf2f4f6,
      shell: 0x2f66d8,
    },
  },
} as const;

const helmetAssetState: HelmetAssetLoadSnapshot = {
  assetId: HELMET_ASSET_ID,
  errorMessage: null,
  faceguardMeshNames: [],
  shellMeshNames: [],
  status: 'idle',
};

const loader = new GLTFLoader();
let helmetTemplatePromise: Promise<THREE.Group> | null = null;

export async function loadHelmetTemplate(): Promise<THREE.Group> {
  if (!helmetTemplatePromise) {
    helmetAssetState.status = 'loading';
    helmetAssetState.errorMessage = null;
    helmetTemplatePromise = new Promise((resolve, reject) => {
      loader.load(
        HELMET_ASSET_CONFIG.assetUrl,
        (gltf) => {
          const template = gltf.scene;
          template.name = 'low-poly-helmet-template';
          const parts = findHelmetPartMeshes(template);
          helmetAssetState.shellMeshNames = parts.shellMeshes.map((mesh) => mesh.name);
          helmetAssetState.faceguardMeshNames = parts.faceguardMeshes.map((mesh) => mesh.name);
          helmetAssetState.status = 'loaded';
          resolve(template);
        },
        undefined,
        (error) => {
          helmetAssetState.status = 'error';
          helmetAssetState.errorMessage = error instanceof Error ? error.message : String(error);
          reject(error);
        },
      );
    });
  }

  return helmetTemplatePromise;
}

export async function cloneHelmetAsset(name = 'low-poly-helmet'): Promise<THREE.Group> {
  const template = await loadHelmetTemplate();
  const helmet = new THREE.Group();
  const clone = template.clone(true);
  helmet.name = name;
  helmet.userData.assetId = HELMET_ASSET_ID;
  clone.name = `${name}-source`;
  clone.rotation.set(
    HELMET_ASSET_CONFIG.canonicalRotation.x,
    HELMET_ASSET_CONFIG.canonicalRotation.y,
    HELMET_ASSET_CONFIG.canonicalRotation.z,
  );
  helmet.add(clone);
  return helmet;
}

export function getHelmetAssetLoadSnapshot(): HelmetAssetLoadSnapshot {
  return {
    assetId: helmetAssetState.assetId,
    errorMessage: helmetAssetState.errorMessage,
    faceguardMeshNames: [...helmetAssetState.faceguardMeshNames],
    shellMeshNames: [...helmetAssetState.shellMeshNames],
    status: helmetAssetState.status,
  };
}

export function findHelmetPartMeshes(root: THREE.Object3D): HelmetPartMeshes {
  const meshes = findMeshes(root);
  const faceguardMeshes = meshes.filter((mesh) =>
    matchesMeshOrMaterialName(mesh, HELMET_ASSET_CONFIG.faceguardMeshNames),
  );
  const accentMeshes = meshes.filter((mesh) =>
    matchesMeshOrMaterialName(mesh, HELMET_ASSET_CONFIG.accentMeshNames) &&
    !faceguardMeshes.includes(mesh),
  );
  const shellMeshes = meshes.filter((mesh) =>
    matchesMeshOrMaterialName(mesh, HELMET_ASSET_CONFIG.shellMeshNames) &&
    !faceguardMeshes.includes(mesh) &&
    !accentMeshes.includes(mesh),
  );

  return {
    accentMeshes,
    faceguardMeshes,
    shellMeshes: shellMeshes.length > 0
      ? shellMeshes
      : meshes.filter((mesh) => !faceguardMeshes.includes(mesh) && !accentMeshes.includes(mesh)),
  };
}

export function applyHelmetUniformMaterials(
  parts: HelmetPartMeshes,
  uniform: UniformPalette,
  materialScope = '',
): void {
  for (const shellMesh of parts.shellMeshes) {
    assignUniformMaterial(shellMesh, 'shell', uniform, materialScope);
  }

  for (const faceguardMesh of parts.faceguardMeshes) {
    assignUniformMaterial(faceguardMesh, 'faceguard', uniform, materialScope);
  }

  for (const accentMesh of parts.accentMeshes ?? []) {
    assignUniformMaterial(accentMesh, 'accent', uniform, materialScope);
  }
}

export function applyHelmetTeamMaterialsForUniforms(
  parts: HelmetPartMeshes,
  team: PlayerTeam,
  teamUniforms: Record<PlayerTeam, UniformPalette>,
): void {
  applyHelmetUniformMaterials(
    parts,
    teamUniforms[team],
    createHelmetMaterialScope(team, teamUniforms),
  );
}

export function createHelmetMaterialScope(
  team: PlayerTeam,
  teamUniforms: Record<PlayerTeam, UniformPalette>,
): string {
  const palette = teamUniforms[team];
  return `${team}:${palette.helmetShell}:${palette.faceguard}:${palette.stripe}`;
}

export function applyHelmetOffset(
  object: THREE.Object3D,
  offset: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  },
): void {
  object.position.set(offset.position.x, offset.position.y, offset.position.z);
  object.rotation.set(offset.rotation.x, offset.rotation.y, offset.rotation.z);
  object.scale.set(offset.scale.x, offset.scale.y, offset.scale.z);
}

export function measureHelmetBounds(root: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(root);
}

function assignUniformMaterial(
  mesh: THREE.Mesh,
  part: HelmetPart,
  uniform: UniformPalette,
  materialScope: string,
): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const assignedMaterials = materials.map(() =>
    getUniformMaterial(part, uniform, materialScope),
  );

  mesh.material = Array.isArray(mesh.material) ? assignedMaterials : assignedMaterials[0];
}

function getUniformMaterial(
  part: HelmetPart,
  uniform: UniformPalette,
  _materialScope: string,
): THREE.Material {
  const color = resolveHelmetPartColor(part, uniform);
  const component = part === 'faceguard' ? 'faceguard' : 'shell';
  return getHelmetRuntimeMaterial({
    color,
    component,
  });
}

function resolveHelmetPartColor(part: HelmetPart, uniform: UniformPalette): number {
  if (part === 'faceguard') {
    return getUniformColorNumber(uniform.faceguard);
  }

  return getUniformColorNumber(uniform.helmetShell);
}

export function createHelmetRuntimeMaterialKey(part: HelmetPart, uniform: UniformPalette): string {
  const component = part === 'faceguard' ? 'faceguard' : 'shell';
  return createHelmetMaterialCacheKey(component, normalizeMaterialHex(resolveHelmetPartColor(part, uniform)));
}

function findMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      meshes.push(object);
    }
  });

  return meshes;
}

function matchesMeshOrMaterialName(mesh: THREE.Mesh, names: readonly string[]): boolean {
  const candidateNames = [mesh.name, ...getMaterialNames(mesh.material)].map(normalizeName);

  return names.some((name) => {
    const normalizedName = normalizeName(name);

    return candidateNames.some((candidateName) => candidateName.includes(normalizedName));
  });
}

function getMaterialNames(material: THREE.Material | THREE.Material[]): string[] {
  return (Array.isArray(material) ? material : [material]).map((candidate) => candidate.name);
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
