import * as THREE from 'three';
import type { BallModel } from './ballModel';

export function createBallVisual(): THREE.Mesh {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0x7a3f20 }),
  );
  ball.name = 'football-ball';
  ball.visible = false;

  return ball;
}

export function syncBallVisual(ballVisual: THREE.Object3D, ballModel: BallModel): void {
  ballVisual.visible = ballModel.possession.kind === 'player';
  ballVisual.position.set(ballModel.position.x, ballModel.position.y, ballModel.position.z);
}
