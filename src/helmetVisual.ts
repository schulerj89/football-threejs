import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import helmetUrl from '../low_poly_helmet.glb?url';
import type { PlayerModel, PlayerTeam } from './playerModel';
import { PLAYER_BODY_DIMENSIONS, getPlayerVisualHeadAnchor } from './playerVisual';

type HelmetAssetStatus = 'idle' | 'loading' | 'loaded' | 'error';
type HelmetPart = 'faceguard' | 'shell';
type AttachedHelmetReferences = {
  helmet: THREE.Object3D;
  parts: HelmetPartMeshes;
  team: PlayerTeam | null;
};

export interface HelmetAssetSnapshot {
  assetId: string;
  attachedPlayerIds: string[];
  errorMessage: string | null;
  faceguardMeshNames: string[];
  shellMeshNames: string[];
  status: HelmetAssetStatus;
}

export interface HelmetPartMeshes {
  faceguardMeshes: THREE.Mesh[];
  shellMeshes: THREE.Mesh[];
}

export const HELMET_ASSET_ID = 'low_poly_helmet';

export const HELMET_VISUAL_CONFIG = {
  assetUrl: helmetUrl,
  faceguardMeshNames: ['faceguard', 'face-guard', 'face_guard', 'facemask', 'face-mask', 'guard'],
  faceguardOffset: {
    position: { x: 0, y: -0.04, z: 0.48 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
  helmetOffset: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: {
      x: PLAYER_BODY_DIMENSIONS.helmetScale,
      y: PLAYER_BODY_DIMENSIONS.helmetScale,
      z: PLAYER_BODY_DIMENSIONS.helmetScale,
    },
  },
  shellMeshNames: ['helmet_shell', 'helmet-shell', 'shell', 'helmet', 'mesh1.0'],
  teamColors: {
    defense: {
      faceguard: 0x24282e,
      shell: 0xb83737,
    },
    offense: {
      faceguard: 0xf3f5f8,
      shell: 0x2f66d8,
    },
  },
} as const;

const helmetAssetState: HelmetAssetSnapshot = {
  assetId: HELMET_ASSET_ID,
  attachedPlayerIds: [],
  errorMessage: null,
  faceguardMeshNames: [],
  shellMeshNames: [],
  status: 'idle',
};

const loader = new GLTFLoader();
const teamMaterialCache = new Map<string, THREE.Material>();
const attachedHelmetReferences = new WeakMap<THREE.Object3D, AttachedHelmetReferences>();
let helmetTemplatePromise: Promise<THREE.Group> | null = null;

export async function attachHelmetToPlayerVisual(
  playerVisual: THREE.Object3D,
  player: PlayerModel,
): Promise<boolean> {
  const headAnchor = getPlayerVisualHeadAnchor(playerVisual);

  if (!headAnchor) {
    return false;
  }

  const existingReferences = getAttachedHelmetReferences(playerVisual);
  if (existingReferences ?? headAnchor.getObjectByName('low-poly-helmet')) {
    syncHelmetTeamMaterials(playerVisual, player);
    return true;
  }

  const template = await loadHelmetTemplate();
  const helmet = template.clone(true);
  helmet.name = 'low-poly-helmet';
  helmet.userData.assetId = HELMET_ASSET_ID;
  applyHelmetOffset(helmet, HELMET_VISUAL_CONFIG.helmetOffset);

  const helmetParts = findHelmetPartMeshes(helmet);

  if (helmetParts.faceguardMeshes.length === 0) {
    const fallbackFaceguard = createFallbackFaceguard();
    helmet.add(fallbackFaceguard);
    helmetParts.faceguardMeshes.push(...findMeshes(fallbackFaceguard));
  }

  applyHelmetTeamMaterials(helmetParts, player.team);
  cacheAttachedHelmetReferences(playerVisual, helmet, helmetParts, player.team);
  headAnchor.add(helmet);
  recordAttachedPlayer(player.id);
  return true;
}

export function attachHelmetsToPlayerVisuals(
  playerVisuals: Map<string, THREE.Group>,
  players: PlayerModel[],
): void {
  for (const player of players) {
    const playerVisual = playerVisuals.get(player.id);

    if (!playerVisual) {
      continue;
    }

    void attachHelmetToPlayerVisual(playerVisual, player).catch((error: unknown) => {
      helmetAssetState.status = 'error';
      helmetAssetState.errorMessage = error instanceof Error ? error.message : String(error);
    });
  }
}

export function syncHelmetTeamMaterials(
  playerVisual: THREE.Object3D,
  player: PlayerModel,
): void {
  const references = getOrCreateAttachedHelmetReferences(playerVisual);
  if (!references) {
    return;
  }

  if (references.team === player.team) {
    return;
  }

  applyHelmetTeamMaterials(references.parts, player.team);
  references.team = player.team;
}

export function getHelmetAssetSnapshot(): HelmetAssetSnapshot {
  return {
    assetId: helmetAssetState.assetId,
    attachedPlayerIds: [...helmetAssetState.attachedPlayerIds],
    errorMessage: helmetAssetState.errorMessage,
    faceguardMeshNames: [...helmetAssetState.faceguardMeshNames],
    shellMeshNames: [...helmetAssetState.shellMeshNames],
    status: helmetAssetState.status,
  };
}

export function findHelmetPartMeshes(root: THREE.Object3D): HelmetPartMeshes {
  const meshes = findMeshes(root);
  const faceguardMeshes = meshes.filter((mesh) =>
    matchesMeshOrMaterialName(mesh, HELMET_VISUAL_CONFIG.faceguardMeshNames),
  );
  const shellMeshes = meshes.filter((mesh) =>
    matchesMeshOrMaterialName(mesh, HELMET_VISUAL_CONFIG.shellMeshNames) &&
    !faceguardMeshes.includes(mesh),
  );

  return {
    faceguardMeshes,
    shellMeshes: shellMeshes.length > 0 ? shellMeshes : meshes.filter((mesh) => !faceguardMeshes.includes(mesh)),
  };
}

export function applyHelmetTeamMaterials(parts: HelmetPartMeshes, team: PlayerTeam): void {
  for (const shellMesh of parts.shellMeshes) {
    assignTeamMaterial(shellMesh, 'shell', team);
  }

  for (const faceguardMesh of parts.faceguardMeshes) {
    assignTeamMaterial(faceguardMesh, 'faceguard', team);
  }
}

async function loadHelmetTemplate(): Promise<THREE.Group> {
  if (!helmetTemplatePromise) {
    helmetAssetState.status = 'loading';
    helmetTemplatePromise = new Promise((resolve, reject) => {
      loader.load(
        HELMET_VISUAL_CONFIG.assetUrl,
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

function createFallbackFaceguard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'helmet-faceguard-fallback';
  group.userData.helmetPart = 'faceguard';
  applyHelmetOffset(group, HELMET_VISUAL_CONFIG.faceguardOffset);

  const verticalBarGeometry = new THREE.BoxGeometry(0.08, 0.56, 0.08);
  const horizontalBarGeometry = new THREE.BoxGeometry(0.62, 0.08, 0.08);
  const material = new THREE.MeshStandardMaterial({
    color: HELMET_VISUAL_CONFIG.teamColors.offense.faceguard,
    metalness: 0.1,
    roughness: 0.55,
  });

  const centerBar = new THREE.Mesh(verticalBarGeometry, material);
  centerBar.name = 'helmet-faceguard-center';
  centerBar.position.set(0, -0.02, 0);
  group.add(centerBar);

  const leftBar = new THREE.Mesh(verticalBarGeometry.clone(), material);
  leftBar.name = 'helmet-faceguard-left';
  leftBar.position.set(-0.28, -0.02, 0);
  group.add(leftBar);

  const rightBar = new THREE.Mesh(verticalBarGeometry.clone(), material);
  rightBar.name = 'helmet-faceguard-right';
  rightBar.position.set(0.28, -0.02, 0);
  group.add(rightBar);

  const topBar = new THREE.Mesh(horizontalBarGeometry, material);
  topBar.name = 'helmet-faceguard-top';
  topBar.position.set(0, 0.18, 0);
  group.add(topBar);

  const bottomBar = new THREE.Mesh(horizontalBarGeometry.clone(), material);
  bottomBar.name = 'helmet-faceguard-bottom';
  bottomBar.position.set(0, -0.18, 0);
  group.add(bottomBar);

  return group;
}

function assignTeamMaterial(mesh: THREE.Mesh, part: HelmetPart, team: PlayerTeam): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const assignedMaterials = materials.map((material) => getTeamMaterial(material, part, team));

  mesh.material = Array.isArray(mesh.material) ? assignedMaterials : assignedMaterials[0];
}

function getTeamMaterial(
  sourceMaterial: THREE.Material,
  part: HelmetPart,
  team: PlayerTeam,
): THREE.Material {
  const cacheKey = `${part}:${team}:${sourceMaterial.uuid}`;
  const cachedMaterial = teamMaterialCache.get(cacheKey);

  if (cachedMaterial) {
    return cachedMaterial;
  }

  const material = sourceMaterial.clone();
  const color = HELMET_VISUAL_CONFIG.teamColors[team][part];

  if ('color' in material && material.color instanceof THREE.Color) {
    material.color.setHex(color);
  }

  material.name = `${HELMET_ASSET_ID}-${team}-${part}`;
  material.needsUpdate = true;
  teamMaterialCache.set(cacheKey, material);
  return material;
}

function applyHelmetOffset(
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

function getOrCreateAttachedHelmetReferences(
  playerVisual: THREE.Object3D,
): AttachedHelmetReferences | null {
  const cachedReferences = getAttachedHelmetReferences(playerVisual);

  if (cachedReferences) {
    return cachedReferences;
  }

  const helmet = playerVisual.getObjectByName('low-poly-helmet');

  if (!helmet) {
    return null;
  }

  return cacheAttachedHelmetReferences(playerVisual, helmet, findHelmetPartMeshes(helmet), null);
}

function getAttachedHelmetReferences(playerVisual: THREE.Object3D): AttachedHelmetReferences | null {
  const references = attachedHelmetReferences.get(playerVisual);

  if (!references || references.helmet.parent === null) {
    return null;
  }

  return references;
}

function cacheAttachedHelmetReferences(
  playerVisual: THREE.Object3D,
  helmet: THREE.Object3D,
  parts: HelmetPartMeshes,
  team: PlayerTeam | null,
): AttachedHelmetReferences {
  const references = { helmet, parts, team };
  attachedHelmetReferences.set(playerVisual, references);
  return references;
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

function recordAttachedPlayer(playerId: string): void {
  if (helmetAssetState.attachedPlayerIds.includes(playerId)) {
    return;
  }

  helmetAssetState.attachedPlayerIds.push(playerId);
  helmetAssetState.attachedPlayerIds.sort();
}
