import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type RiggedPlayerAssetStatus = 'error' | 'idle' | 'loaded' | 'loading';

export interface RiggedPlayerAssetManifest {
  animationCount: number;
  assetId: string;
  assetVersion: number;
  boneNames: string[];
  contentHashes: Record<string, string>;
  heightMeters: number;
  materialRegionNames: string[];
  orientation: {
    forward: '+Z';
    up: '+Y';
  };
  socketNames: string[];
  triangleCount: number;
}

export interface RiggedPlayerAssetSnapshot {
  assetId: string;
  boneCount: number;
  errorMessage: string | null;
  manifestLoaded: boolean;
  materialRegionNames: string[];
  skinnedMeshCount: number;
  socketNames: string[];
  status: RiggedPlayerAssetStatus;
  triangleCount: number;
}

export interface RiggedPlayerTemplate {
  manifest: RiggedPlayerAssetManifest;
  scene: THREE.Object3D;
}

export const RIGGED_PLAYER_ASSET_ID = 'football-js-player-base';

export const RIGGED_PLAYER_ASSET_CONFIG = {
  assetUrl: '/models/player/player-base-rigged.glb',
  manifestUrl: '/models/player/player-asset-manifest.json',
} as const;

const loader = new GLTFLoader();

let templatePromise: Promise<RiggedPlayerTemplate> | null = null;
let template: RiggedPlayerTemplate | null = null;
let snapshot: RiggedPlayerAssetSnapshot = createIdleSnapshot();

export async function loadRiggedPlayerTemplate(): Promise<RiggedPlayerTemplate> {
  if (template) {
    return template;
  }

  if (!templatePromise) {
    snapshot = {
      ...snapshot,
      errorMessage: null,
      status: 'loading',
    };
    templatePromise = Promise.all([
      loadManifest(RIGGED_PLAYER_ASSET_CONFIG.manifestUrl),
      loadGltfScene(RIGGED_PLAYER_ASSET_CONFIG.assetUrl),
    ])
      .then(([manifest, scene]) => {
        template = {
          manifest,
          scene,
        };
        snapshot = createLoadedSnapshot(template);
        return template;
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        snapshot = {
          ...createIdleSnapshot(),
          errorMessage,
          status: 'error',
        };
        templatePromise = null;
        throw error;
      });
  }

  return templatePromise;
}

export function cloneRiggedPlayerTemplate(name = 'rigged-player-body'): THREE.Object3D | null {
  if (!template) {
    return null;
  }

  const clone = cloneSkeleton(template.scene);
  clone.name = name;
  clone.userData.riggedPlayerClone = true;
  return clone;
}

export function getRiggedPlayerAssetSnapshot(): RiggedPlayerAssetSnapshot {
  return {
    ...snapshot,
    materialRegionNames: [...snapshot.materialRegionNames],
    socketNames: [...snapshot.socketNames],
  };
}

export function setRiggedPlayerTemplateForTest(
  scene: THREE.Object3D,
  manifest: Partial<RiggedPlayerAssetManifest> = {},
): void {
  template = {
    manifest: {
      animationCount: 0,
      assetId: RIGGED_PLAYER_ASSET_ID,
      assetVersion: 1,
      boneNames: collectBoneNames(scene),
      contentHashes: {},
      heightMeters: 1.85,
      materialRegionNames: [
        'mat_player_skin',
        'mat_player_jersey',
        'mat_player_pants_socks',
        'mat_player_shoes',
      ],
      orientation: { forward: '+Z', up: '+Y' },
      socketNames: collectSocketNames(scene),
      triangleCount: countObjectTriangles(scene),
      ...manifest,
    },
    scene,
  };
  templatePromise = Promise.resolve(template);
  snapshot = createLoadedSnapshot(template);
}

export function resetRiggedPlayerAssetLibraryForTest(): void {
  template = null;
  templatePromise = null;
  snapshot = createIdleSnapshot();
}

async function loadManifest(url: string): Promise<RiggedPlayerAssetManifest> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load rigged player manifest: ${response.status} ${response.statusText}`);
  }
  return await response.json() as RiggedPlayerAssetManifest;
}

async function loadGltfScene(url: string): Promise<THREE.Object3D> {
  return await new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        gltf.scene.name = 'rigged-player-template';
        resolve(gltf.scene);
      },
      undefined,
      reject,
    );
  });
}

function createIdleSnapshot(): RiggedPlayerAssetSnapshot {
  return {
    assetId: RIGGED_PLAYER_ASSET_ID,
    boneCount: 0,
    errorMessage: null,
    manifestLoaded: false,
    materialRegionNames: [],
    skinnedMeshCount: 0,
    socketNames: [],
    status: 'idle',
    triangleCount: 0,
  };
}

function createLoadedSnapshot(loadedTemplate: RiggedPlayerTemplate): RiggedPlayerAssetSnapshot {
  return {
    assetId: loadedTemplate.manifest.assetId,
    boneCount: collectBoneNames(loadedTemplate.scene).length,
    errorMessage: null,
    manifestLoaded: true,
    materialRegionNames: [...loadedTemplate.manifest.materialRegionNames],
    skinnedMeshCount: collectSkinnedMeshes(loadedTemplate.scene).length,
    socketNames: [...loadedTemplate.manifest.socketNames],
    status: 'loaded',
    triangleCount: loadedTemplate.manifest.triangleCount,
  };
}

function collectSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) {
      meshes.push(object);
    }
  });
  return meshes;
}

function collectBoneNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Bone) {
      names.push(object.name);
    }
  });
  return names;
}

function collectSocketNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((object) => {
    if (object.name.startsWith('socket_')) {
      names.push(object.name);
    }
  });
  return names.sort();
}

function countObjectTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      triangles += countGeometryTriangles(object.geometry);
    }
  });
  return triangles;
}

function countGeometryTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }
  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}
