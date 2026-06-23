import * as THREE from 'three';
import {
  PLAYER_BACK_NUMBER_ANCHOR_NAME,
  PLAYER_FRONT_NUMBER_ANCHOR_NAME,
  PLAYER_HEAD_ANCHOR_NAME,
} from '../../playerVisual';

export interface PlayerAttachmentAnchors {
  backNumberAnchor: THREE.Object3D;
  frontNumberAnchor: THREE.Object3D;
  headAnchor: THREE.Object3D;
}

const BACK_NUMBER_OFFSET = new THREE.Vector3(0, -0.08, -0.32);
const FRONT_NUMBER_OFFSET = new THREE.Vector3(0, -0.08, 0.32);

export function createRiggedPlayerAttachmentAnchors(root: THREE.Object3D): PlayerAttachmentAnchors {
  const helmetSocket = findSocket(root, 'socket_helmet') ?? root;
  const shoulderSocket = findSocket(root, 'socket_shoulder_pads') ?? root;
  const headAnchor = ensureChildAnchor(
    helmetSocket,
    PLAYER_HEAD_ANCHOR_NAME,
    new THREE.Vector3(0, 0, 0),
  );
  const backNumberAnchor = ensureChildAnchor(
    shoulderSocket,
    PLAYER_BACK_NUMBER_ANCHOR_NAME,
    BACK_NUMBER_OFFSET,
  );
  backNumberAnchor.rotation.y = Math.PI;
  const frontNumberAnchor = ensureChildAnchor(
    shoulderSocket,
    PLAYER_FRONT_NUMBER_ANCHOR_NAME,
    FRONT_NUMBER_OFFSET,
  );
  frontNumberAnchor.rotation.y = 0;
  root.userData.riggedAttachmentSockets = {
    backNumber: shoulderSocket.name,
    frontNumber: shoulderSocket.name,
    helmet: helmetSocket.name,
  };

  return {
    backNumberAnchor,
    frontNumberAnchor,
    headAnchor,
  };
}

export function findSocket(root: THREE.Object3D, socketName: string): THREE.Object3D | null {
  return root.getObjectByName(socketName) ?? null;
}

function ensureChildAnchor(
  parent: THREE.Object3D,
  anchorName: string,
  position: THREE.Vector3,
): THREE.Object3D {
  const existing = parent.getObjectByName(anchorName);
  if (existing) {
    return existing;
  }

  const anchor = new THREE.Group();
  anchor.name = anchorName;
  anchor.position.copy(position);
  parent.add(anchor);
  return anchor;
}
