import './playerAnimationHarness.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonHelper } from 'three';
import playerUrl from '../low_poly_player.glb?url';
import helmetUrl from '../low_poly_helmet.glb?url';

interface PlayerAnimationHarnessSnapshot {
  animationCount: number;
  activeClip: string | null;
  boneCount: number;
  bodyLabelCount: number;
  colorControlCount: number;
  drawCalls: number;
  geometries: number;
  helmetAttached: boolean;
  helmetParentName: string | null;
  loaded: boolean;
  meshCount: number;
  route: 'player-animation-harness';
  textures: number;
  triangleCount: number;
}

declare global {
  interface Window {
    __LOW_POLY_PLAYER_ANIMATION_HARNESS__?: {
      getSnapshot: () => PlayerAnimationHarnessSnapshot;
    };
  }
}

const loader = new GLTFLoader();
const PLAYER_CENTER = new THREE.Vector3();
const PLAYER_SIZE = new THREE.Vector3();
const HELMET_CENTER = new THREE.Vector3();
const LABEL_POSITION = new THREE.Vector3();

interface HelmetColors {
  faceguard: string;
  helmetShell: string;
  helmetStripe: string;
}

interface BodyLabelDefinition {
  displayName: string;
  objectName: string;
}

const DEFAULT_HELMET_COLORS: HelmetColors = {
  faceguard: '#f2f4f6',
  helmetShell: '#2f66d8',
  helmetStripe: '#f2d94b',
};

const HELMET_COLOR_CONTROLS: Array<{ key: keyof HelmetColors; label: string }> = [
  { key: 'helmetShell', label: 'Helmet shell' },
  { key: 'faceguard', label: 'Faceguard' },
  { key: 'helmetStripe', label: 'Helmet stripe' },
];

const BODY_LABELS: BodyLabelDefinition[] = [
  { displayName: 'Head', objectName: 'Head' },
  { displayName: 'Neck', objectName: 'neck' },
  { displayName: 'Chest', objectName: 'Spine' },
  { displayName: 'Mid Spine', objectName: 'Spine01' },
  { displayName: 'Hips', objectName: 'Hips' },
  { displayName: 'L Shoulder', objectName: 'LeftShoulder' },
  { displayName: 'L Upper Arm', objectName: 'LeftArm' },
  { displayName: 'L Forearm', objectName: 'LeftForeArm' },
  { displayName: 'L Hand', objectName: 'LeftHand' },
  { displayName: 'R Shoulder', objectName: 'RightShoulder' },
  { displayName: 'R Upper Arm', objectName: 'RightArm' },
  { displayName: 'R Forearm', objectName: 'RightForeArm' },
  { displayName: 'R Hand', objectName: 'RightHand' },
  { displayName: 'L Thigh', objectName: 'LeftUpLeg' },
  { displayName: 'L Knee', objectName: 'LeftLeg' },
  { displayName: 'L Foot', objectName: 'LeftFoot' },
  { displayName: 'R Thigh', objectName: 'RightUpLeg' },
  { displayName: 'R Knee', objectName: 'RightLeg' },
  { displayName: 'R Foot', objectName: 'RightFoot' },
];

const BONE_COLOR_ALIASES: Record<string, string> = {
  Spine02: 'Spine',
  head_end: 'Head',
  headfront: 'Head',
  LeftToeBase: 'LeftFoot',
  RightToeBase: 'RightFoot',
};

class PlayerAnimationHarness {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly clock = new THREE.Clock();
  private readonly controls: OrbitControls;
  private readonly viewport = document.createElement('section');
  private readonly panel = document.createElement('aside');
  private readonly labelsLayer = document.createElement('div');
  private readonly metrics = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly clipSelect = document.createElement('select');
  private readonly playButton = document.createElement('button');
  private readonly timeSlider = document.createElement('input');
  private readonly timeOutput = document.createElement('output');
  private readonly speedSlider = document.createElement('input');
  private readonly speedOutput = document.createElement('output');
  private readonly helperRoot = new THREE.Group();
  private readonly helmetRoot = new THREE.Group();
  private readonly skeletonHolder = new THREE.Group();
  private readonly bodyLabels = new Map<string, HTMLElement>();
  private readonly bodyPartColors = createDefaultBodyPartColors();
  private readonly helmetColors: HelmetColors = { ...DEFAULT_HELMET_COLORS };
  private mixer: THREE.AnimationMixer | null = null;
  private currentAction: THREE.AnimationAction | null = null;
  private playerRoot: THREE.Object3D | null = null;
  private skeletonHelper: SkeletonHelper | null = null;
  private clips: THREE.AnimationClip[] = [];
  private activeClipName: string | null = null;
  private loaded = false;
  private playing = true;
  private speed = 1;
  private helmetScale = 0.12;
  private helmetOffset = new THREE.Vector3(0, 0.09, 0.02);
  private helmetRotation = new THREE.Euler(0, 0, 0);
  private wireframe = false;
  private showSkeleton = false;
  private showBodyLabels = true;
  private animationFrame = 0;
  private metricsAccumulator = 0;

  constructor(private readonly root: HTMLElement) {
    this.root.className = 'player-animation-harness';
    this.viewport.className = 'player-animation-harness__viewport';
    this.panel.className = 'player-animation-harness__panel';
    this.labelsLayer.className = 'player-animation-harness__label-layer';
    this.metrics.className = 'player-animation-harness__metrics';
    this.status.className = 'player-animation-harness__status';
    this.helperRoot.name = 'player-animation-harness-helpers';
    this.helmetRoot.name = 'low-poly-helmet';
    this.skeletonHolder.name = 'player-animation-harness-skeleton-holder';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x07100e);
    this.renderer.shadowMap.enabled = true;
    this.viewport.append(this.renderer.domElement, this.labelsLayer);
    this.root.append(this.viewport, this.panel);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.92, 0);
  }

  start(): void {
    this.setupScene();
    this.buildPanel();
    void this.loadAssets();
    window.addEventListener('resize', this.resize);
    this.resize();
    this.animate();
    window.__LOW_POLY_PLAYER_ANIMATION_HARNESS__ = {
      getSnapshot: () => this.getSnapshot(),
    };
  }

  private setupScene(): void {
    this.scene.name = 'low-poly-player-animation-harness-scene';
    this.scene.background = new THREE.Color(0x07100e);
    this.camera.position.set(2.8, 1.55, 3.4);
    this.camera.lookAt(0, 0.92, 0);
    this.controls.update();
    this.scene.add(this.camera);

    this.scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x17231d, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3.4, 5.5, 3.2);
    key.castShadow = true;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x91b7ff, 1);
    rim.position.set(-3, 2.4, -3.5);
    this.scene.add(rim);

    const grid = new THREE.GridHelper(6, 12, 0x385246, 0x203029);
    grid.name = 'player-animation-harness-grid';
    this.scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshStandardMaterial({ color: 0x101a15, roughness: 0.9 }),
    );
    ground.name = 'player-animation-harness-ground';
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.006;
    ground.receiveShadow = true;
    this.scene.add(ground, this.helperRoot);
    this.helperRoot.add(this.skeletonHolder);
  }

  private buildPanel(): void {
    const title = document.createElement('h1');
    title.textContent = 'Low Poly Player Animation Harness';
    const note = document.createElement('div');
    note.className = 'player-animation-harness__note';
    note.textContent = 'Loads low_poly_player.glb, adds simple uniform color, attaches low_poly_helmet.glb to the head, and plays the embedded clips.';

    this.panel.append(
      title,
      note,
      this.createCameraToolbar(),
      this.createMetricsCard(),
      this.createAnimationCard(),
      this.createColorCard(),
      this.createHelmetCard(),
      this.createDisplayCard(),
      this.status,
    );
    this.setStatus('Loading player and helmet GLBs...');
  }

  private createCameraToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'player-animation-harness__toolbar';
    const buttons: Array<[string, () => void]> = [
      ['Front', () => this.setCamera(0, 1.35, 4)],
      ['Side', () => this.setCamera(4, 1.35, 0)],
      ['Back', () => this.setCamera(0, 1.35, -4)],
      ['High', () => this.setCamera(2.6, 2.5, 3.2)],
      ['Reset', () => this.setCamera(2.8, 1.55, 3.4)],
    ];
    for (const [label, action] of buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      toolbar.append(button);
    }
    this.viewport.append(toolbar);
    return document.createElement('span');
  }

  private createMetricsCard(): HTMLElement {
    const card = createCard('Asset status');
    card.append(this.metrics);
    this.updateMetrics();
    return card;
  }

  private createAnimationCard(): HTMLElement {
    const card = createCard('Animation');
    this.clipSelect.setAttribute('aria-label', 'Animation clip');
    this.clipSelect.addEventListener('change', () => {
      this.setActiveClip(this.clipSelect.value);
    });

    this.playButton.type = 'button';
    this.playButton.textContent = 'Pause';
    this.playButton.addEventListener('click', () => {
      this.playing = !this.playing;
      this.syncActionPause();
      this.updatePlayButton();
    });

    const restart = document.createElement('button');
    restart.type = 'button';
    restart.textContent = 'Restart';
    restart.addEventListener('click', () => this.seek(0));

    const step = document.createElement('button');
    step.type = 'button';
    step.textContent = 'Step';
    step.addEventListener('click', () => {
      const duration = this.currentAction?.getClip().duration ?? 0;
      this.seek(Math.min((this.currentAction?.time ?? 0) + 0.1, duration));
    });

    this.timeSlider.type = 'range';
    this.timeSlider.min = '0';
    this.timeSlider.max = '1';
    this.timeSlider.step = '0.01';
    this.timeSlider.value = '0';
    this.timeSlider.setAttribute('aria-label', 'Animation time');
    this.timeSlider.addEventListener('input', () => {
      this.playing = false;
      this.syncActionPause();
      this.updatePlayButton();
      this.seek(Number(this.timeSlider.value));
    });

    this.speedSlider.type = 'range';
    this.speedSlider.min = '0';
    this.speedSlider.max = '2';
    this.speedSlider.step = '0.05';
    this.speedSlider.value = String(this.speed);
    this.speedSlider.setAttribute('aria-label', 'Animation speed');
    this.speedSlider.addEventListener('input', () => {
      this.speed = Number(this.speedSlider.value);
      this.speedOutput.value = `${this.speed.toFixed(2)}x`;
    });
    this.speedOutput.value = `${this.speed.toFixed(2)}x`;

    card.append(
      createRow('Clip', this.clipSelect),
      createActions([this.playButton, restart, step]),
      createRangeRow('Time', this.timeSlider, this.timeOutput),
      createRangeRow('Speed', this.speedSlider, this.speedOutput),
    );
    return card;
  }

  private createHelmetCard(): HTMLElement {
    const card = createCard('Helmet fit');
    card.append(
      this.createNumberControl('Scale', 0.05, 0.25, 0.005, this.helmetScale, (value) => {
        this.helmetScale = value;
        this.applyHelmetTransform();
      }),
      this.createNumberControl('Offset X', -0.2, 0.2, 0.005, this.helmetOffset.x, (value) => {
        this.helmetOffset.x = value;
        this.applyHelmetTransform();
      }),
      this.createNumberControl('Offset Y', -0.05, 0.25, 0.005, this.helmetOffset.y, (value) => {
        this.helmetOffset.y = value;
        this.applyHelmetTransform();
      }),
      this.createNumberControl('Offset Z', -0.2, 0.2, 0.005, this.helmetOffset.z, (value) => {
        this.helmetOffset.z = value;
        this.applyHelmetTransform();
      }),
      this.createNumberControl('Yaw', -180, 180, 1, THREE.MathUtils.radToDeg(this.helmetRotation.y), (value) => {
        this.helmetRotation.y = THREE.MathUtils.degToRad(value);
        this.applyHelmetTransform();
      }),
      this.createNumberControl('Pitch', -180, 180, 1, THREE.MathUtils.radToDeg(this.helmetRotation.x), (value) => {
        this.helmetRotation.x = THREE.MathUtils.degToRad(value);
        this.applyHelmetTransform();
      }),
    );
    return card;
  }

  private createColorCard(): HTMLElement {
    const card = createCard('Body part colors');
    const note = document.createElement('div');
    note.className = 'player-animation-harness__note';
    note.textContent = 'This GLB is one skinned mesh, so body part fills are assigned from the dominant rig bone for each vertex.';
    card.append(note);
    for (const definition of BODY_LABELS) {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = this.bodyPartColors.get(definition.objectName) ?? '#ffffff';
      input.setAttribute('aria-label', definition.displayName);
      input.addEventListener('input', () => {
        this.bodyPartColors.set(definition.objectName, input.value);
        this.repaintColors();
      });
      card.append(createRow(definition.displayName, input));
    }
    for (const control of HELMET_COLOR_CONTROLS) {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = this.helmetColors[control.key];
      input.setAttribute('aria-label', control.label);
      input.addEventListener('input', () => {
        this.helmetColors[control.key] = input.value;
        this.repaintColors();
      });
      card.append(createRow(control.label, input));
    }
    return card;
  }

  private createDisplayCard(): HTMLElement {
    const card = createCard('Display');
    const labels = createCheckbox('Show body labels', this.showBodyLabels, (checked) => {
      this.showBodyLabels = checked;
      this.updateLabelVisibility();
    });
    const skeleton = createCheckbox('Show skeleton', this.showSkeleton, (checked) => {
      this.showSkeleton = checked;
      this.updateSkeletonVisibility();
    });
    const wireframe = createCheckbox('Wireframe material', this.wireframe, (checked) => {
      this.wireframe = checked;
      this.applyWireframe();
    });
    card.append(labels, skeleton, wireframe);
    return card;
  }

  private createNumberControl(
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
    onChange: (value: number) => void,
  ): HTMLElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute('aria-label', label);
    const output = document.createElement('output');
    output.value = value.toFixed(step < 0.01 ? 3 : 2);
    input.addEventListener('input', () => {
      const next = Number(input.value);
      output.value = next.toFixed(step < 0.01 ? 3 : 2);
      onChange(next);
    });
    return createRangeRow(label, input, output);
  }

  private async loadAssets(): Promise<void> {
    try {
      const [playerGltf, helmetGltf] = await Promise.all([
        loadGltf(playerUrl),
        loadGltf(helmetUrl),
      ]);
      this.installPlayer(playerGltf);
      this.installHelmet(helmetGltf.scene);
      this.loaded = true;
      this.setStatus('Ready');
      this.updateMetrics();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  private installPlayer(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }): void {
    this.playerRoot?.removeFromParent();
    this.playerRoot = gltf.scene;
    this.playerRoot.name = 'low-poly-player-preview';
    preparePlayerForBodyPartColors(this.playerRoot);
    applyPlayerBodyPartColors(this.playerRoot, this.bodyPartColors);

    const bounds = new THREE.Box3().setFromObject(this.playerRoot);
    bounds.getCenter(PLAYER_CENTER);
    bounds.getSize(PLAYER_SIZE);
    this.playerRoot.position.set(-PLAYER_CENTER.x, -bounds.min.y, -PLAYER_CENTER.z);
    this.playerRoot.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
      }
    });
    this.scene.add(this.playerRoot);
    this.createBodyLabels();

    this.skeletonHelper = new THREE.SkeletonHelper(this.playerRoot);
    this.skeletonHelper.name = 'low-poly-player-skeleton-helper';
    this.skeletonHelper.visible = this.showSkeleton;
    this.skeletonHolder.clear();
    this.skeletonHolder.add(this.skeletonHelper);

    this.mixer = new THREE.AnimationMixer(this.playerRoot);
    this.clips = gltf.animations;
    this.populateClips();
    const defaultClip = this.clips.find((clip) => clip.duration > 0.5) ?? this.clips[0] ?? null;
    if (defaultClip) {
      this.setActiveClip(defaultClip.name);
    }
  }

  private installHelmet(source: THREE.Object3D): void {
    this.helmetRoot.clear();
    this.helmetRoot.userData.assetId = 'low_poly_helmet';
    colorizeHelmet(source, this.helmetColors);
    const helmetBounds = new THREE.Box3().setFromObject(source);
    helmetBounds.getCenter(HELMET_CENTER);
    source.position.sub(HELMET_CENTER);
    this.helmetRoot.add(source);
    this.applyHelmetTransform();
    const parent = this.findHelmetParent();
    parent?.add(this.helmetRoot);
  }

  private createBodyLabels(): void {
    this.labelsLayer.replaceChildren();
    this.bodyLabels.clear();
    for (const definition of BODY_LABELS) {
      if (!this.playerRoot?.getObjectByName(definition.objectName)) {
        continue;
      }
      const label = document.createElement('div');
      label.className = 'player-animation-harness__body-label';
      label.textContent = definition.displayName;
      this.labelsLayer.append(label);
      this.bodyLabels.set(definition.objectName, label);
    }
    this.updateLabelVisibility();
  }

  private findHelmetParent(): THREE.Object3D | null {
    if (!this.playerRoot) {
      return null;
    }
    return this.playerRoot.getObjectByName('socket_helmet') ??
      this.playerRoot.getObjectByName('Head') ??
      this.playerRoot.getObjectByName('head') ??
      this.playerRoot.getObjectByName('neck') ??
      this.playerRoot;
  }

  private populateClips(): void {
    this.clipSelect.replaceChildren();
    for (const clip of this.clips) {
      const option = document.createElement('option');
      option.value = clip.name;
      option.textContent = `${clip.name || 'Untitled'} (${clip.duration.toFixed(2)}s)`;
      this.clipSelect.append(option);
    }
  }

  private setActiveClip(name: string): void {
    if (!this.mixer) {
      return;
    }
    const clip = this.clips.find((candidate) => candidate.name === name);
    if (!clip) {
      return;
    }
    this.currentAction?.stop();
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.reset().play();
    this.activeClipName = clip.name;
    this.clipSelect.value = clip.name;
    this.timeSlider.max = String(Math.max(clip.duration, 0.01));
    this.seek(0);
    this.syncActionPause();
    this.updateMetrics();
  }

  private seek(time: number): void {
    if (!this.currentAction || !this.mixer) {
      return;
    }
    const duration = this.currentAction.getClip().duration;
    const next = THREE.MathUtils.clamp(time, 0, duration);
    this.currentAction.time = next;
    this.mixer.update(0);
    this.updateTimeReadout();
  }

  private syncActionPause(): void {
    if (this.currentAction) {
      this.currentAction.paused = !this.playing;
    }
  }

  private updatePlayButton(): void {
    this.playButton.textContent = this.playing ? 'Pause' : 'Play';
  }

  private applyHelmetTransform(): void {
    this.helmetRoot.position.copy(this.helmetOffset);
    this.helmetRoot.rotation.copy(this.helmetRotation);
    this.helmetRoot.scale.setScalar(this.helmetScale);
  }

  private applyWireframe(): void {
    this.playerRoot?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if ('wireframe' in material) {
            material.wireframe = this.wireframe;
          }
        }
      }
    });
  }

  private repaintColors(): void {
    if (this.playerRoot) {
      applyPlayerBodyPartColors(this.playerRoot, this.bodyPartColors);
    }
    colorizeHelmet(this.helmetRoot, this.helmetColors);
    this.updateMetrics();
  }

  private updateSkeletonVisibility(): void {
    if (this.skeletonHelper) {
      this.skeletonHelper.visible = this.showSkeleton;
    }
  }

  private updateLabelVisibility(): void {
    this.labelsLayer.hidden = !this.showBodyLabels;
  }

  private updateBodyLabels(): void {
    if (!this.showBodyLabels || !this.playerRoot) {
      return;
    }
    const width = Math.max(this.viewport.clientWidth, 1);
    const height = Math.max(this.viewport.clientHeight, 1);
    for (const definition of BODY_LABELS) {
      const label = this.bodyLabels.get(definition.objectName);
      const target = this.playerRoot.getObjectByName(definition.objectName);
      if (!label || !target) {
        continue;
      }
      target.getWorldPosition(LABEL_POSITION);
      LABEL_POSITION.project(this.camera);
      const visible = LABEL_POSITION.z > -1 && LABEL_POSITION.z < 1;
      label.hidden = !visible;
      if (visible) {
        label.style.left = `${((LABEL_POSITION.x + 1) * 0.5 * width).toFixed(1)}px`;
        label.style.top = `${((-LABEL_POSITION.y + 1) * 0.5 * height).toFixed(1)}px`;
      }
    }
  }

  private setCamera(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
    this.controls.target.set(0, 0.92, 0);
    this.controls.update();
  }

  private updateTimeReadout(): void {
    const time = this.currentAction?.time ?? 0;
    const duration = this.currentAction?.getClip().duration ?? 0;
    this.timeSlider.value = String(time);
    this.timeOutput.value = `${time.toFixed(2)} / ${duration.toFixed(2)}s`;
  }

  private updateMetrics(): void {
    const snapshot = this.getSnapshot();
    this.metrics.replaceChildren(
      metric('Loaded', snapshot.loaded ? 'yes' : 'no'),
      metric('Animations', String(snapshot.animationCount)),
      metric('Active clip', snapshot.activeClip ?? 'none'),
      metric('Bones', String(snapshot.boneCount)),
      metric('Labels', String(snapshot.bodyLabelCount)),
      metric('Color fills', String(snapshot.colorControlCount)),
      metric('Meshes', String(snapshot.meshCount)),
      metric('Triangles', String(Math.round(snapshot.triangleCount))),
      metric('Helmet', snapshot.helmetAttached ? `attached to ${snapshot.helmetParentName}` : 'missing'),
      metric('Draw calls', String(snapshot.drawCalls)),
      metric('Geometries', String(snapshot.geometries)),
      metric('Textures', String(snapshot.textures)),
    );
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
  }

  private getSnapshot(): PlayerAnimationHarnessSnapshot {
    return {
      animationCount: this.clips.length,
      activeClip: this.activeClipName,
      boneCount: countObjects(this.playerRoot, (object) => object instanceof THREE.Bone),
      drawCalls: this.renderer.info.render.calls,
      geometries: this.renderer.info.memory.geometries,
      helmetAttached: Boolean(this.helmetRoot.parent),
      helmetParentName: this.helmetRoot.parent?.name ?? null,
      loaded: this.loaded,
      meshCount: countObjects(this.scene, (object) => object instanceof THREE.Mesh),
      route: 'player-animation-harness',
      bodyLabelCount: this.bodyLabels.size,
      colorControlCount: BODY_LABELS.length + HELMET_COLOR_CONTROLS.length,
      textures: this.renderer.info.memory.textures,
      triangleCount: countTriangles(this.scene),
    };
  }

  private readonly resize = (): void => {
    const width = Math.max(this.viewport.clientWidth, 1);
    const height = Math.max(this.viewport.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (this.mixer && this.playing) {
      this.mixer.update(delta * this.speed);
    }
    this.controls.update();
    this.updateBodyLabels();
    this.renderer.render(this.scene, this.camera);
    this.updateTimeReadout();
    this.metricsAccumulator += delta;
    if (this.metricsAccumulator > 0.5) {
      this.metricsAccumulator = 0;
      this.updateMetrics();
    }
  };
}

function loadGltf(url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

function createDefaultBodyPartColors(): Map<string, string> {
  const colors = new Map<string, string>();
  for (const definition of BODY_LABELS) {
    colors.set(definition.objectName, getDefaultBodyPartColor(definition.objectName));
  }
  return colors;
}

function getDefaultBodyPartColor(objectName: string): string {
  if (objectName === 'Head' || objectName === 'neck') {
    return '#c88b61';
  }
  if (objectName.includes('Hand')) {
    return '#ffffff';
  }
  if (objectName.includes('Foot')) {
    return '#2f66d8';
  }
  if (objectName.includes('Leg')) {
    return objectName.includes('UpLeg') ? '#c88b61' : '#f2f4f6';
  }
  if (objectName === 'Hips') {
    return '#17233a';
  }
  return '#2f66d8';
}

function preparePlayerForBodyPartColors(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) {
      ensureVertexColorAttribute(object.geometry);
      object.material = new THREE.MeshStandardMaterial({
        metalness: 0.05,
        roughness: 0.78,
        vertexColors: true,
      });
    }
  });
}

function applyPlayerBodyPartColors(root: THREE.Object3D, bodyPartColors: Map<string, string>): void {
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) {
      applySkinnedMeshBodyPartColors(object, bodyPartColors);
    }
  });
}

function ensureVertexColorAttribute(geometry: THREE.BufferGeometry): THREE.BufferAttribute {
  const position = geometry.getAttribute('position');
  const existing = geometry.getAttribute('color');
  if (existing instanceof THREE.BufferAttribute && existing.count === position.count) {
    return existing;
  }
  const attribute = new THREE.Float32BufferAttribute(new Float32Array(position.count * 3), 3);
  geometry.setAttribute('color', attribute);
  return attribute;
}

function applySkinnedMeshBodyPartColors(
  mesh: THREE.SkinnedMesh,
  bodyPartColors: Map<string, string>,
): void {
  const geometry = mesh.geometry;
  const colorAttribute = ensureVertexColorAttribute(geometry);
  const skinIndex = geometry.getAttribute('skinIndex');
  const skinWeight = geometry.getAttribute('skinWeight');
  const color = new THREE.Color();
  const fallback = bodyPartColors.get('Spine') ?? '#2f66d8';
  for (let vertexIndex = 0; vertexIndex < colorAttribute.count; vertexIndex += 1) {
    const boneName = resolveDominantBoneName(mesh, skinIndex, skinWeight, vertexIndex);
    const labelKey = BONE_COLOR_ALIASES[boneName] ?? boneName;
    color.set(bodyPartColors.get(labelKey) ?? fallback);
    colorAttribute.setXYZ(vertexIndex, color.r, color.g, color.b);
  }
  colorAttribute.needsUpdate = true;
}

function resolveDominantBoneName(
  mesh: THREE.SkinnedMesh,
  skinIndex: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  skinWeight: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertexIndex: number,
): string {
  let bestSlot = 0;
  let bestWeight = -1;
  for (let slot = 0; slot < skinWeight.itemSize; slot += 1) {
    const weight = skinWeight.getComponent(vertexIndex, slot);
    if (weight > bestWeight) {
      bestWeight = weight;
      bestSlot = slot;
    }
  }
  const boneIndex = skinIndex.getComponent(vertexIndex, bestSlot);
  return mesh.skeleton.bones[boneIndex]?.name ?? 'Spine';
}

function colorizeHelmet(root: THREE.Object3D, colors: HelmetColors): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    const name = `${object.name} ${Array.isArray(object.material) ? object.material.map((material) => material.name).join(' ') : object.material.name}`.toLowerCase();
    const color = name.includes('face') || name.includes('guard') || name.includes('mask')
      ? colors.faceguard
      : name.includes('stripe') || name.includes('accent')
        ? colors.helmetStripe
        : colors.helmetShell;
    if (object.material instanceof THREE.MeshStandardMaterial) {
      object.material.color.set(color);
    } else {
      disposeMaterial(object.material);
      object.material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.08,
        roughness: 0.62,
      });
    }
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    entry.dispose();
  }
}

function createCard(titleText: string): HTMLElement {
  const card = document.createElement('section');
  card.className = 'player-animation-harness__card';
  const title = document.createElement('h2');
  title.textContent = titleText;
  card.append(title);
  return card;
}

function createRow(labelText: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'player-animation-harness__row';
  const label = document.createElement('label');
  label.textContent = labelText;
  row.append(label, control);
  return row;
}

function createRangeRow(labelText: string, input: HTMLInputElement, output: HTMLOutputElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'player-animation-harness__range';
  wrapper.append(input, output);
  return createRow(labelText, wrapper);
}

function createActions(buttons: HTMLButtonElement[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'player-animation-harness__actions';
  row.append(...buttons);
  return row;
}

function createCheckbox(labelText: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.setAttribute('aria-label', labelText);
  input.addEventListener('change', () => onChange(input.checked));
  const label = document.createElement('label');
  label.append(input, document.createTextNode(labelText));
  const row = document.createElement('div');
  row.className = 'player-animation-harness__actions';
  row.append(label);
  return row;
}

function metric(label: string, value: string): HTMLElement {
  const item = document.createElement('div');
  const caption = document.createElement('span');
  caption.textContent = `${label}: `;
  item.append(caption, document.createTextNode(value));
  return item;
}

function countObjects(root: THREE.Object3D | null, predicate: (object: THREE.Object3D) => boolean): number {
  if (!root) {
    return 0;
  }
  let count = 0;
  root.traverse((object) => {
    if (predicate(object)) {
      count += 1;
    }
  });
  return count;
}

function countTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const geometry = object.geometry;
      triangles += geometry.index ? geometry.index.count / 3 : (geometry.getAttribute('position')?.count ?? 0) / 3;
    }
  });
  return triangles;
}

const mount = document.querySelector<HTMLDivElement>('#player-animation-harness');
if (!mount) {
  throw new Error('Missing #player-animation-harness mount');
}

const app = new PlayerAnimationHarness(mount);
app.start();
