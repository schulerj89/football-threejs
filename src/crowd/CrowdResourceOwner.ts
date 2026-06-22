import * as THREE from 'three';
import { applyCrowdAccentColors, createCrowdResources } from './CrowdMeshFactory';
import type { CrowdFullness } from './CrowdTypes';
import type { CrowdResources } from './CrowdTypes';

export class CrowdResourceOwner {
  private currentResources: CrowdResources;
  private accentColors: readonly number[];
  private crowdFullness: CrowdFullness;
  private nearCount: number | undefined;

  constructor(
    requestedCount: number,
    groupName: string,
    accentColors: readonly number[] = [],
    options: { crowdFullness?: CrowdFullness; nearCount?: number } = {},
  ) {
    this.accentColors = accentColors;
    this.crowdFullness = options.crowdFullness ?? 'sparse';
    this.nearCount = options.nearCount;
    this.currentResources = createCrowdResources(requestedCount, {
      accentColors,
      crowdFullness: this.crowdFullness,
      nearCount: this.nearCount,
    });
    this.currentResources.group.name = groupName;
  }

  get group(): THREE.Group {
    return this.currentResources.group;
  }

  get resources(): CrowdResources {
    return this.currentResources;
  }

  rebuild(requestedCount: number, groupName = this.currentResources.group.name): CrowdResources {
    this.dispose();
    this.currentResources = createCrowdResources(requestedCount, {
      accentColors: this.accentColors,
      crowdFullness: this.crowdFullness,
      nearCount: this.nearCount,
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
