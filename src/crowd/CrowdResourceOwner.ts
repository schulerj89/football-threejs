import * as THREE from 'three';
import { createCrowdResources } from './CrowdMeshFactory';
import type { CrowdResources } from './CrowdTypes';

export class CrowdResourceOwner {
  private currentResources: CrowdResources;

  constructor(requestedCount: number, groupName: string) {
    this.currentResources = createCrowdResources(requestedCount);
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
    this.currentResources = createCrowdResources(requestedCount);
    this.currentResources.group.name = groupName;
    return this.currentResources;
  }

  enableDynamicInstanceMatrices(): void {
    const meshes = [
      this.currentResources.detailedTorso,
      this.currentResources.detailedHead,
      this.currentResources.detailedArmLeft,
      this.currentResources.detailedArmRight,
      this.currentResources.farBody,
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
