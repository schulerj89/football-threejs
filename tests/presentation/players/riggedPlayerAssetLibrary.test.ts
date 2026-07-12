import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cloneRiggedPlayerTemplate,
  resetRiggedPlayerAssetLibraryForTest,
  setRiggedPlayerTemplateForTest,
} from '../../../src/presentation/players/RiggedPlayerAssetLibrary';

describe('RiggedPlayerAssetLibrary skeleton cloning', () => {
  afterEach(() => {
    resetRiggedPlayerAssetLibraryForTest();
  });

  it('shares one compatible skeleton across body meshes inside each clone only', async () => {
    const template = await loadVoxelPlayerTemplate();
    const expectedBindMatrices = collectSkinnedMeshes(template).map((mesh) => (
      mesh.bindMatrix.toArray()
    ));
    setRiggedPlayerTemplateForTest(template);

    const first = cloneRiggedPlayerTemplate('first-rigged-player');
    const second = cloneRiggedPlayerTemplate('second-rigged-player');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const firstMeshes = collectSkinnedMeshes(first!);
    const secondMeshes = collectSkinnedMeshes(second!);
    const firstSkeletonUuids = new Set(firstMeshes.map((mesh) => mesh.skeleton.uuid));
    const secondSkeletonUuids = new Set(secondMeshes.map((mesh) => mesh.skeleton.uuid));

    expect(firstMeshes).toHaveLength(4);
    expect(secondMeshes).toHaveLength(4);
    expect(firstSkeletonUuids.size).toBe(1);
    expect(secondSkeletonUuids.size).toBe(1);
    expect(firstSkeletonUuids).not.toEqual(secondSkeletonUuids);
    expect(firstMeshes[0].skeleton).not.toBe(secondMeshes[0].skeleton);
    expect(firstMeshes.map((mesh) => mesh.bindMatrix.toArray())).toEqual(expectedBindMatrices);
    expect(secondMeshes.map((mesh) => mesh.bindMatrix.toArray())).toEqual(expectedBindMatrices);

    const secondPlayerBoneRotation = secondMeshes[0].skeleton.bones[1].rotation.x;
    firstMeshes[0].skeleton.bones[1].rotation.x += 0.42;
    expect(firstMeshes[3].skeleton.bones[1].rotation.x).toBeCloseTo(
      firstMeshes[0].skeleton.bones[1].rotation.x,
    );
    expect(secondMeshes[0].skeleton.bones[1].rotation.x).toBeCloseTo(
      secondPlayerBoneRotation,
    );

    computeBoneTextures(firstMeshes);
    computeBoneTextures(secondMeshes);
    expect(new Set(firstMeshes.map((mesh) => mesh.skeleton.boneTexture?.uuid)).size).toBe(1);
    expect(firstMeshes[0].skeleton.boneTexture).not.toBe(
      secondMeshes[0].skeleton.boneTexture,
    );
    firstMeshes[0].skeleton.dispose();
    secondMeshes[0].skeleton.dispose();
  });

  it('keeps skeletons separate when inverse bind data differs', () => {
    const template = createMultiMeshRiggedTemplate();
    const sourceMeshes = collectSkinnedMeshes(template);
    sourceMeshes[3].skeleton.boneInverses[1].makeTranslation(0, 0.25, 0);
    setRiggedPlayerTemplateForTest(template);

    const clone = cloneRiggedPlayerTemplate();

    expect(clone).not.toBeNull();
    const skeletonUuids = new Set(
      collectSkinnedMeshes(clone!).map((mesh) => mesh.skeleton.uuid),
    );
    expect(skeletonUuids.size).toBe(2);
  });
});

async function loadVoxelPlayerTemplate(): Promise<THREE.Group> {
  const bytes = readFileSync('public/models/player/player-base-rigged.glb');
  const data = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return await new Promise((resolve, reject) => {
    new GLTFLoader().parse(data, '', (gltf) => resolve(gltf.scene), reject);
  });
}

function computeBoneTextures(meshes: THREE.SkinnedMesh[]): void {
  for (const mesh of meshes) {
    if (!mesh.skeleton.boneTexture) {
      mesh.skeleton.computeBoneTexture();
    }
  }
}

function createMultiMeshRiggedTemplate(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'multi-mesh-rigged-template';

  const hips = new THREE.Bone();
  hips.name = 'hips';
  const head = new THREE.Bone();
  head.name = 'head';
  head.position.y = 1.58;
  hips.add(head);
  root.add(hips);
  root.updateMatrixWorld(true);

  for (let index = 0; index < 4; index += 1) {
    const geometry = createSkinnedGeometry();
    const material = new THREE.MeshBasicMaterial();
    material.name = `mat_player_region_${index}`;
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = `player_region_${index}`;
    const skeleton = new THREE.Skeleton(
      [hips, head],
      [new THREE.Matrix4(), new THREE.Matrix4().makeTranslation(0, -1.58, 0)],
    );
    const bindMatrix = new THREE.Matrix4().makeTranslation(index * 0.01, 0, 0);
    mesh.bind(skeleton, bindMatrix);
    root.add(mesh);
  }

  return root;
}

function createSkinnedGeometry(): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(0.5, 1, 0.3);
  const vertexCount = geometry.getAttribute('position').count;
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices.push(0, 0, 0, 0);
    skinWeights.push(1, 0, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  return geometry;
}

function collectSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) {
      meshes.push(object);
    }
  });
  return meshes;
}
