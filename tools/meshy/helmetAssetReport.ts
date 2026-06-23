import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute } from 'node:path';
import {
  FOOTBALL_HELMET_CANDIDATE_PLAN,
  FOOTBALL_HELMET_REFERENCE_PLAN,
} from './helmetGenerationPlan';
import {
  HELMET_AUDIT_REPORT_PATH,
  HELMET_COMBINED_RUNTIME_PATH,
  HELMET_FACEGUARD_RUNTIME_PATH,
  HELMET_MANIFEST_RUNTIME_PATH,
  HELMET_PREVIEW_PATH,
  HELMET_SHELL_RUNTIME_PATH,
  getFileHash,
  getFileSize,
  isDirectCli,
  normalizePathForManifest,
  resolveRepoPath,
  validateHelmetPlan,
  writeJsonFile,
  type GlbAuditPrimitive,
  type GlbAuditReport,
} from './schemas';

type GltfAccessorType = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';

interface GltfJson {
  readonly accessors?: GltfAccessor[];
  readonly bufferViews?: GltfBufferView[];
  readonly materials?: Array<{ name?: string }>;
  readonly meshes?: GltfMesh[];
  readonly nodes?: Array<{ children?: number[]; mesh?: number; name?: string }>;
}

interface GltfAccessor {
  readonly bufferView?: number;
  readonly byteOffset?: number;
  readonly componentType: number;
  readonly count: number;
  readonly type: GltfAccessorType;
}

interface GltfBufferView {
  readonly buffer?: number;
  readonly byteLength: number;
  readonly byteOffset?: number;
  readonly byteStride?: number;
}

interface GltfMesh {
  readonly name?: string;
  readonly primitives?: GltfPrimitive[];
}

interface GltfPrimitive {
  readonly attributes?: Record<string, number>;
  readonly indices?: number;
  readonly material?: number;
}

interface ParsedGlb {
  readonly bin: Buffer;
  readonly json: GltfJson;
}

export interface HelmetAssetReport {
  readonly existingHelmetAudit: GlbAuditReport | null;
  readonly generatedCandidates: readonly GlbAuditReport[];
  readonly planValidationErrors: readonly string[];
  readonly preparedRuntime: {
    readonly combined: GlbAuditReport | null;
    readonly faceguard: GlbAuditReport | null;
    readonly manifestExists: boolean;
    readonly shell: GlbAuditReport | null;
  };
  readonly previewPath: string;
  readonly referenceImages: readonly HelmetReferenceReportEntry[];
}

export interface HelmetReferenceReportEntry {
  readonly assetId: string;
  readonly candidateId: string;
  readonly contentHash: string | null;
  readonly exists: boolean;
  readonly outputPath: string;
  readonly provenanceExists: boolean;
  readonly view: string;
}

export function createHelmetAssetReport(): HelmetAssetReport {
  const existingHelmetPath = resolveRepoPath('low_poly_helmet.glb');
  return {
    existingHelmetAudit: existsSync(existingHelmetPath)
      ? auditGlbAsset(existingHelmetPath)
      : null,
    generatedCandidates: FOOTBALL_HELMET_CANDIDATE_PLAN
      .filter((candidate) => existsSync(resolveRepoPath(candidate.outputPath)))
      .map((candidate) => auditGlbAsset(candidate.outputPath)),
    planValidationErrors: validateHelmetPlan(
      FOOTBALL_HELMET_REFERENCE_PLAN,
      FOOTBALL_HELMET_CANDIDATE_PLAN,
    ),
    preparedRuntime: {
      combined: existsSync(resolveRepoPath(HELMET_COMBINED_RUNTIME_PATH))
        ? auditGlbAsset(HELMET_COMBINED_RUNTIME_PATH)
        : null,
      faceguard: existsSync(resolveRepoPath(HELMET_FACEGUARD_RUNTIME_PATH))
        ? auditGlbAsset(HELMET_FACEGUARD_RUNTIME_PATH)
        : null,
      manifestExists: existsSync(resolveRepoPath(HELMET_MANIFEST_RUNTIME_PATH)),
      shell: existsSync(resolveRepoPath(HELMET_SHELL_RUNTIME_PATH))
        ? auditGlbAsset(HELMET_SHELL_RUNTIME_PATH)
        : null,
    },
    previewPath: HELMET_PREVIEW_PATH,
    referenceImages: FOOTBALL_HELMET_REFERENCE_PLAN.map((reference) => {
      const exists = existsSync(resolveRepoPath(reference.outputPath));
      return {
        assetId: reference.assetId,
        candidateId: reference.candidateId,
        contentHash: exists ? getFileHash(reference.outputPath) : null,
        exists,
        outputPath: reference.outputPath,
        provenanceExists: existsSync(resolveRepoPath(`${reference.outputPath}.json`)),
        view: reference.view,
      };
    }),
  };
}

export function writeHelmetAssetReportFiles(report: HelmetAssetReport): void {
  writeJsonFile(resolveRepoPath(HELMET_AUDIT_REPORT_PATH), report);
  writeHelmetPreviewHtml(report);
}

export function auditGlbAsset(path: string): GlbAuditReport {
  const displayPath = isAbsolute(path) ? path : normalizePathForManifest(path);
  const parsed = parseGlb(path);
  const nodeNames = (parsed.json.nodes ?? []).map((node, index) => node.name ?? `node-${index}`);
  const materialNames = (parsed.json.materials ?? []).map((material, index) => material.name ?? `material-${index}`);
  const meshNames = (parsed.json.meshes ?? []).map((mesh, index) => mesh.name ?? `mesh-${index}`);
  const primitives: GlbAuditPrimitive[] = [];
  let connectedComponentCount = 0;
  let triangleCount = 0;

  for (const [meshIndex, mesh] of (parsed.json.meshes ?? []).entries()) {
    const meshName = mesh.name ?? `mesh-${meshIndex}`;
    for (const primitive of mesh.primitives ?? []) {
      const positionAccessor = readAccessor(parsed.json, primitive.attributes?.POSITION);
      const vertexCount = positionAccessor?.count ?? 0;
      const indices = primitive.indices === undefined
        ? createSequentialIndices(vertexCount)
        : readScalarAccessor(parsed, primitive.indices);
      const primitiveTriangles = Math.floor(indices.length / 3);
      connectedComponentCount += countConnectedComponents(vertexCount, indices);
      triangleCount += primitiveTriangles;
      primitives.push({
        material: primitive.material === undefined ? null : materialNames[primitive.material] ?? null,
        meshName,
        triangleCount: primitiveTriangles,
        vertexCount,
      });
    }
  }

  const hasShellMesh = meshNames.includes('helmet_shell');
  const hasFaceguardMesh = meshNames.includes('faceguard_standard');
  const hasShellMaterial = materialNames.includes('mat_helmet_shell');
  const hasFaceguardMaterial = materialNames.includes('mat_faceguard');
  const shellFaceguardSeparable = hasShellMesh && hasFaceguardMesh && hasShellMaterial && hasFaceguardMaterial;

  return {
    connectedComponentCount,
    materialCount: materialNames.length,
    materialNames,
    meshCount: meshNames.length,
    meshNames,
    nodeNames,
    path: displayPath,
    primitives,
    shellFaceguardSeparable,
    shellFaceguardSeparationReason: shellFaceguardSeparable
      ? 'Required shell and faceguard meshes/materials are already named separately.'
      : 'Asset does not expose both helmet_shell and faceguard_standard with independent named materials.',
    triangleCount,
  };
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

function readAccessor(json: GltfJson, accessorIndex: number | undefined): GltfAccessor | null {
  return accessorIndex === undefined ? null : json.accessors?.[accessorIndex] ?? null;
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

function writeHelmetPreviewHtml(report: HelmetAssetReport): void {
  const absolutePath = resolveRepoPath(HELMET_PREVIEW_PATH);
  const summary = report.preparedRuntime.combined;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Football JS Modular Helmet Preview</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #0d1117; color: #edf2f7; }
      body { margin: 0; display: grid; min-height: 100vh; grid-template-columns: 320px 1fr; }
      aside { padding: 20px; border-right: 1px solid #2e3a46; background: #141b22; overflow: auto; }
      main { min-height: 100vh; display: grid; place-items: stretch; }
      canvas { width: 100%; height: 100%; display: block; }
      label { display: grid; gap: 6px; margin: 14px 0; color: #cfd8df; }
      button { margin: 4px 4px 4px 0; padding: 8px 10px; border: 1px solid #495766; background: #1c2730; color: #edf2f7; border-radius: 6px; }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 10px; font-size: 13px; }
      dt { color: #98a7b4; }
      dd { margin: 0; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <aside>
      <h1>Helmet Preview</h1>
      <p>Development-only preview for the modular Football JS helmet kit.</p>
      <label>Shell color <input id="shellColor" type="color" value="#ffffff"></label>
      <label>Faceguard color <input id="faceguardColor" type="color" value="#33363b"></label>
      <label><input id="shellVisible" type="checkbox" checked> Shell visible</label>
      <label><input id="faceguardVisible" type="checkbox" checked> Faceguard visible</label>
      <label><input id="headVisible" type="checkbox" checked> Head visible</label>
      <label><input id="boundsVisible" type="checkbox" checked> Bounds visible</label>
      <div>
        <button data-view="front">Front</button>
        <button data-view="side">Side</button>
        <button data-view="back">Back</button>
        <button data-view="three">Three-quarter</button>
        <button data-view="gameplay">Gameplay</button>
      </div>
      <h2>Metrics</h2>
      <dl>
        <dt>Total triangles</dt><dd>${summary?.triangleCount ?? 'missing'}</dd>
        <dt>Shell triangles</dt><dd>${report.preparedRuntime.shell?.triangleCount ?? 'missing'}</dd>
        <dt>Faceguard triangles</dt><dd>${report.preparedRuntime.faceguard?.triangleCount ?? 'missing'}</dd>
        <dt>Mesh count</dt><dd>${summary?.meshCount ?? 'missing'}</dd>
        <dt>Material count</dt><dd>${summary?.materialCount ?? 'missing'}</dd>
        <dt>Kit hash</dt><dd>${existsSync(resolveRepoPath(HELMET_COMBINED_RUNTIME_PATH)) ? getFileHash(HELMET_COMBINED_RUNTIME_PATH) : 'missing'}</dd>
        <dt>Kit bytes</dt><dd>${existsSync(resolveRepoPath(HELMET_COMBINED_RUNTIME_PATH)) ? getFileSize(HELMET_COMBINED_RUNTIME_PATH) : 0}</dd>
      </dl>
      <p>Standalone reconstruction test loads <code>helmet-shell.glb</code> and <code>faceguard-standard.glb</code> at identity for comparison.</p>
    </aside>
    <main><canvas id="preview"></canvas></main>
    <script type="importmap">
      {
        "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js"
        }
      }
    </script>
    <script type="module">
      import * as THREE from 'three';
      import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js';
      const canvas = document.getElementById('preview');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b0f14);
      const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
      const root = new THREE.Group();
      scene.add(root);
      const light = new THREE.HemisphereLight(0xffffff, 0x223344, 2.2);
      scene.add(light);
      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(3, 4, 5);
      scene.add(key);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 2), new THREE.MeshStandardMaterial({ color: 0xb8805d, roughness: 0.7 }));
      head.name = 'preview-head';
      root.add(head);
      const boxHelper = new THREE.BoxHelper(root, 0xf1c84c);
      scene.add(boxHelper);
      const origin = new THREE.AxesHelper(0.35);
      scene.add(origin);
      const loader = new GLTFLoader();
      const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0.05 });
      const faceguardMaterial = new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.65, metalness: 0.05 });
      const shell = new THREE.Group();
      const faceguard = new THREE.Group();
      root.add(shell, faceguard);
      await Promise.allSettled([
        loader.loadAsync('/models/helmet/helmet-shell.glb').then((gltf) => { shell.add(gltf.scene); }),
        loader.loadAsync('/models/helmet/faceguard-standard.glb').then((gltf) => { faceguard.add(gltf.scene); }),
      ]);
      function applyMaterials() {
        shell.traverse((object) => { if (object.isMesh) object.material = shellMaterial; });
        faceguard.traverse((object) => { if (object.isMesh) object.material = faceguardMaterial; });
      }
      applyMaterials();
      function resize() {
        const width = canvas.clientWidth || 800;
        const height = canvas.clientHeight || 600;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      function setView(view) {
        const positions = {
          back: [0, 0.35, -4.2],
          front: [0, 0.35, 4.2],
          gameplay: [0.8, 1.2, 5.2],
          side: [4.2, 0.35, 0],
          three: [3.2, 1.15, 4.1],
        };
        camera.position.fromArray(positions[view] || positions.three);
        camera.lookAt(0, 0.05, 0);
      }
      setView('three');
      document.getElementById('shellColor').addEventListener('input', (event) => shellMaterial.color.set(event.target.value));
      document.getElementById('faceguardColor').addEventListener('input', (event) => faceguardMaterial.color.set(event.target.value));
      document.getElementById('shellVisible').addEventListener('change', (event) => { shell.visible = event.target.checked; });
      document.getElementById('faceguardVisible').addEventListener('change', (event) => { faceguard.visible = event.target.checked; });
      document.getElementById('headVisible').addEventListener('change', (event) => { head.visible = event.target.checked; });
      document.getElementById('boundsVisible').addEventListener('change', (event) => { boxHelper.visible = event.target.checked; });
      document.querySelectorAll('button[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
      function render() {
        resize();
        boxHelper.update();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      }
      render();
    </script>
  </body>
</html>`;
  writeFileSync(absolutePath, html);
}

if (isDirectCli(import.meta.url)) {
  try {
    const report = createHelmetAssetReport();
    writeHelmetAssetReportFiles(report);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
