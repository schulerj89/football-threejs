import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ASSET_PATH = 'public/models/player/player-base-rigged.glb';
const MANIFEST_PATH = 'public/models/player/player-asset-manifest.json';
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a;
const GLB_MAGIC = 0x46546c67;

const EXPECTED_BONE_NAMES = [
  'Head',
  'Hips',
  'LeftArm',
  'LeftFoot',
  'LeftForeArm',
  'LeftHand',
  'LeftLeg',
  'LeftShoulder',
  'LeftToeBase',
  'LeftUpLeg',
  'RightArm',
  'RightFoot',
  'RightForeArm',
  'RightHand',
  'RightLeg',
  'RightShoulder',
  'RightToeBase',
  'RightUpLeg',
  'Spine',
  'Spine01',
  'Spine02',
  'head_end',
  'headfront',
  'neck',
] as const;

const REQUIRED_SOCKET_NAMES = [
  'socket_ball_carry',
  'socket_ball_throw',
  'socket_foot_l',
  'socket_foot_r',
  'socket_hair',
  'socket_hand_l',
  'socket_hand_r',
  'socket_head_accessory',
  'socket_helmet',
  'socket_shoulder_pads',
] as const;

const EXPECTED_MATERIAL_NAMES = [
  'mat_player_jersey',
  'mat_player_pants_socks',
  'mat_player_shoes',
  'mat_player_skin',
] as const;

interface VoxelPlayerManifest {
  animationCount: number;
  assetId: string;
  assetVersion: number;
  boneNames: string[];
  contentHashes: Record<string, string>;
  drawCallTarget: number;
  heightMeters: number;
  materialRegionNames: string[];
  orientation: { forward: string; up: string };
  roundedHead: {
    centerY: number;
    diameterMeters: number;
    helmetSocketY: number;
  };
  socketNames: string[];
  style: string;
  triangleCount: number;
}

interface GltfAccessor {
  count: number;
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

interface GltfNode {
  children?: number[];
  extras?: Record<string, unknown>;
  mesh?: number;
  name?: string;
  skin?: number;
}

interface GltfJson {
  accessors?: GltfAccessor[];
  animations?: unknown[];
  asset?: { version?: string };
  materials?: Array<{ name?: string }>;
  meshes?: Array<{ name?: string; primitives?: GltfPrimitive[] }>;
  nodes?: GltfNode[];
  skins?: Array<{ joints?: number[]; name?: string }>;
}

describe('voxel player runtime asset', () => {
  it('matches the committed manifest, rig, socket, and rendering-budget contract', () => {
    const assetBytes = readFileSync(ASSET_PATH);
    const manifest = JSON.parse(
      readFileSync(MANIFEST_PATH, 'utf8'),
    ) as VoxelPlayerManifest;
    const gltf = parseGlbJson(assetBytes);

    expect(manifest).toMatchObject({
      animationCount: 0,
      assetId: 'football-js-player-base',
      assetVersion: 1,
      drawCallTarget: 4,
      heightMeters: 1.85,
      orientation: { forward: '+Z', up: '+Y' },
      style: 'rigid-weighted voxel football player',
      triangleCount: 784,
    });
    expect(assetBytes.byteLength).toBeLessThanOrEqual(200 * 1024);
    expect(createHash('sha256').update(assetBytes).digest('hex')).toBe(
      manifest.contentHashes['player-base-rigged.glb'],
    );

    expect([...manifest.materialRegionNames].sort()).toEqual(
      [...EXPECTED_MATERIAL_NAMES].sort(),
    );
    expect(manifest.materialRegionNames).toHaveLength(4);
    expect(manifest.drawCallTarget).toBeLessThanOrEqual(4);
    expect(manifest.boneNames).toHaveLength(34);
    expect(manifest.boneNames).toEqual(
      [...EXPECTED_BONE_NAMES, ...REQUIRED_SOCKET_NAMES].sort(),
    );
    expect(manifest.socketNames).toEqual(REQUIRED_SOCKET_NAMES);
    expect(manifest.roundedHead).toEqual({
      centerY: 1.695,
      diameterMeters: 0.31,
      helmetSocketY: 1.84,
    });
    expect(manifest.roundedHead.helmetSocketY).toBeGreaterThan(
      manifest.roundedHead.centerY,
    );

    expect(gltf.asset?.version).toBe('2.0');
    expect(gltf.animations ?? []).toHaveLength(0);
    expect(gltf.materials?.map((material) => material.name)).toEqual(
      EXPECTED_MATERIAL_NAMES,
    );
    expect(gltf.meshes).toHaveLength(4);

    const primitives = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
    expect(primitives).toHaveLength(4);
    expect(new Set(primitives.map((primitive) => primitive.material)).size).toBe(4);
    for (const primitive of primitives) {
      expect(primitive.mode ?? 4).toBe(4);
      expect(primitive.attributes).toHaveProperty('JOINTS_0');
      expect(primitive.attributes).toHaveProperty('WEIGHTS_0');
    }
    expect(countTriangles(gltf, primitives)).toBe(784);

    const nodes = gltf.nodes ?? [];
    const nodeNames = nodes.map((node) => node.name).filter(isString);
    expect(nodeNames).toEqual(expect.arrayContaining([
      'football_player_rig',
      ...EXPECTED_BONE_NAMES,
      ...REQUIRED_SOCKET_NAMES,
    ]));
    const skinnedMeshNodes = nodes.filter((node) => node.mesh !== undefined);
    expect(skinnedMeshNodes).toHaveLength(4);
    expect(skinnedMeshNodes.every((node) => node.skin === 0)).toBe(true);
    expect(skinnedMeshNodes.map((node) => node.extras?.material_region)).toEqual(
      EXPECTED_MATERIAL_NAMES,
    );

    expect(gltf.skins).toHaveLength(1);
    const skin = gltf.skins?.[0];
    expect(skin?.name).toBe('football_player_rig');
    expect(skin?.joints).toHaveLength(34);
    const jointNames = (skin?.joints ?? []).map((index) => nodes[index]?.name).filter(isString);
    expect([...jointNames].sort()).toEqual(manifest.boneNames);

    const helmetSocketIndex = nodes.findIndex((node) => node.name === 'socket_helmet');
    const headIndex = nodes.findIndex((node) => node.name === 'Head');
    expect(helmetSocketIndex).toBeGreaterThanOrEqual(0);
    expect(headIndex).toBeGreaterThanOrEqual(0);
    expect(nodes[headIndex]?.children).toContain(helmetSocketIndex);
  });
});

function parseGlbJson(buffer: Buffer): GltfJson {
  expect(buffer.readUInt32LE(0)).toBe(GLB_MAGIC);
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.byteLength);

  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    expect(chunkEnd).toBeLessThanOrEqual(buffer.byteLength);

    if (chunkType === GLB_JSON_CHUNK_TYPE) {
      const json = buffer.toString('utf8', chunkStart, chunkEnd).replace(/\u0000+$/, '').trimEnd();
      return JSON.parse(json) as GltfJson;
    }
    offset = chunkEnd;
  }

  throw new Error('Voxel player GLB is missing its JSON chunk.');
}

function countTriangles(gltf: GltfJson, primitives: GltfPrimitive[]): number {
  return primitives.reduce((total, primitive) => {
    if (primitive.indices === undefined) {
      throw new Error('Voxel player primitive must use indexed geometry.');
    }
    const indexCount = gltf.accessors?.[primitive.indices]?.count;
    if (indexCount === undefined || indexCount % 3 !== 0) {
      throw new Error('Voxel player primitive has an invalid triangle index accessor.');
    }
    return total + indexCount / 3;
  }, 0);
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string';
}
