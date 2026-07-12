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

  const headYaw = preSnapCadence?.headYawRadians ?? 0;
  const riggedHead = quarterback?.getObjectByName('Head');
  if (riggedHead instanceof THREE.Bone) {
    const restYaw = resolveRiggedHeadRestYaw(riggedHead);
    riggedHead.rotation.y = restYaw + headYaw;
    // The helmet anchor is already a descendant of the Head bone through
    // socket_helmet, so leaving this local rotation neutral keeps the skinned
    // head and the original helmet moving as one unit.
    headAnchor.rotation.y = 0;
    return;
  }

  headAnchor.rotation.y = headYaw;
}

function resolveRiggedHeadRestYaw(head: THREE.Bone): number {
  if (typeof head.userData.preSnapRestYaw !== 'number') {
    head.userData.preSnapRestYaw = head.rotation.y;
  }
  return head.userData.preSnapRestYaw as number;
}
