import * as THREE from 'three';
import { getUniformColorNumber } from '../../teams/TeamThemeApplier';
import type { UniformPalette } from '../../teams/UniformPalette';
import {
  getJerseyNumberAtlas,
  resolveJerseyNumberAtlasCell,
} from './JerseyNumberAtlas';
import { getJerseyNumberGeometry } from './JerseyNumberGeometryCache';

export const JERSEY_NUMBER_ANCHOR_NAME = 'backNumberAnchor';
export const JERSEY_NUMBER_MESH_NAME = 'backJerseyNumber';
export const FRONT_JERSEY_NUMBER_ANCHOR_NAME = 'frontNumberAnchor';
export const FRONT_JERSEY_NUMBER_MESH_NAME = 'frontJerseyNumber';

export type JerseyNumberMissingBindingReason =
  | 'invalidNumber'
  | 'missingAnchor'
  | 'missingNumber'
  | null;

export interface JerseyNumberVisualController {
  dispose: () => void;
  getSnapshot: () => JerseyNumberVisualSnapshot;
  sync: (jerseyNumber: number | null, uniform: UniformPalette, rosterPlayerId?: string) => void;
}

export interface JerseyNumberVisualSnapshot {
  anchorPosition: { x: number; y: number; z: number } | null;
  atlasCell: { column: number; row: number } | null;
  backAnchorPosition: { x: number; y: number; z: number } | null;
  backVisible: boolean;
  contrastRatio: number | null;
  contrastReadable: boolean | null;
  frontAnchorPosition: { x: number; y: number; z: number } | null;
  frontVisible: boolean;
  jerseyNumber: number | null;
  materialId: string | null;
  missingBindingReason: JerseyNumberMissingBindingReason;
  rosterPlayerId: string;
  visible: boolean;
  visibleMeshCount: number;
  visualId: string;
}

export interface JerseyNumberMaterialSnapshot {
  materialCount: number;
  materialIds: string[];
}

const JERSEY_NUMBER_VISUAL_CONFIG = {
  readableContrastRatio: 2.15,
} as const;

const materialCache = new Map<string, THREE.MeshBasicMaterial>();
const scratchWorldPosition = new THREE.Vector3();

export function attachJerseyNumberVisual(
  root: THREE.Object3D,
  options: {
    jerseyNumber: number | null;
    rosterPlayerId: string;
    uniform: UniformPalette;
    visualId: string;
  },
): JerseyNumberVisualController {
  const backAnchor = root.getObjectByName(JERSEY_NUMBER_ANCHOR_NAME);
  const frontAnchor = root.getObjectByName(FRONT_JERSEY_NUMBER_ANCHOR_NAME);
  let jerseyNumber = normalizeJerseyNumber(options.jerseyNumber);
  let rosterPlayerId = options.rosterPlayerId;
  let uniform = options.uniform;
  let backMesh: THREE.Mesh | null = null;
  let frontMesh: THREE.Mesh | null = null;
  let missingBindingReason = resolveMissingBindingReason(jerseyNumber, [backAnchor, frontAnchor]);

  backMesh = syncNumberMesh(backAnchor, backMesh, JERSEY_NUMBER_MESH_NAME, 'back');
  frontMesh = syncNumberMesh(frontAnchor, frontMesh, FRONT_JERSEY_NUMBER_MESH_NAME, 'front');

  syncRootSnapshot();

  function sync(
    nextJerseyNumber: number | null,
    nextUniform: UniformPalette,
    nextRosterPlayerId = rosterPlayerId,
  ): void {
    jerseyNumber = normalizeJerseyNumber(nextJerseyNumber);
    rosterPlayerId = nextRosterPlayerId;
    uniform = nextUniform;
    missingBindingReason = resolveMissingBindingReason(jerseyNumber, [backAnchor, frontAnchor]);
    backMesh = syncNumberMesh(backAnchor, backMesh, JERSEY_NUMBER_MESH_NAME, 'back');
    frontMesh = syncNumberMesh(frontAnchor, frontMesh, FRONT_JERSEY_NUMBER_MESH_NAME, 'front');
    syncRootSnapshot();
  }

  function getSnapshot(): JerseyNumberVisualSnapshot {
    const backAnchorPosition = backAnchor
      ? vectorToPlain(backAnchor.getWorldPosition(scratchWorldPosition))
      : null;
    const frontAnchorPosition = frontAnchor
      ? vectorToPlain(frontAnchor.getWorldPosition(scratchWorldPosition))
      : null;
    const anchorPosition = backAnchorPosition ?? frontAnchorPosition;
    const cell = jerseyNumber === null ? null : resolveJerseyNumberAtlasCell(jerseyNumber);
    const contrastRatio = calculateContrastRatio(uniform.number, uniform.jersey);
    const backVisible = Boolean(backMesh?.visible && root.visible && !missingBindingReason);
    const frontVisible = Boolean(frontMesh?.visible && root.visible && !missingBindingReason);
    const visibleMeshCount = Number(backVisible) + Number(frontVisible);
    const material = backMesh?.material ?? frontMesh?.material ?? null;

    return {
      anchorPosition,
      atlasCell: cell ? { column: cell.column, row: cell.row } : null,
      backAnchorPosition,
      backVisible,
      contrastRatio,
      contrastReadable: contrastRatio >= JERSEY_NUMBER_VISUAL_CONFIG.readableContrastRatio,
      frontAnchorPosition,
      frontVisible,
      jerseyNumber,
      materialId: material ? getMaterialName(material) : null,
      missingBindingReason,
      rosterPlayerId,
      visible: visibleMeshCount > 0,
      visibleMeshCount,
      visualId: options.visualId,
    };
  }

  function syncNumberMesh(
    anchor: THREE.Object3D | undefined,
    currentMesh: THREE.Mesh | null,
    meshName: string,
    side: 'back' | 'front',
  ): THREE.Mesh | null {
    if (!anchor || jerseyNumber === null) {
      if (currentMesh) {
        currentMesh.visible = false;
      }
      return currentMesh;
    }

    const mesh = currentMesh ?? createNumberMesh(jerseyNumber, uniform, meshName, side);
    if (!currentMesh) {
      anchor.add(mesh);
    }

    mesh.geometry = getJerseyNumberGeometry(jerseyNumber);
    mesh.material = getJerseyNumberMaterial(uniform.number);
    mesh.visible = true;
    mesh.userData.jerseyNumber = jerseyNumber;
    mesh.userData.rosterPlayerId = rosterPlayerId;
    mesh.userData.visualId = options.visualId;
    mesh.userData.jerseyNumberSide = side;
    return mesh;
  }

  function syncRootSnapshot(): void {
    root.userData.jerseyNumberVisual = getSnapshot();
  }

  return {
    dispose: () => {
      if (backMesh) {
        backMesh.removeFromParent();
        backMesh = null;
      }
      if (frontMesh) {
        frontMesh.removeFromParent();
        frontMesh = null;
      }
      root.userData.jerseyNumberVisual = getSnapshot();
    },
    getSnapshot,
    sync,
  };
}

export function getJerseyNumberMaterialSnapshot(): JerseyNumberMaterialSnapshot {
  return {
    materialCount: materialCache.size,
    materialIds: [...materialCache.keys()].sort(),
  };
}

export function readJerseyNumberVisualSnapshot(root: THREE.Object3D): JerseyNumberVisualSnapshot | null {
  const snapshot = root.userData.jerseyNumberVisual;
  return isJerseyNumberVisualSnapshot(snapshot) ? snapshot : null;
}

export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const foreground = relativeLuminance(getUniformColorNumber(foregroundHex));
  const background = relativeLuminance(getUniformColorNumber(backgroundHex));
  const lighter = Math.max(foreground, background);
  const darker = Math.min(foreground, background);
  return (lighter + 0.05) / (darker + 0.05);
}

function createNumberMesh(
  jerseyNumber: number,
  uniform: UniformPalette,
  meshName: string,
  side: 'back' | 'front',
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    getJerseyNumberGeometry(jerseyNumber),
    getJerseyNumberMaterial(uniform.number),
  );
  mesh.name = meshName;
  mesh.renderOrder = 3;
  mesh.userData.excludeFromPlayerBodyBounds = true;
  mesh.userData.jerseyNumberVisual = true;
  mesh.userData.jerseyNumber = jerseyNumber;
  mesh.userData.jerseyNumberSide = side;
  return mesh;
}

function getJerseyNumberMaterial(numberColor: string): THREE.MeshBasicMaterial {
  const color = normalizeHex(numberColor);
  const materialKey = `jersey-number:${color}`;
  const cached = materialCache.get(materialKey);

  if (cached) {
    return cached;
  }

  const material = new THREE.MeshBasicMaterial({
    alphaTest: 0.06,
    color: getUniformColorNumber(color),
    depthWrite: false,
    map: getJerseyNumberAtlas().texture,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.FrontSide,
    transparent: true,
  });
  material.name = materialKey;
  materialCache.set(materialKey, material);
  return material;
}

function resolveMissingBindingReason(
  jerseyNumber: number | null,
  anchors: readonly (THREE.Object3D | undefined)[],
): JerseyNumberMissingBindingReason {
  if (!anchors.some(Boolean)) {
    return 'missingAnchor';
  }

  if (jerseyNumber === null) {
    return 'missingNumber';
  }

  return null;
}

function normalizeJerseyNumber(jerseyNumber: number | null): number | null {
  if (jerseyNumber === null || !Number.isFinite(jerseyNumber)) {
    return null;
  }

  const normalized = Math.trunc(jerseyNumber);
  if (normalized < 0 || normalized > 99) {
    return null;
  }

  return normalized;
}

function normalizeHex(hex: string): string {
  const normalized = hex.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : '#ffffff';
}

function getMaterialName(material: THREE.Material | THREE.Material[]): string | null {
  const first = Array.isArray(material) ? material[0] : material;
  return first?.name ?? null;
}

function relativeLuminance(color: number): number {
  const red = channelLuminance((color >> 16) & 0xff);
  const green = channelLuminance((color >> 8) & 0xff);
  const blue = channelLuminance(color & 0xff);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function channelLuminance(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function vectorToPlain(vector: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function isJerseyNumberVisualSnapshot(value: unknown): value is JerseyNumberVisualSnapshot {
  return Boolean(value && typeof value === 'object' && 'visualId' in value && 'visible' in value);
}
