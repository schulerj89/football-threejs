import * as THREE from 'three';
import type { PlayerModel } from './playerModel';

const PLAYER_CENTER_Y = 1.1;

export function createPlaceholderPlayerVisual(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'placeholder-player';
  group.userData.testId = 'placeholder-player';

  const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x2f66d8 });
  const facingMaterial = new THREE.MeshBasicMaterial({ color: 0xf3f5f8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.4), bodyMaterial);
  body.name = 'placeholder-player-body';
  group.add(body);

  const facingStripe = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.08), facingMaterial);
  facingStripe.position.set(0, 0.35, 0.74);
  facingStripe.name = 'placeholder-player-facing-stripe';
  group.add(facingStripe);

  const scaleReference = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 1.9), facingMaterial);
  scaleReference.position.set(0, -1.14, 0);
  scaleReference.name = 'placeholder-player-scale-reference';
  group.add(scaleReference);

  return group;
}

export function syncPlayerVisual(playerVisual: THREE.Object3D, playerModel: PlayerModel): void {
  playerVisual.position.set(playerModel.position.x, PLAYER_CENTER_Y, playerModel.position.z);
  playerVisual.rotation.y = playerModel.facingRadians;
}

