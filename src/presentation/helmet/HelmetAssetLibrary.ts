import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PlayerTeam } from '../../playerModel';
import { getUniformColorNumber } from '../../teams/TeamThemeApplier';
import type { UniformPalette } from '../../teams/UniformPalette';
import {
  createHelmetMaterialCacheKey,
  getHelmetGameplayVertexColorMaterial,
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
  gameplayMeshes?: THREE.Mesh[];
  shellMeshes: THREE.Mesh[];
}

type HelmetGameplayPart = 'faceguard' | 'shell';

interface HelmetGameplayVertexRange {
  count: number;
  part: HelmetGameplayPart;
  start: number;
}

export const HELMET_ASSET_ID = 'football-helmet-kit';
export const HELMET_DETAIL_LOD_DISTANCE = 8;
export const HELMET_DETAIL_LOD_NAME = 'football-helmet-detail-lod';
export const HELMET_GAMEPLAY_PROXY_NAME = 'football-helmet-gameplay-proxy';

export const HELMET_ASSET_CONFIG = {
  accentMeshNames: ['stripe', 'helmetstripe', 'accent', 'trim'],
  assetUrl: '/models/helmet/football-helmet-kit.glb',
  lodAssetUrl: '/models/helmet/football-helmet-kit-lod.glb',
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
let helmetLodTemplate: THREE.Group | null = null;
let gameplayGeometryPaletteCache = new WeakMap<
  THREE.BufferGeometry,
  Map<string, THREE.BufferGeometry>
>();
let gameplayGeometrySources = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

export async function loadHelmetTemplate(): Promise<THREE.Group> {
  if (!helmetTemplatePromise) {
    helmetAssetState.status = 'loading';
    helmetAssetState.errorMessage = null;
    helmetTemplatePromise = loadHelmetScene(
      HELMET_ASSET_CONFIG.assetUrl,
      'low-poly-helmet-template',
    ).then(async (template) => {
      try {
        const lodTemplate = await loadHelmetScene(
          HELMET_ASSET_CONFIG.lodAssetUrl,
          'low-poly-helmet-lod-template',
        );
        helmetLodTemplate = createHelmetGameplayProxy(lodTemplate);
      } catch {
        // The distant proxy is an optimization only. Keep the source helmet
        // available at every distance if that optional asset cannot load.
        helmetLodTemplate = null;
      }
      const parts = findHelmetPartMeshes(template);
      helmetAssetState.shellMeshNames = parts.shellMeshes.map((mesh) => mesh.name);
      helmetAssetState.faceguardMeshNames = parts.faceguardMeshes.map((mesh) => mesh.name);
      helmetAssetState.status = 'loaded';
      return template;
    }).catch((error: unknown) => {
      helmetAssetState.status = 'error';
      helmetAssetState.errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    });
  }

  return helmetTemplatePromise;
}

export async function cloneHelmetAsset(name = 'low-poly-helmet'): Promise<THREE.Group> {
  const template = await loadHelmetTemplate();
  const helmet = new THREE.Group();
  helmet.name = name;
  helmet.userData.assetId = HELMET_ASSET_ID;
  const fullDetail = template.clone(true);
  if (helmetLodTemplate) {
    helmet.add(createHelmetDetailLod(
      fullDetail,
      helmetLodTemplate.clone(true),
      name,
    ));
  } else {
    prepareHelmetDetailLevel(fullDetail, `${name}-source`, 'full');
    helmet.add(fullDetail);
  }
  return helmet;
}

export function createHelmetDetailLod(
  fullDetail: THREE.Object3D,
  gameplayDetail: THREE.Object3D,
  name = 'low-poly-helmet',
): THREE.LOD {
  const detailLod = new THREE.LOD();
  detailLod.name = HELMET_DETAIL_LOD_NAME;
  detailLod.autoUpdate = true;

  prepareHelmetDetailLevel(fullDetail, `${name}-source`, 'full');
  prepareHelmetDetailLevel(gameplayDetail, `${name}-lod-source`, 'gameplay');
  detailLod.addLevel(fullDetail, 0, 0.12);
  detailLod.addLevel(gameplayDetail, HELMET_DETAIL_LOD_DISTANCE, 0.12);
  return detailLod;
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
  const gameplayMeshes = meshes.filter(isHelmetGameplayProxyMesh);
  const faceguardMeshes = meshes.filter((mesh) =>
    !gameplayMeshes.includes(mesh) &&
    matchesMeshOrMaterialName(mesh, HELMET_ASSET_CONFIG.faceguardMeshNames),
  );
  const accentMeshes = meshes.filter((mesh) =>
    !gameplayMeshes.includes(mesh) &&
    matchesMeshOrMaterialName(mesh, HELMET_ASSET_CONFIG.accentMeshNames) &&
    !faceguardMeshes.includes(mesh),
  );
  const shellMeshes = meshes.filter((mesh) =>
    !gameplayMeshes.includes(mesh) &&
    matchesMeshOrMaterialName(mesh, HELMET_ASSET_CONFIG.shellMeshNames) &&
    !faceguardMeshes.includes(mesh) &&
    !accentMeshes.includes(mesh),
  );

  return {
    accentMeshes,
    faceguardMeshes,
    gameplayMeshes,
    shellMeshes: shellMeshes.length > 0
      ? shellMeshes
      : meshes.filter((mesh) =>
        !gameplayMeshes.includes(mesh) &&
        !faceguardMeshes.includes(mesh) &&
        !accentMeshes.includes(mesh),
      ),
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

  for (const gameplayMesh of parts.gameplayMeshes ?? []) {
    applyGameplayUniformColors(gameplayMesh, uniform);
  }
}

/**
 * Flattens the two semantic meshes in the Blender-authored field LOD into a
 * single mesh. The semantic ranges remain in geometry metadata and are baked
 * into cached vertex-colored geometry when a team palette is applied.
 */
export function createHelmetGameplayProxy(root: THREE.Group): THREE.Group {
  const parts = findHelmetPartMeshes(root);
  const faceguards = new Set(parts.faceguardMeshes);
  const shells = new Set([
    ...parts.shellMeshes,
    ...(parts.accentMeshes ?? []),
  ]);
  const meshes = findMeshes(root).filter((mesh) => faceguards.has(mesh) || shells.has(mesh));

  if (meshes.length === 0) {
    throw new Error('Helmet gameplay LOD does not contain mergeable meshes.');
  }

  root.updateMatrixWorld(true);
  const rootWorldInverse = root.matrixWorld.clone().invert();
  const geometries: THREE.BufferGeometry[] = [];
  const vertexRanges: HelmetGameplayVertexRange[] = [];
  let vertexStart = 0;

  for (const mesh of meshes) {
    const geometry = createGameplayMergeGeometry(
      mesh.geometry,
      rootWorldInverse.clone().multiply(mesh.matrixWorld),
    );
    const vertexCount = geometry.getAttribute('position').count;
    geometries.push(geometry);
    vertexRanges.push({
      count: vertexCount,
      part: faceguards.has(mesh) ? 'faceguard' : 'shell',
      start: vertexStart,
    });
    vertexStart += vertexCount;
  }

  const mergedGeometry = mergeGeometries(geometries, false);
  for (const geometry of geometries) {
    geometry.dispose();
  }

  if (!mergedGeometry) {
    throw new Error('Unable to merge helmet gameplay LOD geometry.');
  }

  mergedGeometry.name = `${HELMET_GAMEPLAY_PROXY_NAME}-geometry`;
  mergedGeometry.userData.helmetGameplayVertexRanges = vertexRanges;
  mergedGeometry.computeBoundingBox();
  mergedGeometry.computeBoundingSphere();
  gameplayGeometrySources.set(mergedGeometry, mergedGeometry);

  const proxy = new THREE.Mesh(mergedGeometry, getHelmetGameplayVertexColorMaterial());
  proxy.name = HELMET_GAMEPLAY_PROXY_NAME;
  proxy.castShadow = meshes.some((mesh) => mesh.castShadow);
  proxy.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
  proxy.userData.helmetGameplayProxy = true;

  for (const child of [...root.children]) {
    root.remove(child);
  }
  root.add(proxy);
  root.userData.helmetGameplayDrawCalls = 1;
  return root;
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

function applyGameplayUniformColors(mesh: THREE.Mesh, uniform: UniformPalette): void {
  const sourceGeometry = gameplayGeometrySources.get(mesh.geometry) ?? mesh.geometry;
  const shellColor = resolveHelmetPartColor('shell', uniform);
  const faceguardColor = resolveHelmetPartColor('faceguard', uniform);
  const paletteKey = `${normalizeMaterialHex(shellColor)}:${normalizeMaterialHex(faceguardColor)}`;
  let paletteCache = gameplayGeometryPaletteCache.get(sourceGeometry);

  if (!paletteCache) {
    paletteCache = new Map();
    gameplayGeometryPaletteCache.set(sourceGeometry, paletteCache);
  }

  let geometry = paletteCache.get(paletteKey);
  if (!geometry) {
    geometry = sourceGeometry.clone();
    const ranges = getGameplayVertexRanges(sourceGeometry);
    const colorAttribute = geometry.getAttribute('color');

    if (!(colorAttribute instanceof THREE.BufferAttribute)) {
      throw new Error('Helmet gameplay proxy is missing its vertex-color attribute.');
    }

    const colors: Record<HelmetGameplayPart, THREE.Color> = {
      faceguard: new THREE.Color(faceguardColor),
      shell: new THREE.Color(shellColor),
    };
    for (const range of ranges) {
      const color = colors[range.part];
      for (let vertex = range.start; vertex < range.start + range.count; vertex += 1) {
        colorAttribute.setXYZ(vertex, color.r, color.g, color.b);
      }
    }
    colorAttribute.needsUpdate = true;
    geometry.name = `${HELMET_GAMEPLAY_PROXY_NAME}-${paletteKey.replace(/#/g, '')}`;
    geometry.userData.helmetGameplayVertexRanges = ranges;
    gameplayGeometrySources.set(geometry, sourceGeometry);
    paletteCache.set(paletteKey, geometry);
  }

  mesh.geometry = geometry;
  mesh.material = getHelmetGameplayVertexColorMaterial();
}

function createGameplayMergeGeometry(
  source: THREE.BufferGeometry,
  transform: THREE.Matrix4,
): THREE.BufferGeometry {
  let transformed = source.clone();
  transformed.applyMatrix4(transform);
  if (transformed.index) {
    const nonIndexed = transformed.toNonIndexed();
    transformed.dispose();
    transformed = nonIndexed;
  }
  if (!transformed.getAttribute('normal')) {
    transformed.computeVertexNormals();
  }

  const position = transformed.getAttribute('position');
  const normal = transformed.getAttribute('normal');
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(position.count * 3);
  const normals = new Float32Array(normal.count * 3);

  for (let index = 0; index < position.count; index += 1) {
    positions[index * 3] = position.getX(index);
    positions[index * 3 + 1] = position.getY(index);
    positions[index * 3 + 2] = position.getZ(index);
    normals[index * 3] = normal.getX(index);
    normals[index * 3 + 1] = normal.getY(index);
    normals[index * 3 + 2] = normal.getZ(index);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(position.count * 3).fill(1), 3));
  transformed.dispose();
  return geometry;
}

function getGameplayVertexRanges(geometry: THREE.BufferGeometry): HelmetGameplayVertexRange[] {
  const ranges = geometry.userData.helmetGameplayVertexRanges;
  if (!Array.isArray(ranges)) {
    throw new Error('Helmet gameplay proxy is missing its semantic vertex ranges.');
  }

  return ranges as HelmetGameplayVertexRange[];
}

function isHelmetGameplayProxyMesh(mesh: THREE.Mesh): boolean {
  return mesh.name === HELMET_GAMEPLAY_PROXY_NAME || mesh.userData.helmetGameplayProxy === true;
}

function loadHelmetScene(assetUrl: string, name: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    loader.load(
      assetUrl,
      (gltf) => {
        gltf.scene.name = name;
        resolve(gltf.scene);
      },
      undefined,
      reject,
    );
  });
}

function prepareHelmetDetailLevel(
  object: THREE.Object3D,
  name: string,
  detail: 'full' | 'gameplay',
): void {
  object.name = name;
  object.userData.helmetDetail = detail;
  object.rotation.set(
    HELMET_ASSET_CONFIG.canonicalRotation.x,
    HELMET_ASSET_CONFIG.canonicalRotation.y,
    HELMET_ASSET_CONFIG.canonicalRotation.z,
  );
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

export function resetHelmetGameplayProxyCacheForTests(): void {
  gameplayGeometryPaletteCache = new WeakMap();
  gameplayGeometrySources = new WeakMap();
}
