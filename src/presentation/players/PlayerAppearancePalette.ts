import * as THREE from 'three';
import {
  SKIN_TONE_PALETTE,
  resolvePlayerAppearance,
  type SkinToneId,
} from '../../playerAppearance';
import { getUniformColorNumber } from '../../teams/TeamThemeApplier';
import type { UniformPalette } from '../../teams/UniformPalette';

export type PlayerAppearanceMaterialRegion =
  | 'jersey'
  | 'pants_socks'
  | 'shoes'
  | 'skin';

export interface PlayerAppearancePaletteSnapshot {
  materialCount: number;
  materialIds: string[];
}

const materialCache = new Map<string, THREE.MeshLambertMaterial>();

export function getPlayerAppearanceMaterial(
  region: PlayerAppearanceMaterialRegion,
  options: {
    appearanceId: string;
    uniform: UniformPalette;
  },
): THREE.MeshLambertMaterial {
  if (region === 'skin') {
    return getSkinMaterial(resolvePlayerAppearance(options.appearanceId).skinToneId);
  }

  const color = resolveUniformRegionColor(region, options.uniform);
  const cacheKey = `rigged:${region}:${normalizeHex(color)}`;
  const cached = materialCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const material = new THREE.MeshLambertMaterial({
    color: getUniformColorNumber(color),
    flatShading: true,
  });
  material.name = cacheKey;
  materialCache.set(cacheKey, material);
  return material;
}

export function getPlayerAppearancePaletteSnapshot(): PlayerAppearancePaletteSnapshot {
  return {
    materialCount: materialCache.size,
    materialIds: [...materialCache.keys()].sort(),
  };
}

function getSkinMaterial(skinToneId: SkinToneId): THREE.MeshLambertMaterial {
  const cacheKey = `rigged:skin:${skinToneId}`;
  const cached = materialCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const tone = SKIN_TONE_PALETTE.find((candidate) => candidate.skinToneId === skinToneId);
  const material = new THREE.MeshLambertMaterial({
    color: tone?.skinColor ?? 0xb9835c,
    flatShading: true,
  });
  material.name = cacheKey;
  materialCache.set(cacheKey, material);
  return material;
}

function resolveUniformRegionColor(
  region: Exclude<PlayerAppearanceMaterialRegion, 'skin'>,
  uniform: UniformPalette,
): string {
  if (region === 'jersey') {
    return uniform.jersey;
  }

  if (region === 'shoes') {
    return uniform.shoe;
  }

  return uniform.pants;
}

function normalizeHex(hex: string): string {
  const normalized = hex.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : '#ffffff';
}
