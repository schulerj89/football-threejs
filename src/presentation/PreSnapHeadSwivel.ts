import * as THREE from 'three';
import type { PreSnapCadenceSnapshot } from '../gameplay/PreSnapCadenceModel';
import { PLAYER_HEAD_ANCHOR_NAME } from '../playerVisual';

export const PRE_SNAP_HEAD_SWIVEL_QB_ID = 'offense-qb';

export function syncPreSnapQuarterbackHeadYaw(
  playerVisuals: Map<string, THREE.Object3D>,
  preSnapCadence: PreSnapCadenceSnapshot | null,
): void {
  const quarterback = playerVisuals.get(PRE_SNAP_HEAD_SWIVEL_QB_ID);
  const headAnchor = quarterback?.getObjectByName(PLAYER_HEAD_ANCHOR_NAME) ?? null;

  if (!headAnchor) {
    return;
  }

  headAnchor.rotation.y = preSnapCadence?.headYawRadians ?? 0;
}
