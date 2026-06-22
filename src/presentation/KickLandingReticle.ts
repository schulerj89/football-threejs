import * as THREE from 'three';
import type { KickoffResult } from '../specialTeams/KickoffTypes';

export interface KickLandingReticle {
  dispose: () => void;
  group: THREE.Group;
  sync: (result: KickoffResult | null, visible: boolean) => void;
}

const RETICLE_CONFIG = {
  centerColor: 0xf7f2c1,
  height: 0.055,
  opacity: 0.72,
  ringSegments: 56,
} as const;

export function createKickLandingReticle(): KickLandingReticle {
  const group = new THREE.Group();
  group.name = 'kick-landing-reticle';
  group.userData.kickoffPresentation = true;
  group.visible = false;

  const ringGeometry = new THREE.RingGeometry(0.92, 1, RETICLE_CONFIG.ringSegments);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: RETICLE_CONFIG.centerColor,
    depthWrite: false,
    opacity: RETICLE_CONFIG.opacity,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.name = 'kick-landing-reticle-uncertainty-ring';
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const centerGeometry = new THREE.CircleGeometry(0.28, 20);
  const centerMaterial = new THREE.MeshBasicMaterial({
    color: RETICLE_CONFIG.centerColor,
    depthWrite: false,
    opacity: 0.9,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  center.name = 'kick-landing-reticle-center';
  center.rotation.x = -Math.PI / 2;
  group.add(center);

  return {
    dispose: () => {
      ringGeometry.dispose();
      ringMaterial.dispose();
      centerGeometry.dispose();
      centerMaterial.dispose();
      group.clear();
    },
    group,
    sync: (result, visible) => {
      group.visible = visible && !!result;
      if (!result) {
        return;
      }
      group.position.set(result.target.x, RETICLE_CONFIG.height, result.target.z);
      ring.scale.setScalar(Math.max(0.1, result.uncertaintyRadiusYards));
    },
  };
}
