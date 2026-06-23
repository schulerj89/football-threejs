import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  HELMET_COMBINED_RUNTIME_PATH,
  HELMET_FACEGUARD_RUNTIME_PATH,
  HELMET_GENERATED_DIR,
  HELMET_MANIFEST_RUNTIME_PATH,
  HELMET_METADATA_DIR,
  HELMET_SHELL_RUNTIME_PATH,
  getFileHash,
  hashBytes,
  isDirectCli,
  normalizePathForManifest,
  resolveRepoPath,
  writeJsonFile,
} from './schemas';

type Vec3 = readonly [number, number, number];

interface PreparedMesh {
  readonly indices: Uint32Array;
  readonly materialIndex: number;
  readonly name: string;
  readonly normals: Float32Array;
  readonly positions: Float32Array;
}

interface CandidateMesh {
  readonly indices: number[];
  readonly normals: Vec3[];
  readonly positions: Vec3[];
}

interface ComponentStats {
  readonly id: number;
  readonly indices: readonly number[];
  readonly max: Vec3;
  readonly min: Vec3;
  readonly size: Vec3;
  readonly center: Vec3;
  readonly triangleCount: number;
  readonly vertexCount: number;
}

const SHELL_NAME = 'helmet_shell';
const FACEGUARD_NAME = 'faceguard_standard';
const SHELL_MATERIAL = 'mat_helmet_shell';
const FACEGUARD_MATERIAL = 'mat_faceguard';

export interface NodeHelmetPrepareOptions {
  readonly candidateId: string;
  readonly force: boolean;
}

export function prepareHelmetWithNode(options: NodeHelmetPrepareOptions): void {
  const candidatePath = `${HELMET_GENERATED_DIR}/${options.candidateId}.glb`;
  const mesh = readCandidateMesh(candidatePath);
  const components = findComponents(mesh);
  const usefulComponents = components.filter((component) => component.vertexCount >= 8 && component.triangleCount >= 4);
  const faceguardComponentIds = new Set(
    usefulComponents
      .filter(isLikelyFaceguardComponent)
      .map((component) => component.id),
  );
  const shellComponentIds = new Set(
    usefulComponents
      .filter((component) => !faceguardComponentIds.has(component.id))
      .map((component) => component.id),
  );

  if (faceguardComponentIds.size === 0 || shellComponentIds.size === 0) {
    throw new Error('Unable to split Meshy candidate into shell and faceguard components.');
  }

  const shell = createPreparedMesh(mesh, components, shellComponentIds, SHELL_NAME, 0);
  const faceguard = createPreparedMesh(mesh, components, faceguardComponentIds, FACEGUARD_NAME, 1);
  const totalTriangles = shell.indices.length / 3 + faceguard.indices.length / 3;

  if (totalTriangles > 8500) {
    throw new Error(`Prepared helmet exceeds triangle budget: ${totalTriangles}`);
  }

  writeGlb(HELMET_COMBINED_RUNTIME_PATH, [shell, faceguard], true);
  writeGlb(HELMET_SHELL_RUNTIME_PATH, [shell], false);
  writeGlb(HELMET_FACEGUARD_RUNTIME_PATH, [faceguard], false);
  const bounds = calculateBounds([shell, faceguard]);
  const manifest = {
    assetId: 'football-helmet-kit',
    assetVersion: 1,
    bounds,
    contentHashes: {
      combined: getFileHash(HELMET_COMBINED_RUNTIME_PATH),
      faceguard: getFileHash(HELMET_FACEGUARD_RUNTIME_PATH),
      shell: getFileHash(HELMET_SHELL_RUNTIME_PATH),
    },
    faceguardTriangles: faceguard.indices.length / 3,
    generationPrompt: 'GPT Image 2 four-view modular helmet references submitted to Meshy Multi-Image-to-3D.',
    materialNames: [SHELL_MATERIAL, FACEGUARD_MATERIAL],
    meshNames: [SHELL_NAME, FACEGUARD_NAME],
    meshyTaskId: readTaskId(options.candidateId),
    origin: { x: 0, y: 0, z: 0 },
    orientation: { forward: '+Z', up: '+Y' },
    preparationTimestamp: new Date().toISOString(),
    recommendedHeadAnchorOffset: { x: 0, y: 0, z: 0 },
    recommendedScale: 1,
    shellTriangles: shell.indices.length / 3,
    sourceCandidate: options.candidateId,
    totalTriangles,
    vertexCounts: {
      [FACEGUARD_NAME]: faceguard.positions.length / 3,
      [SHELL_NAME]: shell.positions.length / 3,
    },
  };
  writeJsonFile(resolveRepoPath(HELMET_MANIFEST_RUNTIME_PATH), manifest);
  writeJsonFile(resolveRepoPath(`${HELMET_METADATA_DIR}/${options.candidateId}-node-preparation.json`), {
    candidatePath,
    componentCount: components.length,
    faceguardComponentCount: faceguardComponentIds.size,
    manifest,
    shellComponentCount: shellComponentIds.size,
  });
}

function readCandidateMesh(relativePath: string): CandidateMesh {
  const buffer = readFileSync(resolveRepoPath(relativePath));
  const { bin, json } = parseGlb(buffer);
  const primitive = json.meshes?.[0]?.primitives?.[0];
  if (!primitive) {
    throw new Error(`${relativePath} has no mesh primitive`);
  }
  return {
    indices: readScalarAccessor(json, bin, primitive.indices),
    normals: readVec3Accessor(json, bin, primitive.attributes.NORMAL),
    positions: readVec3Accessor(json, bin, primitive.attributes.POSITION),
  };
}

function findComponents(mesh: CandidateMesh): ComponentStats[] {
  const parent = Array.from({ length: mesh.positions.length }, (_, index) => index);
  const used = new Set<number>();

  for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
    const a = mesh.indices[index];
    const b = mesh.indices[index + 1];
    const c = mesh.indices[index + 2];
    used.add(a);
    used.add(b);
    used.add(c);
    union(parent, a, b);
    union(parent, b, c);
  }

  const groups = new Map<number, number[]>();
  for (const vertexIndex of used) {
    const root = find(parent, vertexIndex);
    groups.set(root, [...(groups.get(root) ?? []), vertexIndex]);
  }

  const vertexToComponent = new Map<number, number>();
  let id = 0;
  for (const vertices of groups.values()) {
    for (const vertex of vertices) {
      vertexToComponent.set(vertex, id);
    }
    id += 1;
  }

  const trianglesByComponent = new Map<number, number[]>();
  for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
    const componentId = vertexToComponent.get(mesh.indices[index]);
    if (componentId === undefined) {
      continue;
    }
    const indices = trianglesByComponent.get(componentId) ?? [];
    indices.push(mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]);
    trianglesByComponent.set(componentId, indices);
  }

  return [...groups.values()].map((vertices, componentId) => {
    const bounds = calculateVertexBounds(mesh.positions, vertices);
    return {
      id: componentId,
      indices: trianglesByComponent.get(componentId) ?? [],
      max: bounds.max,
      min: bounds.min,
      size: [
        bounds.max[0] - bounds.min[0],
        bounds.max[1] - bounds.min[1],
        bounds.max[2] - bounds.min[2],
      ],
      center: [
        (bounds.max[0] + bounds.min[0]) / 2,
        (bounds.max[1] + bounds.min[1]) / 2,
        (bounds.max[2] + bounds.min[2]) / 2,
      ],
      triangleCount: Math.floor((trianglesByComponent.get(componentId)?.length ?? 0) / 3),
      vertexCount: vertices.length,
    };
  });
}

function isLikelyFaceguardComponent(component: ComponentStats): boolean {
  const maxSize = Math.max(...component.size);
  const minSize = Math.min(...component.size);
  const thinRatio = minSize / Math.max(maxSize, 0.0001);
  const lowOrMidFace = component.center[1] < 0.75;
  const nearFaceOpening = component.center[2] < 0.75;
  const barLike = thinRatio < 0.28 || component.size[0] < 0.16 || component.size[2] < 0.16;
  const notBroadShellPlate =
    !(component.size[0] > 0.9 && component.size[1] > 0.8 && component.size[2] > 0.3);

  return lowOrMidFace && nearFaceOpening && barLike && notBroadShellPlate;
}

function createPreparedMesh(
  source: CandidateMesh,
  components: readonly ComponentStats[],
  componentIds: ReadonlySet<number>,
  name: string,
  materialIndex: number,
): PreparedMesh {
  const vertexMap = new Map<number, number>();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const component of components) {
    if (!componentIds.has(component.id)) {
      continue;
    }
    for (const sourceIndex of component.indices) {
      let targetIndex = vertexMap.get(sourceIndex);
      if (targetIndex === undefined) {
        targetIndex = vertexMap.size;
        vertexMap.set(sourceIndex, targetIndex);
        positions.push(...source.positions[sourceIndex]);
        normals.push(...(source.normals[sourceIndex] ?? [0, 1, 0]));
      }
      indices.push(targetIndex);
    }
  }

  return {
    indices: Uint32Array.from(indices),
    materialIndex,
    name,
    normals: Float32Array.from(normals),
    positions: Float32Array.from(positions),
  };
}

function writeGlb(relativePath: string, meshes: readonly PreparedMesh[], includeRoot: boolean): void {
  const buffers: Buffer[] = [];
  const bufferViews: unknown[] = [];
  const accessors: unknown[] = [];
  const gltfMeshes: unknown[] = [];
  const nodes: unknown[] = [];
  const usedMaterialIndices = [...new Set(meshes.map((mesh) => mesh.materialIndex))].sort();
  const materialRemap = new Map(
    usedMaterialIndices.map((materialIndex, remappedIndex) => [materialIndex, remappedIndex]),
  );
  let byteOffset = 0;

  for (const mesh of meshes) {
    const positionBuffer = Buffer.from(mesh.positions.buffer.slice(0));
    const normalBuffer = Buffer.from(mesh.normals.buffer.slice(0));
    const indexBuffer = Buffer.from(mesh.indices.buffer.slice(0));
    const positionView = pushBufferView(bufferViews, buffers, positionBuffer, byteOffset, 34962);
    byteOffset += align4(positionBuffer.length);
    const normalView = pushBufferView(bufferViews, buffers, normalBuffer, byteOffset, 34962);
    byteOffset += align4(normalBuffer.length);
    const indexView = pushBufferView(bufferViews, buffers, indexBuffer, byteOffset, 34963);
    byteOffset += align4(indexBuffer.length);
    const bounds = calculateArrayBounds(mesh.positions);
    const positionAccessor = accessors.push({
      bufferView: positionView,
      componentType: 5126,
      count: mesh.positions.length / 3,
      max: bounds.max,
      min: bounds.min,
      type: 'VEC3',
    }) - 1;
    const normalAccessor = accessors.push({
      bufferView: normalView,
      componentType: 5126,
      count: mesh.normals.length / 3,
      type: 'VEC3',
    }) - 1;
    const indexAccessor = accessors.push({
      bufferView: indexView,
      componentType: 5125,
      count: mesh.indices.length,
      type: 'SCALAR',
    }) - 1;
    const meshIndex = gltfMeshes.push({
      name: mesh.name,
      primitives: [
        {
          attributes: {
            NORMAL: normalAccessor,
            POSITION: positionAccessor,
          },
          indices: indexAccessor,
          material: materialRemap.get(mesh.materialIndex) ?? 0,
        },
      ],
    }) - 1;
    nodes.push({
      mesh: meshIndex,
      name: mesh.name,
    });
  }

  if (includeRoot) {
    nodes.unshift({
      children: meshes.map((_, index) => index + 1),
      name: 'footballHelmetRoot',
    });
  }

  const bin = Buffer.concat(buffers);
  const json = {
    asset: {
      generator: 'Football JS Meshy modular helmet pipeline',
      version: '2.0',
    },
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
    materials: usedMaterialIndices.map((materialIndex) => materialIndex === 0
      ? createMaterial(SHELL_MATERIAL, [0.93, 0.93, 0.9, 1])
      : createMaterial(FACEGUARD_MATERIAL, [0.12, 0.13, 0.14, 1])),
    meshes: gltfMeshes,
    nodes,
    scene: 0,
    scenes: [{ nodes: [0] }],
  };
  const jsonBuffer = padBuffer(Buffer.from(JSON.stringify(json)), 0x20);
  const binBuffer = padBuffer(bin, 0);
  const header = Buffer.alloc(12);
  header.write('glTF', 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuffer.length + 8 + binBuffer.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.write('JSON', 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.write('BIN\0', 4);
  const glb = Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer]);
  const absolutePath = resolveRepoPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, glb);
}

function pushBufferView(
  bufferViews: unknown[],
  buffers: Buffer[],
  buffer: Buffer,
  byteOffset: number,
  target: number,
): number {
  buffers.push(padBuffer(buffer, 0));
  return bufferViews.push({
    buffer: 0,
    byteLength: buffer.length,
    byteOffset,
    target,
  }) - 1;
}

function createMaterial(name: string, color: readonly number[]): unknown {
  return {
    name,
    pbrMetallicRoughness: {
      baseColorFactor: color,
      metallicFactor: 0.02,
      roughnessFactor: 0.68,
    },
  };
}

function parseGlb(buffer: Buffer<ArrayBufferLike>): { bin: Buffer<ArrayBufferLike>; json: any } {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Input is not a GLB file');
  }
  let offset = 12;
  let json: any = null;
  let bin: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    offset += 4;
    const chunkType = buffer.toString('utf8', offset, offset + 4);
    offset += 4;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;
    if (chunkType === 'JSON') {
      json = JSON.parse(chunk.toString('utf8').trim());
    } else if (chunkType === 'BIN\0') {
      bin = chunk;
    }
  }
  return { bin, json };
}

function readVec3Accessor(json: any, bin: Buffer<ArrayBufferLike>, accessorIndex: number): Vec3[] {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const stride = view.byteStride ?? 12;
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const result: Vec3[] = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const base = offset + index * stride;
    result.push([bin.readFloatLE(base), bin.readFloatLE(base + 4), bin.readFloatLE(base + 8)]);
  }
  return result;
}

function readScalarAccessor(json: any, bin: Buffer<ArrayBufferLike>, accessorIndex: number): number[] {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const stride = view.byteStride ?? (accessor.componentType === 5125 ? 4 : 2);
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const result: number[] = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const base = offset + index * stride;
    result.push(accessor.componentType === 5125 ? bin.readUInt32LE(base) : bin.readUInt16LE(base));
  }
  return result;
}

function calculateVertexBounds(vertices: readonly Vec3[], indices: readonly number[]): { min: Vec3; max: Vec3 } {
  const min = [Infinity, Infinity, Infinity] as [number, number, number];
  const max = [-Infinity, -Infinity, -Infinity] as [number, number, number];
  for (const index of indices) {
    const vertex = vertices[index];
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], vertex[axis]);
      max[axis] = Math.max(max[axis], vertex[axis]);
    }
  }
  return { max, min };
}

function calculateArrayBounds(values: Float32Array): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index + 2 < values.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], values[index + axis]);
      max[axis] = Math.max(max[axis], values[index + axis]);
    }
  }
  return { max, min };
}

function calculateBounds(meshes: readonly PreparedMesh[]): unknown {
  const values = Float32Array.from(meshes.flatMap((mesh) => [...mesh.positions]));
  const bounds = calculateArrayBounds(values);
  return {
    max: { x: bounds.max[0], y: bounds.max[1], z: bounds.max[2] },
    min: { x: bounds.min[0], y: bounds.min[1], z: bounds.min[2] },
    size: {
      x: bounds.max[0] - bounds.min[0],
      y: bounds.max[1] - bounds.min[1],
      z: bounds.max[2] - bounds.min[2],
    },
  };
}

function union(parent: number[], a: number, b: number): void {
  const rootA = find(parent, a);
  const rootB = find(parent, b);
  if (rootA !== rootB) {
    parent[rootB] = rootA;
  }
}

function find(parent: number[], value: number): number {
  let current = value;
  while (parent[current] !== current) {
    parent[current] = parent[parent[current]];
    current = parent[current];
  }
  return current;
}

function align4(value: number): number {
  return Math.ceil(value / 4) * 4;
}

function padBuffer(buffer: Buffer, padByte: number): Buffer {
  const paddedLength = align4(buffer.length);
  if (paddedLength === buffer.length) {
    return buffer;
  }
  return Buffer.concat([buffer, Buffer.alloc(paddedLength - buffer.length, padByte)]);
}

function readTaskId(candidateId: string): string | null {
  try {
    const metadata = JSON.parse(
      readFileSync(resolveRepoPath(`${HELMET_METADATA_DIR}/${candidateId}-meshy-task.json`), 'utf8'),
    ) as { taskId?: string };
    return metadata.taskId ?? null;
  } catch {
    return null;
  }
}

if (isDirectCli(import.meta.url)) {
  const candidateArg = process.argv.find((arg) => arg.startsWith('--candidate='));
  const candidateId = candidateArg ? candidateArg.slice('--candidate='.length) : 'candidate-a';
  prepareHelmetWithNode({ candidateId, force: process.argv.includes('--force') });
  console.log(
    JSON.stringify(
      {
        candidateId,
        outputs: [
          normalizePathForManifest(HELMET_COMBINED_RUNTIME_PATH),
          normalizePathForManifest(HELMET_SHELL_RUNTIME_PATH),
          normalizePathForManifest(HELMET_FACEGUARD_RUNTIME_PATH),
          normalizePathForManifest(HELMET_MANIFEST_RUNTIME_PATH),
        ],
      },
      null,
      2,
    ),
  );
}
