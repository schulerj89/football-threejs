import * as THREE from 'three';
import {
  applyHelmetUniformMaterials,
  cloneHelmetAsset,
  createHelmetRuntimeMaterialKey,
  findHelmetPartMeshes,
  measureHelmetBounds,
  type HelmetPartMeshes,
} from '../presentation/helmet/HelmetAssetLibrary';
import { getHelmetUnlitExactMaterial } from '../presentation/helmet/HelmetMaterialLibrary';
import { STARTER_TEAM_PROFILES } from '../teams/TeamRegistry';
import type { UniformPalette } from '../teams/UniformPalette';

export type HelmetPreviewMode =
  | 'normalVisualization'
  | 'sourceMaterial'
  | 'standardNeutralLight'
  | 'teamMaterial'
  | 'unlitExactColor'
  | 'wireframe';

export interface HelmetPreviewFit {
  centerOffset: THREE.Vector3;
  scale: number;
}

export interface HelmetPreviewDiagnostics {
  faceguardMaterialColor: string | null;
  faceguardMaterialName: string | null;
  faceguardRequestedColor: string;
  faceguardSourceMapStatus: string;
  faceguardVertexColorStatus: string;
  materialCacheKey: string;
  mode: HelmetPreviewMode;
  runtimeMaterialType: string | null;
  shellMaterialColor: string | null;
  shellMaterialName: string | null;
  shellRequestedColor: string;
  shellSourceMapStatus: string;
  shellVertexColorStatus: string;
}

interface HelmetPreviewEntry {
  camera: THREE.PerspectiveCamera;
  fallback: SVGSVGElement;
  helmet: THREE.Object3D | null;
  host: HTMLElement;
  id: string;
  loadState: 'fallback' | 'idle' | 'loaded' | 'loading';
  materialScope: string;
  mode: HelmetPreviewMode;
  normalizer: THREE.Group | null;
  parts: HelmetPartMeshes | null;
  scene: THREE.Scene;
  sourceMaterials: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  uniform: UniformPalette;
}

const HELMET_PREVIEW_CONFIG = {
  cameraFov: 28,
  cameraPosition: new THREE.Vector3(0.28, 0.08, 3.55),
  fitTargetHeight: 1.34,
  fitTargetWidth: 1.6,
  maximumPixelRatio: 1.5,
  previewRotationY: -0.18,
} as const;

export const HELMET_DIAGNOSTIC_SWATCHES = [
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffffff',
  '#101010',
  ...new Set(STARTER_TEAM_PROFILES.flatMap((profile) => [
    profile.homeUniform.helmetShell.toLowerCase(),
    profile.awayUniform.helmetShell.toLowerCase(),
  ])),
] as const;

const normalPreviewMaterial = new THREE.MeshNormalMaterial({
  side: THREE.FrontSide,
});

const wireframePreviewMaterials = new Map<string, THREE.MeshBasicMaterial>();

export function resolveHelmetPreviewRotationY(id: string): number {
  if (id === 'user') {
    return -0.42;
  }

  if (id === 'opponent') {
    return 0.42;
  }

  return HELMET_PREVIEW_CONFIG.previewRotationY;
}

export function calculateHelmetPreviewFit(bounds: THREE.Box3): HelmetPreviewFit {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const widthScale = HELMET_PREVIEW_CONFIG.fitTargetWidth / Math.max(size.x, size.z, 0.001);
  const heightScale = HELMET_PREVIEW_CONFIG.fitTargetHeight / Math.max(size.y, 0.001);
  const scale = Math.min(widthScale, heightScale);

  return {
    centerOffset: center.multiplyScalar(-1),
    scale,
  };
}

export class MatchSetupHelmetPreviewRenderer {
  private readonly entries = new Map<string, HelmetPreviewEntry>();
  private readonly renderer: THREE.WebGLRenderer | null;
  private animationFrame = 0;
  private disposed = false;
  private visible = false;
  private warnedFailure = false;

  private readonly handleResize = (): void => {
    this.requestRender();
  };

  private readonly handleScroll = (): void => {
    this.requestRender();
  };

  private readonly handleVisibilityChange = (): void => {
    this.requestRender();
  };

  constructor(private readonly container: HTMLElement) {
    this.renderer = this.createRenderer();

    if (this.renderer) {
      container.append(this.renderer.domElement);
      window.addEventListener('resize', this.handleResize);
      container.addEventListener('scroll', this.handleScroll, true);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  registerPreview(id: string, host: HTMLElement, fallback: SVGSVGElement, uniform: UniformPalette): void {
    if (this.entries.has(id)) {
      this.syncPreview(id, uniform);
      return;
    }

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(2.2, 2.8, 3.8);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.65);
    fillLight.position.set(-2.4, 1.6, -2.2);
    scene.add(fillLight);

    const camera = new THREE.PerspectiveCamera(HELMET_PREVIEW_CONFIG.cameraFov, 1, 0.05, 20);
    camera.position.copy(HELMET_PREVIEW_CONFIG.cameraPosition);
    camera.lookAt(0, 0, 0);

    this.entries.set(id, {
      camera,
      fallback,
      helmet: null,
      host,
      id,
      loadState: 'idle',
      materialScope: createPreviewMaterialScope(id, uniform),
      mode: 'teamMaterial',
      normalizer: null,
      parts: null,
      scene,
      sourceMaterials: new Map(),
      uniform,
    });

    if (this.visible) {
      this.loadPreview(id);
    }
  }

  syncPreview(id: string, uniform: UniformPalette): void {
    const entry = this.entries.get(id);

    if (!entry) {
      return;
    }

    entry.uniform = uniform;
    entry.materialScope = createPreviewMaterialScope(id, uniform);

    if (entry.parts) {
      applyPreviewMode(entry);
      entry.host.dataset.preview = 'glb';
    }

    if (this.visible) {
      this.loadPreview(id);
    }

    this.requestRender();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;

    if (this.renderer) {
      this.renderer.domElement.hidden = !visible;
      this.renderer.domElement.style.display = visible ? '' : 'none';
    }

    if (visible) {
      for (const entry of this.entries.values()) {
        this.loadPreview(entry.id);
      }
    } else {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = 0;
      }
      this.renderer?.setScissorTest(false);
      this.renderer?.clear(true, true, true);
    }

    this.requestRender();
  }

  setPreviewMode(mode: HelmetPreviewMode): void {
    for (const entry of this.entries.values()) {
      entry.mode = mode;
      applyPreviewMode(entry);
      syncPreviewDiagnostics(entry);
    }

    this.requestRender();
  }

  getPreviewDiagnostics(id: string): HelmetPreviewDiagnostics | null {
    const entry = this.entries.get(id);

    return entry ? createPreviewDiagnostics(entry) : null;
  }

  dispose(): void {
    this.disposed = true;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }

    window.removeEventListener('resize', this.handleResize);
    this.container.removeEventListener('scroll', this.handleScroll, true);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    for (const entry of this.entries.values()) {
      entry.scene.clear();
      entry.host.dataset.preview = 'fallback';
      entry.fallback.removeAttribute('aria-hidden');
    }
    this.entries.clear();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }

  private createRenderer(): THREE.WebGLRenderer | null {
    try {
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HELMET_PREVIEW_CONFIG.maximumPixelRatio));
      renderer.autoClear = false;
      renderer.domElement.className = 'match-helmet-preview-canvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.hidden = true;
      return renderer;
    } catch (error) {
      this.warnPreviewFailure(error);
      return null;
    }
  }

  private loadPreview(id: string): void {
    const entry = this.entries.get(id);

    if (!entry || !this.renderer || entry.loadState !== 'idle') {
      return;
    }

    entry.loadState = 'loading';
    void cloneHelmetAsset()
      .then((helmet) => {
        if (this.disposed) {
          return;
        }

        const parts = findHelmetPartMeshes(helmet);
        entry.sourceMaterials = captureSourceMaterials(parts);

        const fit = calculateHelmetPreviewFit(measureHelmetBounds(helmet));
        const normalizer = new THREE.Group();
        normalizer.name = `match-setup-helmet-preview-${entry.id}`;
        normalizer.scale.setScalar(fit.scale);
        normalizer.rotation.y = resolveHelmetPreviewRotationY(entry.id);
        helmet.position.copy(fit.centerOffset);
        normalizer.add(helmet);
        entry.scene.add(normalizer);

        entry.helmet = helmet;
        entry.normalizer = normalizer;
        entry.parts = parts;
        entry.loadState = 'loaded';
        entry.host.dataset.preview = 'glb';
        entry.fallback.setAttribute('aria-hidden', 'true');
        applyPreviewMode(entry);
        syncPreviewDiagnostics(entry);
        this.requestRender();
      })
      .catch((error: unknown) => {
        entry.loadState = 'fallback';
        entry.host.dataset.preview = 'fallback';
        entry.fallback.removeAttribute('aria-hidden');
        this.warnPreviewFailure(error);
      });
  }

  private requestRender(): void {
    if (this.disposed || !this.renderer || !this.visible || document.visibilityState === 'hidden') {
      return;
    }

    if (this.animationFrame) {
      return;
    }

    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = 0;
      this.render();
    });
  }

  private render(): void {
    if (this.disposed || !this.renderer || !this.visible || document.visibilityState === 'hidden') {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HELMET_PREVIEW_CONFIG.maximumPixelRatio));
    this.renderer.setSize(width, height, false);
    this.renderer.setScissorTest(false);
    this.renderer.clear(true, true, true);
    this.renderer.setScissorTest(true);

    for (const entry of this.entries.values()) {
      if (entry.loadState !== 'loaded' || !entry.normalizer || !entry.host.isConnected) {
        continue;
      }

      const rect = entry.host.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1 || rect.bottom < 0 || rect.top > height) {
        continue;
      }

      const x = Math.max(0, rect.left);
      const y = Math.max(0, height - rect.bottom);
      const scissorWidth = Math.min(rect.width, width - x);
      const scissorHeight = Math.min(rect.height, height - y);

      if (scissorWidth <= 1 || scissorHeight <= 1) {
        continue;
      }

      entry.camera.aspect = rect.width / Math.max(rect.height, 1);
      entry.camera.updateProjectionMatrix();
      this.renderer.setViewport(x, y, scissorWidth, scissorHeight);
      this.renderer.setScissor(x, y, scissorWidth, scissorHeight);
      this.renderer.render(entry.scene, entry.camera);
    }

    this.renderer.setScissorTest(false);
  }

  private warnPreviewFailure(error: unknown): void {
    if (this.warnedFailure || !import.meta.env.DEV) {
      return;
    }

    this.warnedFailure = true;
    console.warn(
      '[match-setup] Helmet GLB preview unavailable; using SVG fallback.',
      error instanceof Error ? error.message : error,
    );
  }
}

function createPreviewMaterialScope(id: string, uniform: UniformPalette): string {
  return `match-setup-preview:${id}:${uniform.helmetShell}:${uniform.faceguard}:${uniform.stripe}`;
}

function applyPreviewMode(entry: HelmetPreviewEntry): void {
  if (!entry.parts) {
    return;
  }

  if (entry.mode === 'sourceMaterial') {
    restoreSourceMaterials(entry);
    return;
  }

  if (entry.mode === 'normalVisualization') {
    assignPreviewMaterial(entry.parts.shellMeshes, normalPreviewMaterial);
    assignPreviewMaterial(entry.parts.faceguardMeshes, normalPreviewMaterial);
    assignPreviewMaterial(entry.parts.accentMeshes ?? [], normalPreviewMaterial);
    return;
  }

  if (entry.mode === 'unlitExactColor') {
    assignPreviewMaterial(
      entry.parts.shellMeshes,
      getHelmetUnlitExactMaterial({ color: entry.uniform.helmetShell, component: 'shell' }),
    );
    assignPreviewMaterial(
      entry.parts.faceguardMeshes,
      getHelmetUnlitExactMaterial({ color: entry.uniform.faceguard, component: 'faceguard' }),
    );
    assignPreviewMaterial(
      entry.parts.accentMeshes ?? [],
      getHelmetUnlitExactMaterial({ color: entry.uniform.helmetShell, component: 'shell' }),
    );
    return;
  }

  if (entry.mode === 'wireframe') {
    assignPreviewMaterial(
      entry.parts.shellMeshes,
      getWireframeMaterial(entry.uniform.helmetShell, 'shell'),
    );
    assignPreviewMaterial(
      entry.parts.faceguardMeshes,
      getWireframeMaterial(entry.uniform.faceguard, 'faceguard'),
    );
    assignPreviewMaterial(
      entry.parts.accentMeshes ?? [],
      getWireframeMaterial(entry.uniform.helmetShell, 'shell'),
    );
    return;
  }

  applyHelmetUniformMaterials(entry.parts, entry.uniform, entry.materialScope);
}

function captureSourceMaterials(parts: HelmetPartMeshes): Map<THREE.Mesh, THREE.Material | THREE.Material[]> {
  const materials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  for (const mesh of [...parts.shellMeshes, ...parts.faceguardMeshes, ...(parts.accentMeshes ?? [])]) {
    materials.set(mesh, Array.isArray(mesh.material) ? [...mesh.material] : mesh.material);
  }

  return materials;
}

function restoreSourceMaterials(entry: HelmetPreviewEntry): void {
  for (const [mesh, material] of entry.sourceMaterials.entries()) {
    mesh.material = Array.isArray(material) ? [...material] : material;
  }
}

function assignPreviewMaterial(meshes: THREE.Mesh[], material: THREE.Material): void {
  for (const mesh of meshes) {
    mesh.material = material;
  }
}

function getWireframeMaterial(color: string, component: 'faceguard' | 'shell'): THREE.MeshBasicMaterial {
  const key = `${component}:${color.toLowerCase()}:wireframe`;
  const cached = wireframePreviewMaterials.get(key);

  if (cached) {
    return cached;
  }

  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.FrontSide,
    vertexColors: false,
    wireframe: true,
  });
  material.name = `football-helmet-${component}-wireframe-${color.replace('#', '').toLowerCase()}`;
  material.map = null;
  material.needsUpdate = true;
  wireframePreviewMaterials.set(key, material);
  return material;
}

function syncPreviewDiagnostics(entry: HelmetPreviewEntry): void {
  const diagnostics = createPreviewDiagnostics(entry);
  entry.host.dataset.helmetPreviewMode = diagnostics.mode;
  entry.host.dataset.shellRequested = diagnostics.shellRequestedColor;
  entry.host.dataset.faceguardRequested = diagnostics.faceguardRequestedColor;
  entry.host.dataset.shellMaterial = diagnostics.shellMaterialColor ?? 'none';
  entry.host.dataset.faceguardMaterial = diagnostics.faceguardMaterialColor ?? 'none';
  entry.host.dataset.sourceMapStatus = [
    `shell:${diagnostics.shellSourceMapStatus}`,
    `faceguard:${diagnostics.faceguardSourceMapStatus}`,
  ].join(',');
  entry.host.dataset.vertexColorStatus = [
    `shell:${diagnostics.shellVertexColorStatus}`,
    `faceguard:${diagnostics.faceguardVertexColorStatus}`,
  ].join(',');
  entry.host.dataset.materialCacheKey = diagnostics.materialCacheKey;
  entry.host.title = [
    `Helmet preview: ${diagnostics.mode}`,
    `shell requested ${diagnostics.shellRequestedColor}, material ${diagnostics.shellMaterialColor ?? 'none'}`,
    `faceguard requested ${diagnostics.faceguardRequestedColor}, material ${diagnostics.faceguardMaterialColor ?? 'none'}`,
    `maps ${entry.host.dataset.sourceMapStatus}`,
    `vertex colors ${entry.host.dataset.vertexColorStatus}`,
    `cache ${diagnostics.materialCacheKey}`,
  ].join('\n');
}

function createPreviewDiagnostics(entry: HelmetPreviewEntry): HelmetPreviewDiagnostics {
  const shellMaterial = entry.parts ? getFirstMaterial(entry.parts.shellMeshes) : null;
  const faceguardMaterial = entry.parts ? getFirstMaterial(entry.parts.faceguardMeshes) : null;
  return {
    faceguardMaterialColor: getMaterialHex(faceguardMaterial),
    faceguardMaterialName: faceguardMaterial?.name ?? null,
    faceguardRequestedColor: entry.uniform.faceguard.toLowerCase(),
    faceguardSourceMapStatus: getMapStatus(faceguardMaterial),
    faceguardVertexColorStatus: getVertexColorStatus(entry.parts?.faceguardMeshes ?? [], faceguardMaterial),
    materialCacheKey: [
      createHelmetRuntimeMaterialKey('shell', entry.uniform),
      createHelmetRuntimeMaterialKey('faceguard', entry.uniform),
    ].join('|'),
    mode: entry.mode,
    runtimeMaterialType: shellMaterial?.type ?? faceguardMaterial?.type ?? null,
    shellMaterialColor: getMaterialHex(shellMaterial),
    shellMaterialName: shellMaterial?.name ?? null,
    shellRequestedColor: entry.uniform.helmetShell.toLowerCase(),
    shellSourceMapStatus: getMapStatus(shellMaterial),
    shellVertexColorStatus: getVertexColorStatus(entry.parts?.shellMeshes ?? [], shellMaterial),
  };
}

function getFirstMaterial(meshes: THREE.Mesh[]): THREE.Material | null {
  const material = meshes[0]?.material;
  if (!material) {
    return null;
  }

  return Array.isArray(material) ? material[0] ?? null : material;
}

function getMaterialHex(material: THREE.Material | null): string | null {
  if (!material || !('color' in material) || !(material.color instanceof THREE.Color)) {
    return null;
  }

  return `#${material.color.getHexString()}`;
}

function getMapStatus(material: THREE.Material | null): string {
  if (!material) {
    return 'missing-material';
  }

  const candidate = material as THREE.Material & {
    emissiveMap?: THREE.Texture | null;
    map?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
  };
  const activeMaps = [
    candidate.map ? 'base' : null,
    candidate.emissiveMap ? 'emissive' : null,
    candidate.normalMap ? 'normal' : null,
    candidate.roughnessMap ? 'roughness' : null,
    candidate.metalnessMap ? 'metalness' : null,
  ].filter(Boolean);

  return activeMaps.length > 0 ? activeMaps.join('+') : 'none';
}

function getVertexColorStatus(meshes: THREE.Mesh[], material: THREE.Material | null): string {
  const hasGeometryColor = meshes.some((mesh) => Boolean(mesh.geometry.getAttribute('color')));
  const materialVertexColors = Boolean((material as THREE.Material | null | undefined)?.vertexColors);
  return [
    hasGeometryColor ? 'geometry-color' : 'no-geometry-color',
    materialVertexColors ? 'material-vertex-colors' : 'material-vertex-colors-off',
  ].join('+');
}
