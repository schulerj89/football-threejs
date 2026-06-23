import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  FOOTBALL_PLAYER_CANDIDATE_PLAN,
  FOOTBALL_PLAYER_REFERENCE_PLAN,
} from './playerGenerationPlan';
import {
  PLAYER_ASSET_REPORT_PATH,
  PLAYER_VIEWER_PATH,
  getFileHash,
  getFileSize,
  isDirectCli,
  normalizePathForManifest,
  resolveRepoPath,
  validatePlayerPlan,
  writeJsonFile,
} from './schemas';

type GltfAccessorType = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';

interface GltfJson {
  readonly accessors?: GltfAccessor[];
  readonly animations?: Array<{ name?: string }>;
  buffers?: Array<{ byteLength: number }>;
  readonly bufferViews?: GltfBufferView[];
  readonly images?: GltfImage[];
  readonly materials?: Array<{ name?: string }>;
  readonly meshes?: GltfMesh[];
  readonly nodes?: GltfNode[];
  readonly skins?: GltfSkin[];
  readonly textures?: Array<{ source?: number }>;
}

interface GltfAccessor {
  readonly bufferView?: number;
  readonly byteOffset?: number;
  readonly componentType: number;
  readonly count: number;
  readonly max?: number[];
  readonly min?: number[];
  readonly type: GltfAccessorType;
}

interface GltfBufferView {
  byteLength: number;
  byteOffset?: number;
  readonly byteStride?: number;
}

interface GltfImage {
  readonly bufferView?: number;
  readonly mimeType?: string;
  readonly name?: string;
  readonly uri?: string;
}

interface GltfMesh {
  readonly name?: string;
  readonly primitives?: GltfPrimitive[];
}

interface GltfNode {
  readonly children?: number[];
  readonly mesh?: number;
  readonly name?: string;
  readonly skin?: number;
}

interface GltfPrimitive {
  readonly attributes?: Record<string, number>;
  readonly indices?: number;
  readonly material?: number;
}

interface GltfSkin {
  readonly joints?: number[];
  readonly name?: string;
  readonly skeleton?: number;
}

interface ParsedGlb {
  readonly bin: Buffer;
  readonly json: GltfJson;
}

export interface PlayerTextureAudit {
  readonly height: number | null;
  readonly imageIndex: number;
  readonly mimeType: string | null;
  readonly name: string;
  readonly uri: string | null;
  readonly width: number | null;
}

export interface PlayerGlbAudit {
  readonly animationClipCount: number;
  readonly animationClipNames: readonly string[];
  readonly armatureExists: boolean;
  readonly boneCount: number;
  readonly boneNames: readonly string[];
  readonly boundingBox: {
    readonly height: number;
    readonly max: readonly [number, number, number];
    readonly min: readonly [number, number, number];
  };
  readonly connectedComponentCount: number;
  readonly forwardAxis: '+Z' | 'unknown';
  readonly groundOrigin: {
    readonly minY: number;
    readonly status: 'grounded' | 'aboveOrigin' | 'belowOrigin';
  };
  readonly materialCount: number;
  readonly materialNames: readonly string[];
  readonly meshCount: number;
  readonly meshNames: readonly string[];
  readonly nodeNames: readonly string[];
  readonly path: string;
  readonly textureDimensions: readonly PlayerTextureAudit[];
  readonly triangleCount: number;
  readonly vertexCount: number;
}

export interface PlayerCandidateValidation {
  readonly failures: readonly string[];
  readonly passed: boolean;
}

export interface PlayerAssetReport {
  readonly candidates: readonly {
    readonly assetId: string;
    readonly animationPaths: readonly string[];
    readonly consumedCredits: {
      readonly generation: number | null;
      readonly rigging: number | null;
    };
    readonly contentHashes: {
      readonly generatedGlb: string | null;
      readonly riggedFbx: string | null;
      readonly riggedGlb: string | null;
    };
    readonly generated: PlayerGlbAudit | null;
    readonly generatedValidation: PlayerCandidateValidation | null;
    readonly rigged: PlayerGlbAudit | null;
    readonly riggedFbxExists: boolean;
    readonly riggedValidation: PlayerCandidateValidation | null;
    readonly taskIds: {
      readonly generation: string | null;
      readonly rigging: string | null;
    };
    readonly thumbnailPaths: readonly string[];
  }[];
  readonly generatedAt: string;
  readonly planValidationErrors: readonly string[];
  readonly referenceImages: readonly {
    readonly assetId: string;
    readonly candidateId: string;
    readonly contentHash: string | null;
    readonly exists: boolean;
    readonly outputPath: string;
    readonly provenanceExists: boolean;
    readonly view: string;
  }[];
  readonly viewerPath: string;
}

export function createPlayerAssetReport(): PlayerAssetReport {
  return {
    candidates: FOOTBALL_PLAYER_CANDIDATE_PLAN.map((candidate) => {
      const generated = existsSync(resolveRepoPath(candidate.outputPath))
        ? auditPlayerGlbAsset(candidate.outputPath)
        : null;
      const rigged = existsSync(resolveRepoPath(candidate.riggedGlbOutputPath))
        ? auditPlayerGlbAsset(candidate.riggedGlbOutputPath)
        : null;
      const generationTask = readOptionalJson<Record<string, unknown>>(`${candidate.assetId}-meshy-task.json`);
      const generationDownload = readOptionalJson<Record<string, unknown>>(`${candidate.assetId}-download.json`);
      const riggingTask = readOptionalJson<Record<string, unknown>>(`${candidate.assetId}-rigging-task.json`);
      const riggingDownload = readOptionalJson<Record<string, unknown>>(`${candidate.assetId}-rigging-download.json`);
      return {
        animationPaths: readStringArray(riggingDownload?.animationPaths),
        assetId: candidate.assetId,
        consumedCredits: {
          generation: readNumber(generationDownload?.taskPayload, ['consumed_credits']) ??
            readNumber(generationTask, ['creditCost']),
          rigging: readNumber(riggingDownload?.taskPayload, ['consumed_credits']) ??
            readNumber(riggingTask, ['creditCost']),
        },
        contentHashes: {
          generatedGlb: readString(generationDownload, ['outputHash']) ??
            (generated ? getFileHash(candidate.outputPath) : null),
          riggedFbx: readString(riggingDownload, ['fbxOutputHash']),
          riggedGlb: readString(riggingDownload, ['glbOutputHash']) ??
            (rigged ? getFileHash(candidate.riggedGlbOutputPath) : null),
        },
        generated,
        generatedValidation: generated ? validateGeneratedPlayerAudit(generated) : null,
        rigged,
        riggedFbxExists: existsSync(resolveRepoPath(candidate.riggedFbxOutputPath)),
        riggedValidation: rigged ? validateRiggedPlayerAudit(rigged) : null,
        taskIds: {
          generation: readString(generationTask, ['taskId']),
          rigging: readString(riggingTask, ['taskId']),
        },
        thumbnailPaths: readStringArray(generationDownload?.thumbnailPaths),
      };
    }),
    generatedAt: new Date().toISOString(),
    planValidationErrors: validatePlayerPlan(
      FOOTBALL_PLAYER_REFERENCE_PLAN,
      FOOTBALL_PLAYER_CANDIDATE_PLAN,
    ),
    referenceImages: FOOTBALL_PLAYER_REFERENCE_PLAN.map((reference) => {
      const imageExists = existsSync(resolveRepoPath(reference.outputPath));
      return {
        assetId: reference.assetId,
        candidateId: reference.candidateId,
        contentHash: imageExists ? getFileHash(reference.outputPath) : null,
        exists: imageExists,
        outputPath: reference.outputPath,
        provenanceExists: existsSync(resolveRepoPath(`${reference.outputPath}.json`)),
        view: reference.view,
      };
    }),
    viewerPath: PLAYER_VIEWER_PATH,
  };
}

function readOptionalJson<T>(fileName: string): T | null {
  const path = resolveRepoPath(`art-source/meshy/player-base/metadata/${fileName}`);
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function readString(value: unknown, path: readonly string[]): string | null {
  const found = readPath(value, path);
  return typeof found === 'string' && found.trim().length > 0 ? found : null;
}

function readNumber(value: unknown, path: readonly string[]): number | null {
  const found = readPath(value, path);
  return typeof found === 'number' && Number.isFinite(found) ? found : null;
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function writePlayerAssetReportFiles(report: PlayerAssetReport): void {
  writeJsonFile(resolveRepoPath(PLAYER_ASSET_REPORT_PATH), report);
  writePlayerViewerHtml(report);
}

export function validateGeneratedPlayerCandidate(path: string): PlayerCandidateValidation {
  return validateGeneratedPlayerAudit(auditPlayerGlbAsset(path));
}

export function validateRiggedPlayerCandidate(path: string): PlayerCandidateValidation {
  return validateRiggedPlayerAudit(auditPlayerGlbAsset(path));
}

export function normalizePlayerGlbTextureBudget(path: string, maxTextureSize = 1024): PlayerTextureAudit[] {
  const parsed = parseGlb(path);
  const replacements = new Map<number, Buffer>();
  const textureAudits = readTextureDimensions(parsed);

  for (const texture of textureAudits) {
    if ((texture.width ?? 0) <= maxTextureSize && (texture.height ?? 0) <= maxTextureSize) {
      continue;
    }
    const image = parsed.json.images?.[texture.imageIndex];
    if (!image || image.bufferView === undefined) {
      continue;
    }
    const original = readImageBytes(parsed, image);
    if (!original) {
      continue;
    }
    const resized = resizeRasterWithPillow(original, image.mimeType ?? 'image/png', maxTextureSize);
    replacements.set(image.bufferView, resized);
  }

  if (replacements.size === 0) {
    return textureAudits;
  }

  writeGlbWithBufferViewReplacements(path, parsed, replacements);
  return readTextureDimensions(parseGlb(path));
}

export function validateGeneratedPlayerAudit(audit: PlayerGlbAudit): PlayerCandidateValidation {
  const failures = validateCommonPlayerAudit(audit);

  if (audit.connectedComponentCount <= 0) {
    failures.push('Generated GLB has no connected mesh components.');
  }

  return {
    failures,
    passed: failures.length === 0,
  };
}

export function validateRiggedPlayerAudit(audit: PlayerGlbAudit): PlayerCandidateValidation {
  const failures = validateCommonPlayerAudit(audit);
  if (!audit.armatureExists) {
    failures.push('Rigged GLB lacks a humanoid armature.');
  }
  if (audit.boneCount < 12) {
    failures.push(`Rigged GLB bone count ${audit.boneCount} is too low for a humanoid.`);
  }
  for (const requirement of [
    { label: 'head', pattern: /head/i },
    { label: 'left arm', pattern: /(left|_l|\.l).*(arm|hand|wrist)|\b(l|left).*upperarm/i },
    { label: 'right arm', pattern: /(right|_r|\.r).*(arm|hand|wrist)|\b(r|right).*upperarm/i },
    { label: 'left leg', pattern: /(left|_l|\.l).*(leg|foot|ankle)|\b(l|left).*(thigh|calf)/i },
    { label: 'right leg', pattern: /(right|_r|\.r).*(leg|foot|ankle)|\b(r|right).*(thigh|calf)/i },
  ]) {
    if (!audit.boneNames.some((name) => requirement.pattern.test(name))) {
      failures.push(`Rigged GLB lacks an identifiable ${requirement.label} bone.`);
    }
  }

  return {
    failures,
    passed: failures.length === 0,
  };
}

export function auditPlayerGlbAsset(path: string): PlayerGlbAudit {
  const parsed = parseGlb(path);
  const displayPath = isAbsolute(path) ? path : normalizePathForManifest(path);
  const materialNames = (parsed.json.materials ?? []).map((material, index) => material.name ?? `material-${index}`);
  const meshNames = (parsed.json.meshes ?? []).map((mesh, index) => mesh.name ?? `mesh-${index}`);
  const nodeNames = (parsed.json.nodes ?? []).map((node, index) => node.name ?? `node-${index}`);
  const boneIndexes = new Set((parsed.json.skins ?? []).flatMap((skin) => skin.joints ?? []));
  const boneNames = [...boneIndexes].map((index) => parsed.json.nodes?.[index]?.name ?? `bone-${index}`);
  const positions: Array<[number, number, number]> = [];
  let connectedComponentCount = 0;
  let triangleCount = 0;
  let vertexCount = 0;

  for (const mesh of parsed.json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const positionAccessor = readAccessor(parsed.json, primitive.attributes?.POSITION);
      if (positionAccessor) {
        vertexCount += positionAccessor.count;
        positions.push(...readVec3Accessor(parsed, positionAccessor));
      }
      const indices = primitive.indices === undefined
        ? createSequentialIndices(positionAccessor?.count ?? 0)
        : readScalarAccessor(parsed, primitive.indices);
      triangleCount += Math.floor(indices.length / 3);
      connectedComponentCount += countConnectedComponents(positionAccessor?.count ?? 0, indices);
    }
  }

  const boundingBox = calculateBoundingBox(positions);
  const minY = boundingBox.min[1];

  return {
    animationClipCount: parsed.json.animations?.length ?? 0,
    animationClipNames: (parsed.json.animations ?? []).map((animation, index) => animation.name ?? `animation-${index}`),
    armatureExists: (parsed.json.skins?.length ?? 0) > 0 && boneIndexes.size > 0,
    boneCount: boneIndexes.size,
    boneNames,
    boundingBox,
    connectedComponentCount,
    forwardAxis: (parsed.json.skins?.length ?? 0) > 0 ? '+Z' : 'unknown',
    groundOrigin: {
      minY,
      status: minY > 0.08 ? 'aboveOrigin' : minY < -0.08 ? 'belowOrigin' : 'grounded',
    },
    materialCount: materialNames.length,
    materialNames,
    meshCount: meshNames.length,
    meshNames,
    nodeNames,
    path: displayPath,
    textureDimensions: readTextureDimensions(parsed),
    triangleCount,
    vertexCount,
  };
}

function validateCommonPlayerAudit(audit: PlayerGlbAudit): string[] {
  const failures: string[] = [];
  if (audit.triangleCount <= 0 || audit.vertexCount <= 0) {
    failures.push('GLB contains no renderable triangles.');
  }
  if (audit.triangleCount > 14_000) {
    failures.push(`Triangle count ${audit.triangleCount} is more than twice the 7000 target.`);
  }
  if (audit.materialCount > 4) {
    failures.push(`Material count ${audit.materialCount} exceeds the four-material budget.`);
  }
  for (const texture of audit.textureDimensions) {
    if ((texture.width ?? 0) > 1024 || (texture.height ?? 0) > 1024) {
      failures.push(`Texture ${texture.name} is ${texture.width}x${texture.height}, above 1024x1024.`);
    }
  }
  if (audit.boundingBox.height < 1.2 || audit.boundingBox.height > 2.4) {
    failures.push(`Bounding-box height ${audit.boundingBox.height.toFixed(2)}m is outside the expected humanoid range.`);
  }
  if (audit.groundOrigin.status !== 'grounded') {
    failures.push(`Feet appear ${audit.groundOrigin.status}; minY=${audit.groundOrigin.minY.toFixed(3)}.`);
  }
  return failures;
}

function parseGlb(path: string): ParsedGlb {
  const buffer = readFileSync(isAbsolute(path) ? path : resolveRepoPath(path));
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error(`${path} is not a binary GLB file`);
  }

  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`${path} uses unsupported GLB version ${version}`);
  }

  const length = buffer.readUInt32LE(8);
  let offset = 12;
  let json: GltfJson | null = null;
  let bin = Buffer.alloc(0);

  while (offset < length) {
    const chunkLength = buffer.readUInt32LE(offset);
    offset += 4;
    const chunkType = buffer.toString('utf8', offset, offset + 4);
    offset += 4;
    const chunk = buffer.subarray(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === 'JSON') {
      json = JSON.parse(chunk.toString('utf8').trim()) as GltfJson;
    } else if (chunkType === 'BIN\u0000') {
      bin = chunk;
    }
  }

  if (!json) {
    throw new Error(`${path} does not include a JSON chunk`);
  }

  return { bin, json };
}

function writeGlbWithBufferViewReplacements(
  path: string,
  parsed: ParsedGlb,
  replacements: ReadonlyMap<number, Buffer>,
): void {
  const json = parsed.json;
  const views = json.bufferViews ?? [];
  const binParts: Buffer[] = [];
  let byteOffset = 0;

  for (const [index, view] of views.entries()) {
    const originalStart = view.byteOffset ?? 0;
    const original = parsed.bin.subarray(originalStart, originalStart + view.byteLength);
    const replacement = replacements.get(index) ?? original;
    view.byteOffset = byteOffset;
    view.byteLength = replacement.byteLength;
    binParts.push(replacement);
    byteOffset += replacement.byteLength;
    const padding = (4 - (byteOffset % 4)) % 4;
    if (padding > 0) {
      binParts.push(Buffer.alloc(padding));
      byteOffset += padding;
    }
  }

  if (json.buffers?.[0]) {
    json.buffers[0].byteLength = byteOffset;
  }

  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadding = (4 - (jsonBuffer.byteLength % 4)) % 4;
  const paddedJson = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
  const bin = Buffer.concat(binParts);
  const totalLength = 12 + 8 + paddedJson.byteLength + 8 + bin.byteLength;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 4, 'utf8');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.byteLength, 0);
  jsonHeader.write('JSON', 4, 4, 'utf8');
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.byteLength, 0);
  binHeader.write('BIN\u0000', 4, 4, 'utf8');
  writeFileSync(isAbsolute(path) ? path : resolveRepoPath(path), Buffer.concat([
    header,
    jsonHeader,
    paddedJson,
    binHeader,
    bin,
  ]));
}

function resizeRasterWithPillow(bytes: Buffer, mimeType: string, maxTextureSize: number): Buffer {
  const format = mimeType === 'image/jpeg' ? 'JPEG' : 'PNG';
  const script = [
    'import sys',
    'from io import BytesIO',
    'from PIL import Image',
    'data = sys.stdin.buffer.read()',
    'image = Image.open(BytesIO(data))',
    `image.thumbnail((${maxTextureSize}, ${maxTextureSize}), Image.Resampling.LANCZOS)`,
    'out = BytesIO()',
    `image.save(out, format="${format}")`,
    'sys.stdout.buffer.write(out.getvalue())',
  ].join('\n');
  const result = spawnSync('python', ['-c', script], {
    input: bytes,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Failed to resize embedded player texture: ${result.stderr.toString('utf8').trim()}`);
  }
  return result.stdout;
}

function readAccessor(json: GltfJson, accessorIndex: number | undefined): GltfAccessor | null {
  return accessorIndex === undefined ? null : json.accessors?.[accessorIndex] ?? null;
}

function readVec3Accessor(parsed: ParsedGlb, accessor: GltfAccessor): Array<[number, number, number]> {
  if (accessor.type !== 'VEC3') {
    return [];
  }
  if (accessor.min && accessor.max) {
    return [
      [accessor.min[0], accessor.min[1], accessor.min[2]],
      [accessor.max[0], accessor.max[1], accessor.max[2]],
    ];
  }
  const bufferView = accessor.bufferView === undefined ? null : parsed.json.bufferViews?.[accessor.bufferView];
  if (!bufferView || accessor.componentType !== 5126) {
    return [];
  }
  const stride = bufferView.byteStride ?? 12;
  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values: Array<[number, number, number]> = [];

  for (let index = 0; index < accessor.count; index += 1) {
    const offset = byteOffset + index * stride;
    values.push([
      parsed.bin.readFloatLE(offset),
      parsed.bin.readFloatLE(offset + 4),
      parsed.bin.readFloatLE(offset + 8),
    ]);
  }

  return values;
}

function readScalarAccessor(parsed: ParsedGlb, accessorIndex: number): number[] {
  const accessor = parsed.json.accessors?.[accessorIndex];
  if (!accessor || accessor.type !== 'SCALAR') {
    return [];
  }
  const bufferView = accessor.bufferView === undefined ? null : parsed.json.bufferViews?.[accessor.bufferView];
  if (!bufferView) {
    return [];
  }
  const componentByteSize = getComponentByteSize(accessor.componentType);
  const stride = bufferView.byteStride ?? componentByteSize;
  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values: number[] = [];

  for (let index = 0; index < accessor.count; index += 1) {
    values.push(readComponent(parsed.bin, byteOffset + index * stride, accessor.componentType));
  }

  return values;
}

function readComponent(buffer: Buffer, byteOffset: number, componentType: number): number {
  switch (componentType) {
    case 5121:
      return buffer.readUInt8(byteOffset);
    case 5123:
      return buffer.readUInt16LE(byteOffset);
    case 5125:
      return buffer.readUInt32LE(byteOffset);
    default:
      throw new Error(`Unsupported index component type ${componentType}`);
  }
}

function getComponentByteSize(componentType: number): number {
  if (componentType === 5121) {
    return 1;
  }
  if (componentType === 5123) {
    return 2;
  }
  if (componentType === 5125 || componentType === 5126) {
    return 4;
  }
  throw new Error(`Unsupported component type ${componentType}`);
}

function createSequentialIndices(vertexCount: number): number[] {
  return Array.from({ length: vertexCount }, (_, index) => index);
}

function countConnectedComponents(vertexCount: number, indices: readonly number[]): number {
  if (vertexCount === 0 || indices.length === 0) {
    return 0;
  }
  const parent = Array.from({ length: vertexCount }, (_, index) => index);
  const used = new Set<number>();

  for (let index = 0; index + 2 < indices.length; index += 3) {
    const a = indices[index];
    const b = indices[index + 1];
    const c = indices[index + 2];
    used.add(a);
    used.add(b);
    used.add(c);
    union(parent, a, b);
    union(parent, b, c);
  }

  const roots = new Set<number>();
  for (const index of used) {
    roots.add(find(parent, index));
  }
  return roots.size;
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

function calculateBoundingBox(positions: readonly (readonly [number, number, number])[]): PlayerGlbAudit['boundingBox'] {
  if (positions.length === 0) {
    return {
      height: 0,
      max: [0, 0, 0],
      min: [0, 0, 0],
    };
  }
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const position of positions) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], position[axis]);
      max[axis] = Math.max(max[axis], position[axis]);
    }
  }
  return {
    height: max[1] - min[1],
    max,
    min,
  };
}

function readTextureDimensions(parsed: ParsedGlb): PlayerTextureAudit[] {
  return (parsed.json.images ?? []).map((image, imageIndex) => {
    const bytes = readImageBytes(parsed, image);
    const dimensions = bytes ? readRasterDimensions(bytes, image.mimeType ?? null) : { height: null, width: null };
    return {
      height: dimensions.height,
      imageIndex,
      mimeType: image.mimeType ?? null,
      name: image.name ?? `image-${imageIndex}`,
      uri: image.uri ?? null,
      width: dimensions.width,
    };
  });
}

function readImageBytes(parsed: ParsedGlb, image: GltfImage): Buffer | null {
  if (image.bufferView !== undefined) {
    const view = parsed.json.bufferViews?.[image.bufferView];
    if (!view) {
      return null;
    }
    const start = view.byteOffset ?? 0;
    return parsed.bin.subarray(start, start + view.byteLength);
  }
  if (image.uri?.startsWith('data:')) {
    const [, payload] = image.uri.split(',', 2);
    return payload ? Buffer.from(payload, 'base64') : null;
  }
  return null;
}

function readRasterDimensions(bytes: Buffer, mimeType: string | null): { height: number | null; width: number | null } {
  if ((mimeType === 'image/png' || bytes.subarray(1, 4).toString('ascii') === 'PNG') && bytes.length >= 24) {
    return {
      height: bytes.readUInt32BE(20),
      width: bytes.readUInt32BE(16),
    };
  }
  if ((mimeType === 'image/jpeg' || bytes[0] === 0xff) && bytes.length > 4) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        break;
      }
      const marker = bytes[offset + 1];
      const segmentLength = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + segmentLength;
    }
  }
  return { height: null, width: null };
}

function writePlayerViewerHtml(report: PlayerAssetReport): void {
  const candidateRows = report.candidates.map((candidate) => {
    const path = candidate.rigged?.path ?? candidate.generated?.path ?? '';
    const audit = candidate.rigged ?? candidate.generated;
    return `<button data-path="${path}">${candidate.assetId} (${audit?.triangleCount ?? 'missing'} tris)</button>`;
  }).join('\n');
  const selected = report.candidates.find((candidate) => candidate.rigged)?.rigged?.path ??
    report.candidates.find((candidate) => candidate.generated)?.generated?.path ??
    '';
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Football JS Player Meshy Candidate Viewer</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #0c1116; color: #f0f4f8; }
      body { margin: 0; display: grid; min-height: 100vh; grid-template-columns: 340px 1fr; }
      aside { padding: 20px; border-right: 1px solid #2c3844; background: #141b22; overflow: auto; }
      main { min-height: 100vh; display: grid; }
      canvas { width: 100%; height: 100%; display: block; }
      button { display: block; width: 100%; margin: 8px 0; padding: 10px; border: 1px solid #43505c; background: #202a34; color: #edf2f7; border-radius: 6px; text-align: left; }
      pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; color: #cbd5e1; }
    </style>
  </head>
  <body>
    <aside>
      <h1>Player Candidate Viewer</h1>
      <p>Development-only viewer for generated/rigged Meshy player candidates.</p>
      ${candidateRows || '<p>No candidates downloaded yet.</p>'}
      <h2>Report</h2>
      <pre>${escapeHtml(JSON.stringify(report.candidates, null, 2))}</pre>
    </aside>
    <main><canvas id="preview"></canvas></main>
    <script type="importmap">
      { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js" } }
    </script>
    <script type="module">
      import * as THREE from 'three';
      import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js';
      const canvas = document.getElementById('preview');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b0f14);
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
      camera.position.set(0, 1.25, 5.2);
      camera.lookAt(0, 1.0, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x243447, 2.5));
      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(2, 4, 3);
      scene.add(key);
      const grid = new THREE.GridHelper(4, 8, 0x334155, 0x1f2937);
      scene.add(grid);
      const loader = new GLTFLoader();
      let active = null;
      async function load(path) {
        if (!path) return;
        if (active) scene.remove(active);
        const gltf = await loader.loadAsync('/' + path.replace(/^public\\//, ''));
        active = gltf.scene;
        scene.add(active);
      }
      for (const button of document.querySelectorAll('button[data-path]')) {
        button.addEventListener('click', () => load(button.dataset.path));
      }
      function resize() {
        const width = canvas.clientWidth || 800;
        const height = canvas.clientHeight || 600;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      function render() {
        resize();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      }
      load(${JSON.stringify(selected)});
      render();
    </script>
  </body>
</html>`;
  writeFileSync(resolveRepoPath(PLAYER_VIEWER_PATH), html);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

if (isDirectCli(import.meta.url)) {
  try {
    const report = createPlayerAssetReport();
    writePlayerAssetReportFiles(report);
    console.log(JSON.stringify(report, null, 2));
    if (report.planValidationErrors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
