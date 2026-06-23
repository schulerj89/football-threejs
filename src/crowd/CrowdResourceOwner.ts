import * as THREE from 'three';
import { applyCrowdAccentColors, createCrowdResources } from './CrowdMeshFactory';
import type { CrowdFullness } from './CrowdTypes';
import type { CrowdResources } from './CrowdTypes';
import type { CrowdDensity } from './CrowdReactionModel';

export class CrowdResourceOwner {
  private currentResources: CrowdResources;
  private accentColors: readonly number[];
  private crowdFullness: CrowdFullness;
  private density: CrowdDensity | undefined;
  private nearCount: number | undefined;
  private reactingSpectatorLimit: number | undefined;

  constructor(
    requestedCount: number,
    groupName: string,
    accentColors: readonly number[] = [],
    options: {
      crowdFullness?: CrowdFullness;
      density?: CrowdDensity;
      nearCount?: number;
      reactingSpectatorLimit?: number;
    } = {},
  ) {
    this.accentColors = accentColors;
    this.crowdFullness = options.crowdFullness ?? 'sparse';
    this.density = options.density;
    this.nearCount = options.nearCount;
    this.reactingSpectatorLimit = options.reactingSpectatorLimit;
    this.currentResources = createCrowdResources(requestedCount, {
      accentColors,
      crowdFullness: this.crowdFullness,
      density: this.density,
      nearCount: this.nearCount,
      reactingSpectatorLimit: this.reactingSpectatorLimit,
    });
    this.currentResources.group.name = groupName;
  }

  get group(): THREE.Group {
    return this.currentResources.group;
  }

  get resources(): CrowdResources {
    return this.currentResources;
  }

  rebuild(
    requestedCount: number,
    groupName = this.currentResources.group.name,
    options: {
      crowdFullness?: CrowdFullness;
      density?: CrowdDensity;
      nearCount?: number;
      reactingSpectatorLimit?: number;
    } = {},
  ): CrowdResources {
    this.dispose();
    this.crowdFullness = options.crowdFullness ?? this.crowdFullness;
    this.density = options.density ?? this.density;
    this.nearCount = options.nearCount ?? this.nearCount;
    this.reactingSpectatorLimit =
      options.reactingSpectatorLimit ?? this.reactingSpectatorLimit;
    this.currentResources = createCrowdResources(requestedCount, {
      accentColors: this.accentColors,
      crowdFullness: this.crowdFullness,
      density: this.density,
      nearCount: this.nearCount,
      reactingSpectatorLimit: this.reactingSpectatorLimit,
    });
    this.currentResources.group.name = groupName;
    return this.currentResources;
  }

  setAccentColors(accentColors: readonly number[]): void {
    this.accentColors = accentColors;
    applyCrowdAccentColors(this.currentResources, accentColors);
  }

  enableDynamicInstanceMatrices(): void {
    const meshes = [
      this.currentResources.detailedTorso,
      this.currentResources.detailedHead,
      this.currentResources.detailedArmLeft,
      this.currentResources.detailedArmRight,
    ];

    for (const mesh of meshes) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }

  dispose(): void {
    disposeCrowdResources(this.currentResources);
  }
}

export function disposeCrowdResources(resources: CrowdResources): void {
  for (const geometry of new Set(resources.geometries)) {
    geometry.dispose();
  }

  for (const material of new Set(resources.materials)) {
    material.dispose();
  }
}
