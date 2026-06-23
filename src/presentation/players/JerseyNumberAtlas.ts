import * as THREE from 'three';

export interface JerseyNumberAtlasCell {
  column: number;
  number: number;
  row: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export interface JerseyNumberAtlas {
  cellSize: number;
  cellsPerRow: number;
  texture: THREE.Texture;
  textureSize: number;
}

export interface JerseyNumberAtlasSnapshot {
  atlasCreated: boolean;
  cellCount: number;
  cellsPerRow: number;
  textureId: string | null;
  textureSize: number;
}

export const JERSEY_NUMBER_ATLAS_CONFIG = {
  cellsPerRow: 10,
  fontFamily: 'Arial, Helvetica, sans-serif',
  textureSize: 1024,
} as const;

let atlas: JerseyNumberAtlas | null = null;

export function getJerseyNumberAtlas(): JerseyNumberAtlas {
  if (atlas) {
    return atlas;
  }

  const textureSize = JERSEY_NUMBER_ATLAS_CONFIG.textureSize;
  const cellsPerRow = JERSEY_NUMBER_ATLAS_CONFIG.cellsPerRow;
  const cellSize = textureSize / cellsPerRow;
  const canvas = createAtlasCanvas(textureSize);
  if (!canvas) {
    const texture = createFallbackDataTexture();
    atlas = {
      cellSize,
      cellsPerRow,
      texture,
      textureSize,
    };
    return atlas;
  }
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create jersey number atlas canvas context.');
  }

  context.clearRect(0, 0, textureSize, textureSize);
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  for (let number = 0; number <= 99; number += 1) {
    const cell = resolveJerseyNumberAtlasCell(number);
    const text = String(number);
    const fontSize = number < 10 ? 88 : 72;
    context.font = `800 ${fontSize}px ${JERSEY_NUMBER_ATLAS_CONFIG.fontFamily}`;
    context.fillText(
      text,
      cell.column * cellSize + cellSize / 2,
      cell.row * cellSize + cellSize / 2 + 2,
      cellSize * 0.9,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'jersey-number-atlas-0-99';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  atlas = {
    cellSize,
    cellsPerRow,
    texture,
    textureSize,
  };
  return atlas;
}

export function resolveJerseyNumberAtlasCell(number: number): JerseyNumberAtlasCell {
  const clamped = clampJerseyNumber(number);
  const cellsPerRow = JERSEY_NUMBER_ATLAS_CONFIG.cellsPerRow;
  const column = clamped % cellsPerRow;
  const row = Math.floor(clamped / cellsPerRow);
  const u0 = column / cellsPerRow;
  const u1 = (column + 1) / cellsPerRow;
  const v1 = 1 - row / cellsPerRow;
  const v0 = 1 - (row + 1) / cellsPerRow;

  return {
    column,
    number: clamped,
    row,
    u0,
    u1,
    v0,
    v1,
  };
}

export function getJerseyNumberAtlasSnapshot(): JerseyNumberAtlasSnapshot {
  return {
    atlasCreated: Boolean(atlas),
    cellCount: JERSEY_NUMBER_ATLAS_CONFIG.cellsPerRow * JERSEY_NUMBER_ATLAS_CONFIG.cellsPerRow,
    cellsPerRow: JERSEY_NUMBER_ATLAS_CONFIG.cellsPerRow,
    textureId: atlas?.texture.uuid ?? null,
    textureSize: JERSEY_NUMBER_ATLAS_CONFIG.textureSize,
  };
}

function createAtlasCanvas(size: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  if (typeof canvas.getContext !== 'function') {
    return null;
  }
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createFallbackDataTexture(): THREE.DataTexture {
  const data = new Uint8Array([255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.name = 'jersey-number-atlas-test-fallback';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function clampJerseyNumber(number: number): number {
  return Math.min(99, Math.max(0, Math.trunc(number)));
}
