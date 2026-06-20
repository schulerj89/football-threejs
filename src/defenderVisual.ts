import * as THREE from 'three';
import type { DefenderModel } from './defenderModel';

const DEFENDER_CENTER_Y = 1.05;

export function createDefenderVisual(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'placeholder-defender';

  const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xb83737 });
  const facingMaterial = new THREE.MeshBasicMaterial({ color: 0x1f1111 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 1.5), bodyMaterial);
  body.name = 'placeholder-defender-body';
  group.add(body);

  const facingStripe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.08), facingMaterial);
  facingStripe.position.set(0, 0.35, 0.78);
  facingStripe.name = 'placeholder-defender-facing-stripe';
  group.add(facingStripe);

  return group;
}

export function syncDefenderVisual(defenderVisual: THREE.Object3D, defenderModel: DefenderModel): void {
  defenderVisual.position.set(defenderModel.position.x, DEFENDER_CENTER_Y, defenderModel.position.z);
  defenderVisual.rotation.y = defenderModel.facingRadians;
}
