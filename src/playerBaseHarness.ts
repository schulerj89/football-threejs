import './playerBaseHarness.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Axis = 'x' | 'y' | 'z';

interface BoneControl {
  axis: Axis;
  boneName: string;
  label: string;
  max: number;
  min: number;
  value: number;
}

interface PosePreset {
  id: string;
  displayName: string;
  notes: string;
  values: Record<string, number>;
}

interface HarnessSnapshot {
  boneCount: number;
  controlCount: number;
  currentPresetId: string;
  loaded: boolean;
  meshCount: number;
  route: 'player-base-harness';
  triangleCount: number;
}

declare global {
  interface Window {
    __PLAYER_BASE_HARNESS__?: {
      getSnapshot: () => HarnessSnapshot;
    };
  }
}

const PLAYER_BASE_ASSET_URL = '/art-source/meshy/player-base/rigged/player-base-rigged.glb';
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const BONE_CONTROLS: readonly BoneControl[] = [
  createControl('Hips', 'x', 'Hips pitch', -55, 55),
  createControl('Hips', 'y', 'Hips yaw', -35, 35),
  createControl('Hips', 'z', 'Hips roll', -35, 35),
  createControl('Spine', 'x', 'Lower spine pitch', -45, 45),
  createControl('Spine01', 'x', 'Mid spine pitch', -45, 45),
  createControl('Spine02', 'x', 'Upper spine pitch', -45, 45),
  createControl('neck', 'x', 'Neck pitch', -40, 40),
  createControl('Head', 'x', 'Head pitch', -40, 40),
  createControl('Head', 'y', 'Head yaw', -55, 55),

  createControl('LeftShoulder', 'z', 'Left shoulder lift', -55, 55),
  createControl('LeftArm', 'x', 'Left upper arm pitch', -120, 120),
  createControl('LeftArm', 'y', 'Left upper arm yaw', -85, 85),
  createControl('LeftArm', 'z', 'Left upper arm roll', -90, 90),
  createControl('LeftForeArm', 'x', 'Left elbow bend', -145, 145),
  createControl('LeftHand', 'x', 'Left wrist pitch', -75, 75),
  createControl('LeftHand', 'z', 'Left wrist roll', -75, 75),

  createControl('RightShoulder', 'z', 'Right shoulder lift', -55, 55),
  createControl('RightArm', 'x', 'Right upper arm pitch', -120, 120),
  createControl('RightArm', 'y', 'Right upper arm yaw', -85, 85),
  createControl('RightArm', 'z', 'Right upper arm roll', -90, 90),
  createControl('RightForeArm', 'x', 'Right elbow bend', -145, 145),
  createControl('RightHand', 'x', 'Right wrist pitch', -75, 75),
  createControl('RightHand', 'z', 'Right wrist roll', -75, 75),

  createControl('LeftUpLeg', 'x', 'Left hip pitch', -95, 95),
  createControl('LeftUpLeg', 'y', 'Left hip yaw', -55, 55),
  createControl('LeftUpLeg', 'z', 'Left hip roll', -55, 55),
  createControl('LeftLeg', 'x', 'Left knee bend', -120, 120),
  createControl('LeftFoot', 'x', 'Left ankle pitch', -70, 70),
  createControl('LeftFoot', 'z', 'Left ankle roll', -50, 50),
  createControl('LeftToeBase', 'x', 'Left toe pitch', -55, 55),

  createControl('RightUpLeg', 'x', 'Right hip pitch', -95, 95),
  createControl('RightUpLeg', 'y', 'Right hip yaw', -55, 55),
  createControl('RightUpLeg', 'z', 'Right hip roll', -55, 55),
  createControl('RightLeg', 'x', 'Right knee bend', -120, 120),
  createControl('RightFoot', 'x', 'Right ankle pitch', -70, 70),
  createControl('RightFoot', 'z', 'Right ankle roll', -50, 50),
  createControl('RightToeBase', 'x', 'Right toe pitch', -55, 55),
];

const PRESETS: readonly PosePreset[] = [
  {
    displayName: 'Offensive Lineman',
    id: 'offensive_lineman',
    notes: 'Low two-point stance with hips back, knees loaded, chest forward, and hands ready inside.',
    values: {
      'Hips.x': 18,
      'Spine.x': 14,
      'Spine01.x': 12,
      'Spine02.x': 10,
      'Head.x': -7,
      'LeftArm.x': 20,
      'LeftArm.z': -18,
      'LeftForeArm.x': -42,
      'RightArm.x': 20,
      'RightArm.z': 18,
      'RightForeArm.x': -42,
      'LeftUpLeg.x': 42,
      'LeftUpLeg.z': -10,
      'LeftLeg.x': -58,
      'LeftFoot.x': 14,
      'RightUpLeg.x': 42,
      'RightUpLeg.z': 10,
      'RightLeg.x': -58,
      'RightFoot.x': 14,
    },
  },
  {
    displayName: 'Defensive Lineman',
    id: 'defensive_lineman',
    notes: 'Lower three-point look with more forward torso, deeper knee bend, and one hand dropped toward the turf.',
    values: {
      'Hips.x': 26,
      'Spine.x': 18,
      'Spine01.x': 18,
      'Spine02.x': 12,
      'Head.x': -10,
      'LeftArm.x': 28,
      'LeftArm.z': -28,
      'LeftForeArm.x': -38,
      'RightArm.x': 74,
      'RightArm.z': 22,
      'RightForeArm.x': -18,
      'RightHand.x': 32,
      'LeftUpLeg.x': 52,
      'LeftUpLeg.z': -14,
      'LeftLeg.x': -72,
      'LeftFoot.x': 18,
      'RightUpLeg.x': 56,
      'RightUpLeg.z': 12,
      'RightLeg.x': -76,
      'RightFoot.x': 20,
    },
  },
  {
    displayName: 'Quarterback',
    id: 'quarterback',
    notes: 'Balanced under-center idle with slight knee bend, quiet torso, and hands staged near the snap point.',
    values: {
      'Hips.x': 5,
      'Spine.x': 4,
      'Spine01.x': 3,
      'Head.x': -2,
      'LeftArm.x': 8,
      'LeftArm.y': -10,
      'LeftArm.z': -12,
      'LeftForeArm.x': -55,
      'RightArm.x': 10,
      'RightArm.y': 10,
      'RightArm.z': 12,
      'RightForeArm.x': -55,
      'LeftUpLeg.x': 12,
      'LeftLeg.x': -18,
      'LeftFoot.x': 5,
      'RightUpLeg.x': 12,
      'RightLeg.x': -18,
      'RightFoot.x': 5,
    },
  },
  {
    displayName: 'Running Back',
    id: 'running_back',
    notes: 'Two-point skill stance: feet active, knees bent, hips loaded, and elbows relaxed near the thigh pads.',
    values: {
      'Hips.x': 15,
      'Spine.x': 12,
      'Spine01.x': 8,
      'Spine02.x': 5,
      'Head.x': -5,
      'LeftArm.x': 22,
      'LeftArm.z': -16,
      'LeftForeArm.x': -48,
      'RightArm.x': 22,
      'RightArm.z': 16,
      'RightForeArm.x': -48,
      'LeftUpLeg.x': 28,
      'LeftUpLeg.z': -7,
      'LeftLeg.x': -40,
      'LeftFoot.x': 10,
      'RightUpLeg.x': 26,
      'RightUpLeg.z': 7,
      'RightLeg.x': -38,
      'RightFoot.x': 10,
    },
  },
];

class PlayerBaseHarness {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly controls: OrbitControls;
  private readonly loader = new GLTFLoader();
  private readonly viewport = document.createElement('section');
  private readonly panel = document.createElement('aside');
  private readonly toolbar = document.createElement('div');
  private readonly metrics = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly presetSelect = document.createElement('select');
  private readonly notes = document.createElement('div');
  private readonly controlRoot = document.createElement('div');
  private readonly labelsLayer = document.createElement('div');
  private readonly skeletonHelperRoot = new THREE.Group();
  private readonly boneMap = new Map<string, THREE.Bone>();
  private readonly restRotations = new Map<string, THREE.Euler>();
  private readonly values = new Map<string, number>();
  private currentPresetId = PRESETS[0]!.id;
  private modelRoot: THREE.Object3D | null = null;
  private skeletonHelper: THREE.SkeletonHelper | null = null;
  private showSkeleton = true;
  private showJointNames = false;
  private animationFrame = 0;

  constructor(private readonly root: HTMLElement) {
    this.root.className = 'player-base-harness';
    this.viewport.className = 'player-base-harness__viewport';
    this.panel.className = 'player-base-harness__panel';
    this.toolbar.className = 'player-base-harness__toolbar';
    this.metrics.className = 'player-base-harness__metrics';
    this.status.className = 'player-base-harness__status';
    this.notes.className = 'player-base-harness__note';
    this.labelsLayer.className = 'player-base-harness__joint-label-layer';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x08100d);
    this.viewport.append(this.renderer.domElement, this.toolbar, this.labelsLayer);
    this.root.append(this.viewport, this.panel);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.95, 0);
  }

  start(): void {
    this.setupScene();
    this.buildPanel();
    this.resize();
    window.addEventListener('resize', this.resize);
    window.__PLAYER_BASE_HARNESS__ = {
      getSnapshot: () => this.getSnapshot(),
    };
    this.animate();
    void this.loadModel();
  }

  private setupScene(): void {
    this.scene.name = 'player-base-rig-harness-scene';
    this.scene.background = new THREE.Color(0x08100d);
    this.camera.position.set(3.1, 1.75, 4.2);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xe9f5ff, 0x14231b, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3.8, 4.8, 3.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x85bfff, 1.25);
    rim.position.set(-3, 2.8, -4);
    this.scene.add(rim);

    const grid = new THREE.GridHelper(7, 14, 0x4b6b58, 0x24352b);
    grid.name = 'player-base-harness-grid';
    this.scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshStandardMaterial({ color: 0x101a14, roughness: 0.94, metalness: 0.02 }),
    );
    ground.name = 'player-base-harness-ground';
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.006;
    this.scene.add(ground);

    this.skeletonHelperRoot.name = 'player-base-harness-skeleton-helpers';
    this.scene.add(this.skeletonHelperRoot);
    this.createCameraToolbar();
  }

  private buildPanel(): void {
    const title = document.createElement('h1');
    title.textContent = 'Player Base Rig Harness';
    const subtitle = document.createElement('div');
    subtitle.className = 'player-base-harness__note';
    subtitle.textContent = 'Rigged GLB source: art-source/meshy/player-base/rigged/player-base-rigged.glb';

    this.panel.append(
      title,
      subtitle,
      this.createMetricsCard(),
      this.createPresetCard(),
      this.createControlCard(),
      this.status,
    );
    this.rebuildControls();
    this.applyPreset(this.currentPresetId, { silent: true });
  }

  private createCameraToolbar(): void {
    const buttons: Array<[string, () => void]> = [
      ['Front', () => this.setCamera(0, 1.35, 4.8)],
      ['Side', () => this.setCamera(4.8, 1.35, 0)],
      ['Back', () => this.setCamera(0, 1.35, -4.8)],
      ['Low', () => this.setCamera(2.8, 0.85, 3.5)],
      ['Reset', () => this.setCamera(3.1, 1.75, 4.2)],
    ];
    this.toolbar.replaceChildren(...buttons.map(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      return button;
    }));
  }

  private createMetricsCard(): HTMLElement {
    const card = createCard('Rig Metrics');
    card.append(this.metrics);
    this.syncMetrics();
    return card;
  }

  private createPresetCard(): HTMLElement {
    const card = createCard('Presets');
    this.presetSelect.replaceChildren(...PRESETS.map((preset) => new Option(preset.displayName, preset.id)));
    this.presetSelect.value = this.currentPresetId;
    this.presetSelect.addEventListener('change', () => this.applyPreset(this.presetSelect.value));
    const resetButton = createButton('Zero Pose', () => this.resetPose());
    const copyButton = createButton('Copy Angles JSON', () => void this.copyPoseJson());
    const skeletonButton = createButton('Skeleton', () => {
      this.showSkeleton = !this.showSkeleton;
      this.syncHelpers();
    });
    const labelsButton = createButton('Joint Names', () => {
      this.showJointNames = !this.showJointNames;
      this.syncHelpers();
    });
    card.append(
      createSelectRow('Stance', this.presetSelect),
      this.notes,
      createActions([resetButton, copyButton, skeletonButton, labelsButton]),
    );
    this.notes.textContent = PRESETS[0]!.notes;
    return card;
  }

  private createControlCard(): HTMLElement {
    const card = createCard('Bone Angles');
    card.append(this.controlRoot);
    return card;
  }

  private async loadModel(): Promise<void> {
    this.setStatus('Loading rigged player base...');
    try {
      const gltf = await this.loader.loadAsync(PLAYER_BASE_ASSET_URL);
      this.modelRoot?.removeFromParent();
      this.modelRoot = gltf.scene;
      this.modelRoot.name = 'art-source-player-base-rigged';
      this.modelRoot.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = false;
          object.receiveShadow = true;
          object.frustumCulled = false;
        }
        if (object instanceof THREE.Bone) {
          this.boneMap.set(object.name, object);
          this.restRotations.set(object.name, object.rotation.clone());
        }
      });
      this.scene.add(this.modelRoot);
      this.fitModelToGround();
      this.createSkeletonHelper();
      this.applyCurrentValues();
      this.syncMetrics();
      this.syncHelpers();
      this.setStatus(`Loaded ${this.boneMap.size} bones from art-source.`);
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private fitModelToGround(): void {
    if (!this.modelRoot) {
      return;
    }
    this.modelRoot.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    this.modelRoot.position.y -= box.min.y;
    this.modelRoot.updateWorldMatrix(true, true);
  }

  private createSkeletonHelper(): void {
    this.skeletonHelper?.dispose();
    this.skeletonHelperRoot.clear();
    if (!this.modelRoot) {
      return;
    }
    this.skeletonHelper = new THREE.SkeletonHelper(this.modelRoot);
    this.skeletonHelper.name = 'player-base-harness-skeleton';
    this.skeletonHelper.visible = this.showSkeleton;
    this.skeletonHelperRoot.add(this.skeletonHelper);
  }

  private rebuildControls(): void {
    this.controlRoot.replaceChildren(...BONE_CONTROLS.map((control) => this.createAngleSlider(control)));
  }

  private createAngleSlider(control: BoneControl): HTMLElement {
    const key = getControlKey(control);
    if (!this.values.has(key)) {
      this.values.set(key, control.value);
    }
    const currentValue = this.values.get(key) ?? control.value;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = '1';
    input.value = String(currentValue);
    input.dataset.poseKey = key;
    const output = document.createElement('output');
    output.textContent = `${currentValue} deg`;
    input.addEventListener('input', () => {
      const nextValue = Number(input.value);
      this.values.set(key, nextValue);
      output.textContent = `${nextValue} deg`;
      this.applyCurrentValues();
      this.currentPresetId = 'custom';
      this.presetSelect.value = '';
      this.notes.textContent = 'Custom angle edit.';
    });
    const stack = document.createElement('div');
    stack.className = 'player-base-harness__slider-stack';
    stack.append(input, output);
    const row = document.createElement('div');
    row.className = 'player-base-harness__row';
    const label = document.createElement('label');
    label.textContent = control.label;
    label.htmlFor = `${key}-input`;
    input.id = `${key}-input`;
    row.append(label, stack);
    return row;
  }

  private applyPreset(presetId: string, options: { silent?: boolean } = {}): void {
    const preset = PRESETS.find((candidate) => candidate.id === presetId) ?? PRESETS[0]!;
    this.currentPresetId = preset.id;
    this.presetSelect.value = preset.id;
    this.notes.textContent = preset.notes;
    for (const control of BONE_CONTROLS) {
      const key = getControlKey(control);
      this.values.set(key, preset.values[key] ?? 0);
    }
    this.syncControlInputs();
    this.applyCurrentValues();
    if (!options.silent) {
      this.setStatus(`Applied ${preset.displayName}.`);
    }
  }

  private resetPose(): void {
    this.currentPresetId = 'custom';
    this.presetSelect.value = '';
    this.notes.textContent = 'All tracked bones reset to their rig rest rotations.';
    for (const control of BONE_CONTROLS) {
      this.values.set(getControlKey(control), 0);
    }
    this.syncControlInputs();
    this.applyCurrentValues();
    this.setStatus('Zeroed editable rig angles.');
  }

  private applyCurrentValues(): void {
    for (const [boneName, bone] of this.boneMap) {
      const rest = this.restRotations.get(boneName);
      if (rest) {
        bone.rotation.copy(rest);
      }
    }
    for (const control of BONE_CONTROLS) {
      const bone = this.boneMap.get(control.boneName);
      if (!bone) {
        continue;
      }
      const radians = (this.values.get(getControlKey(control)) ?? 0) * DEG_TO_RAD;
      bone.rotation[control.axis] += radians;
    }
    this.modelRoot?.updateWorldMatrix(true, true);
    this.syncHelpers();
    this.syncMetrics();
  }

  private syncControlInputs(): void {
    for (const input of this.controlRoot.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      const key = input.dataset.poseKey;
      if (!key) {
        continue;
      }
      const value = this.values.get(key) ?? 0;
      input.value = String(value);
      const output = input.parentElement?.querySelector('output');
      if (output) {
        output.textContent = `${value} deg`;
      }
    }
  }

  private async copyPoseJson(): Promise<void> {
    const nonZeroEntries = [...this.values.entries()]
      .filter(([, value]) => Math.abs(value) > 0.001)
      .sort(([a], [b]) => a.localeCompare(b));
    const payload = {
      assetUrl: PLAYER_BASE_ASSET_URL,
      currentPresetId: this.currentPresetId,
      degrees: Object.fromEntries(nonZeroEntries),
      units: 'degrees',
    };
    await navigator.clipboard?.writeText(`${JSON.stringify(payload, null, 2)}\n`);
    this.setStatus('Copied current non-zero bone angles as JSON.');
  }

  private syncMetrics(): void {
    const counts = this.modelRoot ? countSceneResources(this.modelRoot) : {
      meshCount: 0,
      triangleCount: 0,
    };
    this.metrics.replaceChildren(
      metric('Asset', 'art-source rigged GLB'),
      metric('Bones', String(this.boneMap.size)),
      metric('Controls', String(BONE_CONTROLS.length)),
      metric('Meshes', String(counts.meshCount)),
      metric('Triangles', String(counts.triangleCount)),
      metric('Preset', this.currentPresetId),
    );
  }

  private syncHelpers(): void {
    if (this.skeletonHelper) {
      this.skeletonHelper.visible = this.showSkeleton;
    }
    this.labelsLayer.hidden = !this.showJointNames;
    this.labelsLayer.replaceChildren();
    if (!this.showJointNames) {
      return;
    }
    for (const boneName of this.getMajorBoneNames()) {
      const bone = this.boneMap.get(boneName);
      if (!bone) {
        continue;
      }
      this.labelsLayer.append(this.createJointLabel(boneName, bone));
    }
  }

  private createJointLabel(name: string, object: THREE.Object3D): HTMLElement {
    const label = document.createElement('div');
    label.className = 'player-base-harness__joint-label';
    label.textContent = name;
    const world = object.getWorldPosition(new THREE.Vector3());
    const projected = world.project(this.camera);
    const rect = this.viewport.getBoundingClientRect();
    label.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
    return label;
  }

  private getMajorBoneNames(): string[] {
    return [
      'Hips',
      'Spine',
      'Spine01',
      'Spine02',
      'Head',
      'LeftArm',
      'LeftForeArm',
      'LeftHand',
      'RightArm',
      'RightForeArm',
      'RightHand',
      'LeftUpLeg',
      'LeftLeg',
      'LeftFoot',
      'RightUpLeg',
      'RightLeg',
      'RightFoot',
    ];
  }

  private animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private resize = (): void => {
    const rect = this.viewport.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private setCamera(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
    this.controls.target.set(0, 0.95, 0);
    this.controls.update();
    this.syncHelpers();
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
  }

  private getSnapshot(): HarnessSnapshot {
    const counts = this.modelRoot ? countSceneResources(this.modelRoot) : {
      meshCount: 0,
      triangleCount: 0,
    };
    return {
      boneCount: this.boneMap.size,
      controlCount: BONE_CONTROLS.length,
      currentPresetId: this.currentPresetId,
      loaded: Boolean(this.modelRoot),
      meshCount: counts.meshCount,
      route: 'player-base-harness',
      triangleCount: counts.triangleCount,
    };
  }
}

function createControl(
  boneName: string,
  axis: Axis,
  label: string,
  min: number,
  max: number,
  value = 0,
): BoneControl {
  return { axis, boneName, label, max, min, value };
}

function getControlKey(control: Pick<BoneControl, 'axis' | 'boneName'>): string {
  return `${control.boneName}.${control.axis}`;
}

function createCard(title: string): HTMLElement {
  const card = document.createElement('section');
  card.className = 'player-base-harness__card';
  const heading = document.createElement('h2');
  heading.textContent = title;
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

function createActions(buttons: HTMLButtonElement[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'player-base-harness__actions';
  row.append(...buttons);
  return row;
}

function createSelectRow(label: string, select: HTMLSelectElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'player-base-harness__row';
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  select.id ||= `${label.toLowerCase().replace(/\s+/g, '-')}-select`;
  labelElement.htmlFor = select.id;
  row.append(labelElement, select);
  return row;
}

function metric(label: string, value: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = `<span>${label}</span><br>${value}`;
  return element;
}

function countSceneResources(root: THREE.Object3D): {
  meshCount: number;
  triangleCount: number;
} {
  let meshCount = 0;
  let triangleCount = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    meshCount += 1;
    triangleCount += countTriangles(object.geometry);
  });
  return { meshCount, triangleCount };
}

function countTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return Math.floor(geometry.index.count / 3);
  }
  const position = geometry.getAttribute('position');
  return position ? Math.floor(position.count / 3) : 0;
}

const mount = document.querySelector<HTMLDivElement>('#player-base-harness');
if (!mount) {
  throw new Error('Missing #player-base-harness mount');
}

const app = new PlayerBaseHarness(mount);
app.start();
