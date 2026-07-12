import './voxelPlayerHarness.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createFootballPlayerVisual,
  preloadFootballPlayerVisualAssets,
  type FootballPlayerVisualResources,
} from './presentation/players/FootballPlayerVisualFactory';
import {
  DEFAULT_PLAYER_TEAM_UNIFORMS,
  PLAYER_HEAD_ANCHOR_NAME,
} from './playerVisual';

type HarnessPose = 'neutral' | 'ready' | 'run';

interface VoxelPlayerHarnessSnapshot {
  boneCount: number;
  drawCalls: number;
  geometries: number;
  headAnchorName: string | null;
  helmetAttached: boolean;
  helmetParentName: string | null;
  helmetVisible: boolean;
  loaded: boolean;
  meshCount: number;
  pose: HarnessPose;
  route: 'voxel-player-harness';
  textures: number;
  triangleCount: number;
  visualMode: 'meshyRigged' | 'procedural' | null;
}

declare global {
  interface Window {
    __VOXEL_PLAYER_HARNESS__?: {
      getSnapshot: () => VoxelPlayerHarnessSnapshot;
    };
  }
}

interface BoneRestTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

const TEAM_UNIFORM = DEFAULT_PLAYER_TEAM_UNIFORMS.offense;
const DEG_TO_RAD = Math.PI / 180;
const SUBJECT_TARGET = new THREE.Vector3(0, 0.95, 0);
const SUBJECT_CENTER = new THREE.Vector3();
const SUBJECT_SIZE = new THREE.Vector3();
const DELTA_ROTATION = new THREE.Quaternion();
const DELTA_EULER = new THREE.Euler();

class VoxelPlayerHarness {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  private readonly controls: OrbitControls;
  private readonly viewport = document.createElement('section');
  private readonly panel = document.createElement('aside');
  private readonly metrics = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly poseButtons = new Map<HarnessPose, HTMLButtonElement>();
  private readonly boneMap = new Map<string, THREE.Bone>();
  private readonly restTransforms = new Map<THREE.Bone, BoneRestTransform>();
  private readonly resizeObserver: ResizeObserver;
  private resource: FootballPlayerVisualResources | null = null;
  private skeletonHelper: THREE.SkeletonHelper | null = null;
  private showSkeleton = false;
  private showHelmet = true;
  private loaded = false;
  private pose: HarnessPose = 'neutral';
  private animationFrame = 0;
  private metricsAccumulator = 0;
  private poseStartSeconds = 0;
  private previousFrameSeconds = 0;

  constructor(private readonly root: HTMLElement) {
    this.root.className = 'voxel-player-harness';
    this.viewport.className = 'voxel-player-harness__viewport';
    this.panel.className = 'voxel-player-harness__panel';
    this.metrics.className = 'voxel-player-harness__metrics';
    this.status.className = 'voxel-player-harness__status';

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.setAttribute('aria-label', 'Voxel football player preview');
    this.viewport.append(this.renderer.domElement, this.createCameraToolbar());
    this.panel.append(
      this.createHeader(),
      this.createMetricsCard(),
      this.createPoseCard(),
      this.createDisplayCard(),
      this.createAssetCard(),
    );
    this.root.append(this.viewport, this.panel);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 9;
    this.controls.target.copy(SUBJECT_TARGET);

    this.configureScene();
    this.setCamera('front');
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.viewport);
    window.addEventListener('beforeunload', this.dispose, { once: true });
    window.__VOXEL_PLAYER_HARNESS__ = {
      getSnapshot: () => this.getSnapshot(),
    };
    this.animationFrame = requestAnimationFrame(this.animate);
    void this.loadSubject();
  }

  private configureScene(): void {
    this.scene.name = 'voxel-player-harness-scene';
    this.scene.background = new THREE.Color(0x07110e);
    this.scene.fog = new THREE.Fog(0x07110e, 7, 16);

    const hemisphere = new THREE.HemisphereLight(0xd9efff, 0x17251c, 2.1);
    hemisphere.name = 'voxel-player-harness-hemisphere';
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.name = 'voxel-player-harness-key';
    key.position.set(3.5, 5.5, 4.5);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x78b7ff, 1.8);
    rim.name = 'voxel-player-harness-rim';
    rim.position.set(-4, 3, -4);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x15251f, roughness: 0.96 }),
    );
    ground.name = 'voxel-player-harness-ground';
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.012;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(10, 20, 0x3d8069, 0x243e34);
    grid.name = 'voxel-player-harness-grid';
    grid.position.y = -0.006;
    const gridMaterial = grid.material as THREE.LineBasicMaterial;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.42;
    this.scene.add(grid);
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('header');
    const eyebrow = document.createElement('div');
    eyebrow.className = 'voxel-player-harness__eyebrow';
    eyebrow.textContent = 'Production asset preview';
    const heading = document.createElement('h1');
    heading.textContent = 'Voxel Player Harness';
    const note = document.createElement('p');
    note.textContent = 'Shared rigged-player factory with the production football helmet and runtime materials.';
    this.status.textContent = 'Loading production player and helmet assets...';
    header.append(eyebrow, heading, note, this.status);
    return header;
  }

  private createCameraToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'voxel-player-harness__camera-toolbar';
    toolbar.setAttribute('aria-label', 'Camera views');
    for (const [label, view] of [
      ['Front', 'front'],
      ['Side', 'side'],
      ['Back', 'back'],
      ['High', 'high'],
      ['Reset', 'reset'],
    ] as const) {
      toolbar.append(createButton(label, () => this.setCamera(view)));
    }
    return toolbar;
  }

  private createMetricsCard(): HTMLElement {
    const card = createCard('Runtime metrics');
    card.append(this.metrics);
    this.updateMetrics();
    return card;
  }

  private createPoseCard(): HTMLElement {
    const card = createCard('Pose preview');
    const note = document.createElement('p');
    note.textContent = 'Poses rotate the runtime skeleton only; gameplay state and collision stay untouched.';
    note.className = 'voxel-player-harness__card-note';
    const actions = document.createElement('div');
    actions.className = 'voxel-player-harness__actions';
    for (const [pose, label] of [
      ['neutral', 'Neutral'],
      ['ready', 'Ready'],
      ['run', 'Run'],
    ] as const) {
      const button = createButton(label, () => this.setPose(pose));
      button.dataset.pose = pose;
      button.setAttribute('aria-pressed', String(pose === this.pose));
      this.poseButtons.set(pose, button);
      actions.append(button);
    }
    card.append(note, actions);
    return card;
  }

  private createDisplayCard(): HTMLElement {
    const card = createCard('Display');
    card.append(
      createCheckbox('Show skeleton', this.showSkeleton, (checked) => {
        this.showSkeleton = checked;
        if (this.skeletonHelper) {
          this.skeletonHelper.visible = checked;
        }
      }),
      createCheckbox('Show helmet', this.showHelmet, (checked) => {
        this.showHelmet = checked;
        this.syncHelmetVisibility();
      }),
    );
    return card;
  }

  private createAssetCard(): HTMLElement {
    const card = createCard('Runtime contract');
    const list = document.createElement('dl');
    list.className = 'voxel-player-harness__asset-list';
    list.append(
      definition('Body', '/models/player/player-base-rigged.glb'),
      definition('Helmet', '/models/helmet/football-helmet-kit.glb'),
      definition('Mode', 'meshyRigged'),
      definition('Orientation', '+Y up / +Z forward'),
    );
    card.append(list);
    return card;
  }

  private async loadSubject(): Promise<void> {
    try {
      await preloadFootballPlayerVisualAssets('meshyRigged');
      const resource = createFootballPlayerVisual({
        appearanceId: 'voxel-harness-qb',
        footballPosition: 'QB',
        gameplayTeam: 'offense',
        jerseyNumber: 12,
        presentationOnly: true,
        role: 'quarterback',
        rosterPlayerId: 'voxel-harness-qb',
        teamSide: 'user',
        uniform: TEAM_UNIFORM,
        visualId: 'voxel-harness-subject',
      }, {
        helmet: 'required',
        playerVisualOptions: {
          visualMode: 'meshyRigged',
        },
      });
      await resource.ready;
      if (resource.getSnapshot().visualMode !== 'meshyRigged') {
        resource.dispose();
        throw new Error('Rigged player asset loaded through the procedural fallback.');
      }

      this.resource?.dispose();
      this.resource = resource;
      resource.syncTransform({ x: 0, z: 0 }, 0);
      this.scene.add(resource.root);
      this.collectBones(resource.root);
      this.createSkeletonHelper(resource.root);
      this.syncHelmetVisibility();
      this.setPose('neutral');
      this.frameSubject();
      this.loaded = true;
      this.status.textContent = 'Ready — production rig and helmet loaded.';
      this.updateMetrics();
    } catch (error) {
      this.loaded = false;
      this.status.textContent = error instanceof Error ? error.message : String(error);
      this.status.classList.add('voxel-player-harness__status--error');
      this.updateMetrics();
    }
  }

  private collectBones(root: THREE.Object3D): void {
    this.boneMap.clear();
    this.restTransforms.clear();
    root.traverse((object) => {
      if (!(object instanceof THREE.Bone)) {
        return;
      }
      this.boneMap.set(normalizeBoneName(object.name), object);
      this.restTransforms.set(object, {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      });
    });
  }

  private createSkeletonHelper(root: THREE.Object3D): void {
    if (this.skeletonHelper) {
      this.skeletonHelper.removeFromParent();
      this.skeletonHelper.dispose();
    }
    const helper = new THREE.SkeletonHelper(root);
    helper.name = 'voxel-player-harness-skeleton';
    helper.visible = this.showSkeleton;
    helper.renderOrder = 5;
    const material = helper.material as THREE.LineBasicMaterial;
    material.color.set(0x4fffb0);
    material.depthTest = false;
    material.transparent = true;
    material.opacity = 0.92;
    this.skeletonHelper = helper;
    this.scene.add(helper);
  }

  private setPose(pose: HarnessPose): void {
    this.pose = pose;
    this.poseStartSeconds = performance.now() / 1_000;
    this.restoreRestPose();
    if (pose === 'ready') {
      this.applyReadyPose();
    } else if (pose === 'run') {
      this.applyRunPose(0);
    }
    for (const [id, button] of this.poseButtons) {
      button.setAttribute('aria-pressed', String(id === pose));
    }
    this.updateMetrics();
  }

  private restoreRestPose(): void {
    for (const [bone, rest] of this.restTransforms) {
      bone.position.copy(rest.position);
      bone.quaternion.copy(rest.quaternion);
      bone.scale.copy(rest.scale);
    }
  }

  private applyReadyPose(): void {
    this.rotateBone(['hips'], 10, 0, 0);
    this.rotateBone(['spine_01', 'spine02'], 8, 0, 0);
    this.rotateBone(['spine_02', 'spine01'], 6, 0, 0);
    this.rotateBone(['chest', 'spine'], 5, 0, 0);
    this.rotateBone(['head'], -5, 0, 0);
    this.rotateBone(['upper_arm_l', 'leftarm'], 20, 0, -14);
    this.rotateBone(['lower_arm_l', 'leftforearm'], -44, 0, 0);
    this.rotateBone(['upper_arm_r', 'rightarm'], 20, 0, 14);
    this.rotateBone(['lower_arm_r', 'rightforearm'], -44, 0, 0);
    this.rotateBone(['upper_leg_l', 'leftupleg'], 26, 0, 7);
    this.rotateBone(['lower_leg_l', 'leftleg'], -38, 0, 0);
    this.rotateBone(['foot_l', 'leftfoot'], 9, 0, 0);
    this.rotateBone(['upper_leg_r', 'rightupleg'], 26, 0, -7);
    this.rotateBone(['lower_leg_r', 'rightleg'], -38, 0, 0);
    this.rotateBone(['foot_r', 'rightfoot'], 9, 0, 0);
  }

  private applyRunPose(timeSeconds: number): void {
    const phase = timeSeconds * Math.PI * 3.4;
    const stride = Math.sin(phase);
    const kneeLeft = Math.max(0, -stride);
    const kneeRight = Math.max(0, stride);
    this.rotateBone(['hips'], 7, Math.sin(phase * 0.5) * 2, stride * 2.5);
    this.rotateBone(['spine_01', 'spine02'], -4, 0, -stride * 3);
    this.rotateBone(['chest', 'spine'], -3, 0, stride * 4);
    this.rotateBone(['head'], 2, -stride * 2, 0);
    this.rotateBone(['upper_arm_l', 'leftarm'], -stride * 48, 0, -8);
    this.rotateBone(['lower_arm_l', 'leftforearm'], -36 - Math.abs(stride) * 20, 0, 0);
    this.rotateBone(['upper_arm_r', 'rightarm'], stride * 48, 0, 8);
    this.rotateBone(['lower_arm_r', 'rightforearm'], -36 - Math.abs(stride) * 20, 0, 0);
    this.rotateBone(['upper_leg_l', 'leftupleg'], stride * 42, 0, 2);
    this.rotateBone(['lower_leg_l', 'leftleg'], -kneeLeft * 62, 0, 0);
    this.rotateBone(['foot_l', 'leftfoot'], kneeLeft * 18, 0, 0);
    this.rotateBone(['upper_leg_r', 'rightupleg'], -stride * 42, 0, -2);
    this.rotateBone(['lower_leg_r', 'rightleg'], -kneeRight * 62, 0, 0);
    this.rotateBone(['foot_r', 'rightfoot'], kneeRight * 18, 0, 0);
  }

  private rotateBone(names: readonly string[], xDegrees: number, yDegrees: number, zDegrees: number): void {
    const bone = this.findBone(names);
    const rest = bone ? this.restTransforms.get(bone) : null;
    if (!bone || !rest) {
      return;
    }
    DELTA_EULER.set(xDegrees * DEG_TO_RAD, yDegrees * DEG_TO_RAD, zDegrees * DEG_TO_RAD, 'XYZ');
    DELTA_ROTATION.setFromEuler(DELTA_EULER);
    bone.quaternion.copy(rest.quaternion).multiply(DELTA_ROTATION);
  }

  private findBone(names: readonly string[]): THREE.Bone | null {
    for (const name of names) {
      const bone = this.boneMap.get(normalizeBoneName(name));
      if (bone) {
        return bone;
      }
    }
    return null;
  }

  private syncHelmetVisibility(): void {
    const helmet = this.resource?.root.getObjectByName('low-poly-helmet');
    if (helmet) {
      helmet.visible = this.showHelmet;
    }
  }

  private frameSubject(): void {
    if (!this.resource) {
      return;
    }
    this.resource.root.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(this.resource.root);
    bounds.getCenter(SUBJECT_CENTER);
    bounds.getSize(SUBJECT_SIZE);
    SUBJECT_TARGET.set(0, Math.max(0.8, SUBJECT_CENTER.y), 0);
    this.controls.target.copy(SUBJECT_TARGET);
    this.setCamera('front');
  }

  private setCamera(view: 'back' | 'front' | 'high' | 'reset' | 'side'): void {
    const targetY = SUBJECT_TARGET.y;
    const distance = Math.max(3.4, SUBJECT_SIZE.y * 1.9 || 3.8);
    if (view === 'side') {
      this.camera.position.set(distance, targetY + 0.12, 0);
    } else if (view === 'back') {
      this.camera.position.set(0, targetY + 0.12, -distance);
    } else if (view === 'high') {
      this.camera.position.set(distance * 0.7, targetY + distance * 0.58, distance * 0.7);
    } else if (view === 'reset') {
      this.camera.position.set(distance * 0.62, targetY + 0.34, distance * 0.82);
    } else {
      this.camera.position.set(0, targetY + 0.12, distance);
    }
    this.controls.target.copy(SUBJECT_TARGET);
    this.controls.update();
  }

  private updateMetrics(): void {
    const snapshot = this.getSnapshot();
    this.metrics.replaceChildren(
      metric('Status', snapshot.loaded ? 'Ready' : 'Loading'),
      metric('Mode', snapshot.visualMode ?? 'pending'),
      metric('Pose', snapshot.pose),
      metric('Bones', String(snapshot.boneCount)),
      metric('Meshes', String(snapshot.meshCount)),
      metric('Triangles', snapshot.triangleCount.toLocaleString()),
      metric('Helmet', snapshot.helmetAttached ? 'Attached' : 'Missing'),
      metric('Draw calls', String(snapshot.drawCalls)),
    );
  }

  private getSnapshot(): VoxelPlayerHarnessSnapshot {
    const root = this.resource?.root ?? null;
    const helmet = root?.getObjectByName('low-poly-helmet') ?? null;
    const headAnchor = root?.getObjectByName(PLAYER_HEAD_ANCHOR_NAME) ?? null;
    const counts = countSceneResources(root);
    return {
      boneCount: counts.boneCount,
      drawCalls: this.renderer.info.render.calls,
      geometries: this.renderer.info.memory.geometries,
      headAnchorName: headAnchor?.name ?? null,
      helmetAttached: Boolean(helmet),
      helmetParentName: helmet?.parent?.name ?? null,
      helmetVisible: helmet?.visible ?? false,
      loaded: this.loaded,
      meshCount: counts.meshCount,
      pose: this.pose,
      route: 'voxel-player-harness',
      textures: this.renderer.info.memory.textures,
      triangleCount: counts.triangleCount,
      visualMode: this.resource?.getSnapshot().visualMode ?? null,
    };
  }

  private readonly resize = (): void => {
    const rect = this.viewport.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private readonly animate = (timestampMilliseconds: number): void => {
    const timestampSeconds = timestampMilliseconds / 1_000;
    const delta = this.previousFrameSeconds === 0
      ? 0
      : Math.min(Math.max(0, timestampSeconds - this.previousFrameSeconds), 0.05);
    this.previousFrameSeconds = timestampSeconds;
    if (this.pose === 'run' && this.loaded) {
      this.restoreRestPose();
      this.applyRunPose(Math.max(0, timestampSeconds - this.poseStartSeconds));
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.metricsAccumulator += delta;
    if (this.metricsAccumulator >= 0.5) {
      this.metricsAccumulator = 0;
      this.updateMetrics();
    }
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private readonly dispose = (): void => {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.skeletonHelper?.dispose();
    this.resource?.dispose();
    this.renderer.dispose();
    delete window.__VOXEL_PLAYER_HARNESS__;
  };
}

function normalizeBoneName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function countSceneResources(root: THREE.Object3D | null): {
  boneCount: number;
  meshCount: number;
  triangleCount: number;
} {
  let boneCount = 0;
  let meshCount = 0;
  let triangleCount = 0;
  root?.traverse((object) => {
    if (object instanceof THREE.Bone) {
      boneCount += 1;
    }
    if (object instanceof THREE.Mesh) {
      meshCount += 1;
      triangleCount += countTriangles(object.geometry);
    }
  });
  return { boneCount, meshCount, triangleCount };
}

function countTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }
  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}

function createCard(titleText: string): HTMLElement {
  const card = document.createElement('section');
  card.className = 'voxel-player-harness__card';
  const heading = document.createElement('h2');
  heading.textContent = titleText;
  card.append(heading);
  return card;
}

function createButton(label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

function createCheckbox(
  labelText: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'voxel-player-harness__check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.setAttribute('aria-label', labelText);
  input.addEventListener('change', () => onChange(input.checked));
  const text = document.createElement('span');
  text.textContent = labelText;
  label.append(input, text);
  return label;
}

function metric(labelText: string, value: string): HTMLElement {
  const item = document.createElement('div');
  const label = document.createElement('span');
  label.textContent = labelText;
  const output = document.createElement('strong');
  output.textContent = value;
  item.append(label, output);
  return item;
}

function definition(termText: string, value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const term = document.createElement('dt');
  term.textContent = termText;
  const definition = document.createElement('dd');
  definition.textContent = value;
  fragment.append(term, definition);
  return fragment;
}

const root = document.querySelector<HTMLElement>('#voxel-player-harness');
if (!root) {
  throw new Error('Missing #voxel-player-harness root');
}

new VoxelPlayerHarness(root);
