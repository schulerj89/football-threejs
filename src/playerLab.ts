import './playerLab.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBallVisual } from './ballVisual';
import {
  DEFAULT_PLAYER_POSE_CLIPS,
  DEFAULT_PLAYER_POSES,
  PLAYER_POSE_SAFE_RANGES,
  applyPlayerPoseDefinition,
  clonePlayerPoseDefinition,
  createPlayerPoseExportDocument,
  findPlayerPoseById,
  interpolatePlayerPoseDefinitions,
  parsePlayerPoseExportDocument,
  samplePlayerPoseClip,
  serializePlayerPoseExportDocument,
  validatePlayerPoseCollection,
  type LegPose,
  type LimbPose,
  type PlayerPoseClip,
  type PlayerPoseDefinition,
} from './presentation/players/PlayerPoseApplier';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  createFootballPlayerVisual,
  type FootballPlayerVisualResources,
} from './presentation/players/FootballPlayerVisualFactory';
import { SKIN_TONE_PALETTE, resolvePlayerAppearance, type SkinToneId } from './playerAppearance';
import { listTeamProfiles } from './teams/TeamRegistry';
import { DEFAULT_TEAM_PROFILE_SETTINGS } from './teams/TeamProfileStore';
import type { UniformPalette, UniformVariant } from './teams/UniformPalette';
import {
  PLAYER_BACK_NUMBER_ANCHOR_NAME,
  PLAYER_HEAD_ANCHOR_NAME,
  getPlayerBodyVisualSnapshot,
} from './playerVisual';

interface PlayerLabSnapshot {
  currentPoseId: string;
  helperCount: number;
  materialCount: number;
  meshCount: number;
  playerReady: boolean;
  route: 'player-lab';
  triangleCount: number;
  visualProfileId: typeof FOOTBALL_PLAYER_VISUAL_PROFILE_ID | null;
}

declare global {
  interface Window {
    __PLAYER_LAB__?: {
      getSnapshot: () => PlayerLabSnapshot;
    };
  }
}

type PoseFieldPath =
  | `body.${keyof PlayerPoseDefinition['body'] & string}`
  | `limbs.leftArm.${keyof LimbPose & string}`
  | `limbs.rightArm.${keyof LimbPose & string}`
  | `limbs.leftLeg.${keyof LegPose & string}`
  | `limbs.rightLeg.${keyof LegPose & string}`;

const ANGLE_FIELDS = new Set<string>([
  'torsoPitch',
  'torsoRoll',
  'torsoYaw',
  'headPitch',
  'headYaw',
  'headRoll',
  'facingYaw',
  'footAngle',
  'shoulderPitch',
  'shoulderYaw',
  'shoulderRoll',
  'elbowBend',
  'hipPitch',
  'hipYaw',
  'hipRoll',
  'kneeBend',
  'anklePitch',
]);

class PlayerPoseLab {
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly clock = new THREE.Clock();
  private readonly controls: OrbitControls;
  private readonly viewport = document.createElement('section');
  private readonly panel = document.createElement('aside');
  private readonly labelsLayer = document.createElement('div');
  private readonly metrics = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly poseSelect = document.createElement('select');
  private readonly poseASelect = document.createElement('select');
  private readonly poseBSelect = document.createElement('select');
  private readonly clipSelect = document.createElement('select');
  private readonly blendSlider = document.createElement('input');
  private readonly poseControls = document.createElement('div');
  private readonly helperRoot = new THREE.Group();
  private readonly pivotHelperRoot = new THREE.Group();
  private readonly football = createBallVisual({ style: 'football' });
  private readonly teams = listTeamProfiles();
  private poses = DEFAULT_PLAYER_POSES.map(clonePlayerPoseDefinition);
  private clips = DEFAULT_PLAYER_POSE_CLIPS.map(clonePlayerPoseClipForLab);
  private readonly helperState = {
    bodyBounds: false,
    footMarkers: false,
    helmetBounds: false,
    jointNames: false,
    numberAnchor: false,
    pivots: false,
  };
  private animationFrame = 0;
  private animationPlaying = false;
  private animationPingPong = true;
  private animationLoop = true;
  private animationSpeed = 1;
  private animationTime = 0;
  private metricsAccumulator = 0;
  private ballAttachment: 'chest' | 'left' | 'right' = 'right';
  private ballAttached = false;
  private currentPose: PlayerPoseDefinition = clonePlayerPoseDefinition(this.poses[0]!);
  private currentTeamId = this.teams[0]?.id ?? DEFAULT_TEAM_PROFILE_SETTINGS.userTeamId;
  private currentUniform: UniformVariant = 'home';
  private currentSkinTone: SkinToneId = 'skin-tone-1';
  private jerseyNumber = 12;
  private playerResource: FootballPlayerVisualResources | null = null;

  constructor(private readonly root: HTMLElement) {
    this.root.className = 'player-lab';
    this.viewport.className = 'player-lab-viewport';
    this.panel.className = 'player-lab-panel';
    this.labelsLayer.className = 'player-lab-joint-label-layer';
    this.metrics.className = 'player-lab-metrics';
    this.status.className = 'player-lab-status';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x07100e);
    this.viewport.append(this.renderer.domElement, this.labelsLayer);
    this.root.append(this.viewport, this.panel);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1.05, 0);
  }

  start(): void {
    this.setupScene();
    this.buildPanel();
    this.applyPose(this.currentPose);
    void this.rebuildPlayerVisual();
    window.addEventListener('resize', this.resize);
    this.resize();
    this.animate();
    window.__PLAYER_LAB__ = {
      getSnapshot: () => this.getSnapshot(),
    };
  }

  private setupScene(): void {
    this.scene.name = 'player-pose-lab-scene';
    this.scene.background = new THREE.Color(0x07100e);
    this.camera.position.set(3.4, 2.2, 4.2);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x1d2b22, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(3, 5, 4);
    this.scene.add(key);

    const grid = new THREE.GridHelper(8, 16, 0x385246, 0x203029);
    grid.name = 'player-lab-grid';
    this.scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0x0d1712, side: THREE.DoubleSide }),
    );
    ground.name = 'player-lab-ground';
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.006;
    this.scene.add(ground);

    this.helperRoot.name = 'player-lab-helpers';
    this.pivotHelperRoot.name = 'player-lab-pivot-helpers';
    this.helperRoot.add(this.pivotHelperRoot);
    this.scene.add(this.helperRoot);
    this.football.name = 'player-lab-football-attachment';
    this.football.visible = false;
  }

  private buildPanel(): void {
    const title = document.createElement('h1');
    title.textContent = 'Player Pose Lab';
    const subtitle = document.createElement('div');
    subtitle.textContent = 'Development-only procedural mannequin pose and animation tool.';
    subtitle.style.color = '#9fb0a8';

    this.panel.append(
      title,
      subtitle,
      this.createCameraToolbar(),
      this.createMetricsCard(),
      this.createPoseCard(),
      this.createAppearanceCard(),
      this.createAnimationCard(),
      this.createHelperCard(),
      this.status,
    );
    this.rebuildPoseSelects();
  }

  private createCameraToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'player-lab-toolbar';
    const buttons: Array<[string, () => void]> = [
      ['Front', () => this.setCamera(0, 1.6, 5)],
      ['Side', () => this.setCamera(5, 1.6, 0)],
      ['Back', () => this.setCamera(0, 1.6, -5)],
      ['Gameplay', () => this.setCamera(-3, 2.15, 4.4)],
      ['Reset', () => this.setCamera(3.4, 2.2, 4.2)],
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
    const card = createCard('Preview Metrics');
    card.append(this.metrics);
    return card;
  }

  private createPoseCard(): HTMLElement {
    const card = createCard('Pose Controls');
    card.append(
      createSelectRow('Preset', this.poseSelect),
      this.poseControls,
      createActions([
        ['Save Pose JSON', () => this.downloadPoseJson()],
        ['Load Pose JSON', () => this.pickPoseJson()],
        ['Copy Pose JSON', () => void this.copyPoseJson()],
        ['Reset Current Pose', () => this.resetCurrentPose()],
        ['Duplicate Pose', () => this.duplicatePose()],
        ['Delete Pose', () => this.deletePose()],
      ]),
    );
    this.poseSelect.addEventListener('change', () => {
      this.currentPose = clonePlayerPoseDefinition(findPlayerPoseById(this.poses, this.poseSelect.value));
      this.applyPose(this.currentPose);
      this.rebuildPoseControls();
      this.setStatus(`Loaded ${this.currentPose.displayName}`);
    });
    this.rebuildPoseControls();
    return card;
  }

  private createAppearanceCard(): HTMLElement {
    const card = createCard('Team and Appearance');
    const teamSelect = document.createElement('select');
    for (const team of this.teams) {
      teamSelect.append(new Option(team.displayName, team.id));
    }
    teamSelect.value = this.currentTeamId;
    teamSelect.addEventListener('change', () => {
      this.currentTeamId = teamSelect.value;
      void this.rebuildPlayerVisual();
    });

    const uniformSelect = createSelect([
      ['home', 'Home'],
      ['away', 'Away'],
    ]);
    uniformSelect.value = this.currentUniform;
    uniformSelect.addEventListener('change', () => {
      this.currentUniform = uniformSelect.value as UniformVariant;
      void this.rebuildPlayerVisual();
    });

    const skinSelect = createSelect(SKIN_TONE_PALETTE.map((tone) => [tone.skinToneId, tone.skinToneId]));
    skinSelect.value = this.currentSkinTone;
    skinSelect.addEventListener('change', () => {
      this.currentSkinTone = skinSelect.value as SkinToneId;
      void this.rebuildPlayerVisual();
    });

    const jerseyInput = document.createElement('input');
    jerseyInput.type = 'number';
    jerseyInput.min = '0';
    jerseyInput.max = '99';
    jerseyInput.value = String(this.jerseyNumber);
    jerseyInput.addEventListener('change', () => {
      this.jerseyNumber = clamp(Math.trunc(Number(jerseyInput.value)), 0, 99);
      void this.rebuildPlayerVisual();
    });

    const shellInput = document.createElement('input');
    shellInput.type = 'color';
    const faceguardInput = document.createElement('input');
    faceguardInput.type = 'color';
    const updateColors = (): void => {
      const resource = this.playerResource;
      if (!resource) {
        return;
      }
      const uniform = this.resolveUniform();
      resource.syncUniform({
        ...uniform,
        faceguard: faceguardInput.value,
        helmetShell: shellInput.value,
      });
    };
    const uniform = this.resolveUniform();
    shellInput.value = uniform.helmetShell;
    faceguardInput.value = uniform.faceguard;
    shellInput.addEventListener('input', updateColors);
    faceguardInput.addEventListener('input', updateColors);

    const ballAttached = document.createElement('input');
    ballAttached.type = 'checkbox';
    ballAttached.addEventListener('change', () => {
      this.ballAttached = ballAttached.checked;
      this.syncFootballAttachment();
    });
    const ballHand = createSelect([
      ['right', 'Right'],
      ['left', 'Left'],
      ['chest', 'Chest'],
    ]);
    ballHand.value = this.ballAttachment;
    ballHand.addEventListener('change', () => {
      this.ballAttachment = ballHand.value as typeof this.ballAttachment;
      this.syncFootballAttachment();
    });

    card.append(
      createSelectRow('Team uniform preset', teamSelect),
      createSelectRow('Uniform', uniformSelect),
      createSelectRow('Skin tone', skinSelect),
      createInputRow('Jersey number', jerseyInput),
      createInputRow('Helmet shell', shellInput),
      createInputRow('Faceguard', faceguardInput),
      createCheckboxRow('Football attached', ballAttached),
      createSelectRow('Ball hand', ballHand),
    );
    return card;
  }

  private createAnimationCard(): HTMLElement {
    const card = createCard('Animation Preview');
    this.blendSlider.type = 'range';
    this.blendSlider.min = '0';
    this.blendSlider.max = '1';
    this.blendSlider.step = '0.01';
    this.blendSlider.value = '0';
    this.blendSlider.addEventListener('input', () => {
      this.animationPlaying = false;
      this.applyBlendPreview();
    });
    const speed = document.createElement('input');
    speed.type = 'range';
    speed.min = '0.25';
    speed.max = '2';
    speed.step = '0.05';
    speed.value = String(this.animationSpeed);
    speed.addEventListener('input', () => {
      this.animationSpeed = Number(speed.value);
    });
    const pingPong = document.createElement('input');
    pingPong.type = 'checkbox';
    pingPong.checked = this.animationPingPong;
    pingPong.addEventListener('change', () => {
      this.animationPingPong = pingPong.checked;
    });
    const loop = document.createElement('input');
    loop.type = 'checkbox';
    loop.checked = this.animationLoop;
    loop.addEventListener('change', () => {
      this.animationLoop = loop.checked;
    });
    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.textContent = 'Play';
    playButton.addEventListener('click', () => {
      this.animationPlaying = !this.animationPlaying;
      playButton.textContent = this.animationPlaying ? 'Pause' : 'Play';
      this.animationTime = 0;
    });
    const loadClipButton = document.createElement('button');
    loadClipButton.type = 'button';
    loadClipButton.textContent = 'Load Clip Poses';
    loadClipButton.addEventListener('click', () => this.loadSelectedClipEndpoints());
    card.append(
      createSelectRow('Clip', this.clipSelect),
      createSelectRow('Pose A', this.poseASelect),
      createSelectRow('Pose B', this.poseBSelect),
      createInputRow('Blend', this.blendSlider),
      createInputRow('Speed', speed),
      createCheckboxRow('Ping-pong', pingPong),
      createCheckboxRow('Loop', loop),
      createActions([
        [playButton.textContent, () => playButton.click()],
        [loadClipButton.textContent, () => loadClipButton.click()],
      ]),
    );
    return card;
  }

  private createHelperCard(): HTMLElement {
    const card = createCard('Visual Helpers');
    const list = document.createElement('div');
    list.className = 'player-lab-helper-list';
    const helpers: Array<[keyof typeof this.helperState, string]> = [
      ['pivots', 'show skeleton/pivots'],
      ['bodyBounds', 'show body bounds'],
      ['footMarkers', 'show foot contact markers'],
      ['jointNames', 'show joint names'],
      ['helmetBounds', 'show helmet bounds'],
      ['numberAnchor', 'show number anchor'],
    ];
    for (const [key, label] of helpers) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => {
        this.helperState[key] = input.checked;
        this.syncHelpers();
      });
      list.append(createCheckboxRow(label, input));
    }
    card.append(list);
    return card;
  }

  private async rebuildPlayerVisual(): Promise<void> {
    const existing = this.playerResource;
    if (existing) {
      existing.dispose();
      this.playerResource = null;
    }
    const uniform = this.resolveUniform();
    const resource = createFootballPlayerVisual(
      {
        appearanceId: findAppearanceIdForSkinTone(this.currentSkinTone),
        footballPosition: 'QB',
        gameplayTeam: 'offense',
        jerseyNumber: this.jerseyNumber,
        presentationOnly: true,
        role: 'quarterback',
        rosterPlayerId: `lab-player-${this.currentSkinTone}`,
        teamSide: 'user',
        uniform,
        visualId: 'player-lab-preview',
      },
      {
        helmet: 'required',
        playerVisualOptions: {
          visualMode: 'procedural',
        },
        teamUniforms: {
          defense: uniform,
          offense: uniform,
        },
      },
    );
    this.playerResource = resource;
    this.scene.add(resource.root);
    resource.syncTransform({ x: 0, z: 0 }, 0);
    resource.setVisible(true);
    await resource.ready.catch(() => undefined);
    this.applyPose(this.currentPose);
    this.syncFootballAttachment();
    this.syncHelpers();
  }

  private resolveUniform(): UniformPalette {
    const team = this.teams.find((candidate) => candidate.id === this.currentTeamId) ?? this.teams[0]!;
    return this.currentUniform === 'away' ? team.awayUniform : team.homeUniform;
  }

  private rebuildPoseSelects(): void {
    for (const select of [this.poseSelect, this.poseASelect, this.poseBSelect]) {
      select.replaceChildren(
        ...this.poses.map((pose) => new Option(pose.displayName, pose.id)),
      );
    }
    this.poseSelect.value = this.currentPose.id;
    if (!this.poseASelect.value || !this.poses.some((pose) => pose.id === this.poseASelect.value)) {
      this.poseASelect.value = 'running_contact_left';
    }
    if (!this.poseBSelect.value || !this.poses.some((pose) => pose.id === this.poseBSelect.value)) {
      this.poseBSelect.value = 'running_contact_right';
    }
    this.clipSelect.replaceChildren(
      ...this.clips.map((clip) => new Option(clip.displayName, clip.id)),
    );
  }

  private rebuildPoseControls(): void {
    this.poseControls.replaceChildren();
    const fields: Array<[PoseFieldPath, string]> = [
      ['body.torsoPitch', 'Torso lean forward/back'],
      ['body.torsoRoll', 'Torso lean left/right'],
      ['body.torsoYaw', 'Torso twist'],
      ['body.headPitch', 'Head pitch'],
      ['body.headYaw', 'Head yaw'],
      ['body.headRoll', 'Head roll'],
      ['limbs.leftArm.shoulderPitch', 'Left shoulder pitch'],
      ['limbs.leftArm.shoulderYaw', 'Left shoulder yaw'],
      ['limbs.leftArm.shoulderRoll', 'Left shoulder roll'],
      ['limbs.leftArm.elbowBend', 'Left elbow bend'],
      ['limbs.rightArm.shoulderPitch', 'Right shoulder pitch'],
      ['limbs.rightArm.shoulderYaw', 'Right shoulder yaw'],
      ['limbs.rightArm.shoulderRoll', 'Right shoulder roll'],
      ['limbs.rightArm.elbowBend', 'Right elbow bend'],
      ['limbs.leftLeg.hipPitch', 'Left hip pitch'],
      ['limbs.leftLeg.hipYaw', 'Left hip yaw'],
      ['limbs.leftLeg.hipRoll', 'Left hip roll'],
      ['limbs.leftLeg.kneeBend', 'Left knee bend'],
      ['limbs.leftLeg.anklePitch', 'Left ankle pitch'],
      ['limbs.rightLeg.hipPitch', 'Right hip pitch'],
      ['limbs.rightLeg.hipYaw', 'Right hip yaw'],
      ['limbs.rightLeg.hipRoll', 'Right hip roll'],
      ['limbs.rightLeg.kneeBend', 'Right knee bend'],
      ['limbs.rightLeg.anklePitch', 'Right ankle pitch'],
      ['body.stanceWidth', 'Whole body stance width'],
      ['body.crouch', 'Whole body crouch amount'],
      ['body.footAngle', 'Whole body foot angle'],
      ['body.bodyHeightOffset', 'Whole body height offset'],
      ['body.facingYaw', 'Whole body facing direction'],
    ];

    for (const [path, label] of fields) {
      this.poseControls.append(this.createPoseSlider(path, label));
    }
  }

  private createPoseSlider(path: PoseFieldPath, label: string): HTMLElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.step = '0.5';
    const key = path.split('.').at(-1)!;
    const range = getRangeForPath(path);
    input.min = formatUiValue(range[0], key);
    input.max = formatUiValue(range[1], key);
    input.value = formatUiValue(getPosePathValue(this.currentPose, path), key);
    const output = document.createElement('span');
    output.textContent = `${input.value}${ANGLE_FIELDS.has(key) ? 'deg' : ''}`;
    input.addEventListener('input', () => {
      const next = parseUiValue(Number(input.value), key);
      setPosePathValue(this.currentPose, path, next);
      output.textContent = `${input.value}${ANGLE_FIELDS.has(key) ? 'deg' : ''}`;
      this.applyPose(this.currentPose);
    });
    const row = document.createElement('div');
    row.className = 'player-lab-row';
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    const stack = document.createElement('div');
    stack.append(input, output);
    row.append(labelElement, stack);
    return row;
  }

  private applyPose(pose: PlayerPoseDefinition, options: { refreshHelpers?: boolean } = {}): void {
    const { refreshHelpers = true } = options;
    this.currentPose = clonePlayerPoseDefinition(pose);
    this.persistCurrentPose();
    const resource = this.playerResource;
    if (resource) {
      applyPlayerPoseDefinition(resource.root, this.currentPose);
      resource.root.updateWorldMatrix(true, true);
    }
    this.poseSelect.value = this.currentPose.id;
    this.syncMetrics();
    if (refreshHelpers) {
      this.syncHelpers();
    }
  }

  private persistCurrentPose(): void {
    const index = this.poses.findIndex((pose) => pose.id === this.currentPose.id);
    if (index === -1) {
      return;
    }
    this.poses = this.poses.map((pose, candidateIndex) =>
      candidateIndex === index ? clonePlayerPoseDefinition(this.currentPose) : pose,
    );
  }

  private applyBlendPreview(refreshHelpers = true): void {
    const poseA = findPlayerPoseById(this.poses, this.poseASelect.value);
    const poseB = findPlayerPoseById(this.poses, this.poseBSelect.value);
    const sampled = interpolatePlayerPoseDefinitions(poseA, poseB, Number(this.blendSlider.value), {
      displayName: 'Blend Preview',
      id: 'blend_preview',
    });
    this.applyPose(sampled, { refreshHelpers });
  }

  private loadSelectedClipEndpoints(): void {
    const clip = this.clips.find((candidate) => candidate.id === this.clipSelect.value);
    if (!clip || clip.frames.length === 0) {
      return;
    }
    this.poseASelect.value = clip.frames[0]!.poseId;
    this.poseBSelect.value = clip.frames[Math.min(1, clip.frames.length - 1)]!.poseId;
    this.setStatus(`Loaded ${clip.displayName} endpoints`);
  }

  private resetCurrentPose(): void {
    this.currentPose = clonePlayerPoseDefinition(findPlayerPoseById(this.poses, this.poseSelect.value));
    this.applyPose(this.currentPose);
    this.rebuildPoseControls();
  }

  private duplicatePose(): void {
    this.currentPose = {
      ...clonePlayerPoseDefinition(this.currentPose),
      displayName: `${this.currentPose.displayName} Copy`,
      id: `${this.currentPose.id}_copy_${Date.now().toString(36)}`,
    };
    this.poses = [...this.poses, clonePlayerPoseDefinition(this.currentPose)];
    this.rebuildPoseSelects();
    this.poseSelect.value = this.currentPose.id;
    this.rebuildPoseControls();
    this.applyPose(this.currentPose);
    this.setStatus('Duplicated current pose in the editor. Export to keep it.');
  }

  private deletePose(): void {
    if (this.poses.length <= 1) {
      this.setStatus('At least one pose must remain in the lab.');
      return;
    }
    this.poses = this.poses.filter((pose) => pose.id !== this.currentPose.id);
    this.currentPose = clonePlayerPoseDefinition(this.poses[0]!);
    this.rebuildPoseSelects();
    this.applyPose(this.currentPose);
    this.rebuildPoseControls();
    this.setStatus('Deleted pose from the current lab session.');
  }

  private downloadPoseJson(): void {
    const exportDocument = createPlayerPoseExportDocument(
      this.poses,
      this.clips,
    );
    const blob = new Blob([serializePlayerPoseExportDocument(exportDocument)], { type: 'application/json' });
    const link = documentCreateDownloadLink(blob, 'player-poses.generated.json');
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    this.setStatus('Downloaded pose JSON.');
  }

  private pickPoseJson(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          const parsed = parsePlayerPoseExportDocument(String(reader.result ?? ''));
          this.poses = parsed.poses.map(clonePlayerPoseDefinition);
          this.clips = parsed.clips.map(clonePlayerPoseClipForLab);
          this.currentPose = clonePlayerPoseDefinition(this.poses[0] ?? DEFAULT_PLAYER_POSES[0]!);
          this.rebuildPoseSelects();
          this.applyPose(this.currentPose);
          this.rebuildPoseControls();
          this.setStatus(`Loaded ${parsed.poses.length} pose(s) from JSON.`);
        } catch (error) {
          this.setStatus(error instanceof Error ? error.message : String(error));
        }
      });
      reader.readAsText(file);
    });
    input.click();
  }

  private async copyPoseJson(): Promise<void> {
    const document = createPlayerPoseExportDocument(this.poses, this.clips);
    const text = serializePlayerPoseExportDocument(document);
    await navigator.clipboard?.writeText(text);
    this.setStatus('Copied pose JSON to clipboard.');
  }

  private syncFootballAttachment(): void {
    const resource = this.playerResource;
    if (!resource) {
      return;
    }
    this.football.removeFromParent();
    if (!this.ballAttached) {
      this.football.visible = false;
      return;
    }
    const parent =
      this.ballAttachment === 'left'
        ? resource.root.getObjectByName('leftArmPivot')
        : this.ballAttachment === 'right'
          ? resource.root.getObjectByName('rightArmPivot')
          : resource.root.getObjectByName('torso');
    parent?.add(this.football);
    this.football.visible = true;
    this.football.position.set(
      this.ballAttachment === 'left' ? -0.1 : this.ballAttachment === 'right' ? 0.1 : 0,
      this.ballAttachment === 'chest' ? 0.16 : -0.42,
      this.ballAttachment === 'chest' ? 0.32 : 0.18,
    );
    this.football.scale.setScalar(0.86);
  }

  private syncMetrics(): void {
    const resource = this.playerResource;
    if (!resource) {
      this.metrics.textContent = 'Loading player visual...';
      return;
    }
    const body = getPlayerBodyVisualSnapshot(resource.root);
    const counts = countSceneResources(resource.root);
    this.metrics.replaceChildren(
      metric('Height', `${body.totalHeight.toFixed(2)} yd`),
      metric('Bounds', `${body.combinedBounds.size.x.toFixed(2)} x ${body.combinedBounds.size.y.toFixed(2)} x ${body.combinedBounds.size.z.toFixed(2)}`),
      metric('Meshes', String(counts.meshCount)),
      metric('Materials', String(counts.materialCount)),
      metric('Triangles', String(counts.triangleCount)),
      metric('Pose', this.currentPose.displayName),
    );
  }

  private syncHelpers(): void {
    this.pivotHelperRoot.visible = Object.values(this.helperState).some(Boolean);
    this.labelsLayer.hidden = !this.helperState.jointNames;
    this.rebuildPivotHelpers();
  }

  private rebuildPivotHelpers(): void {
    this.pivotHelperRoot.clear();
    this.labelsLayer.replaceChildren();
    const resource = this.playerResource;
    if (!resource) {
      return;
    }
    const helperMaterial = getHelperMaterial();
    const helperGeometry = getHelperGeometry();
    const names = [
      'leftArmPivot',
      'rightArmPivot',
      'leftLegPivot',
      'rightLegPivot',
      PLAYER_HEAD_ANCHOR_NAME,
      'torso',
      PLAYER_BACK_NUMBER_ANCHOR_NAME,
    ];
    for (const name of names) {
      const object = resource.root.getObjectByName(name);
      if (!object) {
        continue;
      }
      const marker = new THREE.Mesh(helperGeometry, helperMaterial);
      marker.name = `player-lab-helper-${name}`;
      marker.position.copy(object.getWorldPosition(new THREE.Vector3()));
      marker.visible =
        this.helperState.pivots ||
        (this.helperState.numberAnchor && name === PLAYER_BACK_NUMBER_ANCHOR_NAME);
      this.pivotHelperRoot.add(marker);
      if (this.helperState.jointNames) {
        this.labelsLayer.append(this.createJointLabel(name, object));
      }
    }
    if (this.helperState.bodyBounds) {
      const helper = new THREE.BoxHelper(resource.root, 0xf2d94b);
      helper.name = 'player-lab-body-bounds';
      this.pivotHelperRoot.add(helper);
    }
    if (this.helperState.helmetBounds) {
      const helmet = resource.root.getObjectByName('low-poly-helmet');
      if (helmet) {
        const helper = new THREE.BoxHelper(helmet, 0x8fb7ff);
        helper.name = 'player-lab-helmet-bounds';
        this.pivotHelperRoot.add(helper);
      }
    }
    if (this.helperState.footMarkers) {
      for (const name of ['leftFoot', 'rightFoot']) {
        const foot = resource.root.getObjectByName(name);
        if (!foot) {
          continue;
        }
        const marker = new THREE.Mesh(getFootMarkerGeometry(), getFootMarkerMaterial());
        marker.name = `player-lab-foot-marker-${name}`;
        const world = foot.getWorldPosition(new THREE.Vector3());
        marker.position.set(world.x, 0.012, world.z);
        marker.rotation.x = -Math.PI / 2;
        this.pivotHelperRoot.add(marker);
      }
    }
  }

  private createJointLabel(name: string, object: THREE.Object3D): HTMLElement {
    const label = document.createElement('div');
    label.className = 'player-lab-joint-label';
    label.textContent = name;
    const world = object.getWorldPosition(new THREE.Vector3());
    const projected = world.project(this.camera);
    const rect = this.viewport.getBoundingClientRect();
    label.style.left = `${(projected.x * 0.5 + 0.5) * rect.width}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * rect.height}px`;
    return label;
  }

  private animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate);
    const delta = Math.min(0.05, this.clock.getDelta());
    if (this.animationPlaying) {
      this.animationTime += delta * this.animationSpeed;
      this.updateAnimationPreview();
    }
    this.controls.update();
    this.metricsAccumulator += delta;
    if (this.metricsAccumulator >= 0.2) {
      this.metricsAccumulator = 0;
      this.syncMetrics();
    }
    this.renderer.render(this.scene, this.camera);
  };

  private updateAnimationPreview(): void {
    const clip = this.clips.find((candidate) => candidate.id === this.clipSelect.value);
    if (clip) {
      const sample = samplePlayerPoseClip(
        {
          ...clip,
          loop: this.animationLoop,
        } satisfies PlayerPoseClip,
        this.poses,
        this.animationPingPong ? pingPongTime(this.animationTime, getClipDuration(clip)) : this.animationTime,
      );
      this.applyPose(sample, { refreshHelpers: false });
      return;
    }
    this.applyBlendPreview(false);
  }

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
    this.controls.target.set(0, 1.05, 0);
    this.controls.update();
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
  }

  private getSnapshot(): PlayerLabSnapshot {
    const counts = this.playerResource ? countSceneResources(this.playerResource.root) : {
      materialCount: 0,
      meshCount: 0,
      triangleCount: 0,
    };
    return {
      currentPoseId: this.currentPose.id,
      helperCount: this.pivotHelperRoot.children.length,
      materialCount: counts.materialCount,
      meshCount: counts.meshCount,
      playerReady: Boolean(this.playerResource?.getReadiness().subjectReady),
      route: 'player-lab',
      triangleCount: counts.triangleCount,
      visualProfileId: this.playerResource?.root.userData.visualProfileId ?? null,
    };
  }
}

function createCard(title: string): HTMLElement {
  const card = document.createElement('section');
  card.className = 'player-lab-card';
  const heading = document.createElement('h2');
  heading.textContent = title;
  card.append(heading);
  return card;
}

function createActions(actions: Array<[string | null, () => void]>): HTMLElement {
  const row = document.createElement('div');
  row.className = 'player-lab-actions';
  for (const [label, action] of actions) {
    if (!label) {
      continue;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    row.append(button);
  }
  return row;
}

function createSelect(options: Array<[string, string]>): HTMLSelectElement {
  const select = document.createElement('select');
  select.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
  return select;
}

function createSelectRow(label: string, select: HTMLSelectElement): HTMLElement {
  return createInputRow(label, select);
}

function createInputRow(label: string, input: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'player-lab-row';
  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  row.append(labelElement, input);
  return row;
}

function createCheckboxRow(label: string, input: HTMLInputElement): HTMLElement {
  const row = document.createElement('label');
  row.append(input, document.createTextNode(label));
  return row;
}

function metric(label: string, value: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = `<span>${label}</span><br>${value}`;
  return element;
}

function documentCreateDownloadLink(blob: Blob, fileName: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  return link;
}

function findAppearanceIdForSkinTone(skinToneId: SkinToneId): string {
  for (let index = 0; index < 2000; index += 1) {
    const candidate = `player-lab-${skinToneId}-${index}`;
    if (resolvePlayerAppearance(candidate).skinToneId === skinToneId) {
      return candidate;
    }
  }
  return `player-lab-${skinToneId}`;
}

function countSceneResources(root: THREE.Object3D): {
  materialCount: number;
  meshCount: number;
  triangleCount: number;
} {
  const materials = new Set<string>();
  let meshCount = 0;
  let triangleCount = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    meshCount += 1;
    triangleCount += countTriangles(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      materials.add(material.uuid);
    }
  });
  return {
    materialCount: materials.size,
    meshCount,
    triangleCount,
  };
}

function countTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return Math.floor(geometry.index.count / 3);
  }
  const position = geometry.getAttribute('position');
  return position ? Math.floor(position.count / 3) : 0;
}

function getRangeForPath(path: PoseFieldPath): readonly [number, number] {
  const parts = path.split('.');
  const key = parts.at(-1)!;
  if (parts[0] === 'body') {
    return PLAYER_POSE_SAFE_RANGES.body[key as keyof typeof PLAYER_POSE_SAFE_RANGES.body];
  }
  if (parts[1] === 'leftLeg' || parts[1] === 'rightLeg') {
    return PLAYER_POSE_SAFE_RANGES.leg[key as keyof typeof PLAYER_POSE_SAFE_RANGES.leg];
  }
  return PLAYER_POSE_SAFE_RANGES.limb[key as keyof typeof PLAYER_POSE_SAFE_RANGES.limb];
}

function getPosePathValue(pose: PlayerPoseDefinition, path: PoseFieldPath): number {
  const parts = path.split('.');
  if (parts[0] === 'body') {
    return pose.body[parts[1] as keyof PlayerPoseDefinition['body']];
  }
  const side = parts[1] as keyof PlayerPoseDefinition['limbs'];
  const key = parts[2]!;
  return (pose.limbs[side] as unknown as Record<string, number>)[key] ?? 0;
}

function setPosePathValue(pose: PlayerPoseDefinition, path: PoseFieldPath, value: number): void {
  const parts = path.split('.');
  if (parts[0] === 'body') {
    pose.body[parts[1] as keyof PlayerPoseDefinition['body']] = value;
    return;
  }
  const side = parts[1] as keyof PlayerPoseDefinition['limbs'];
  const key = parts[2]!;
  (pose.limbs[side] as unknown as Record<string, number>)[key] = value;
}

function formatUiValue(value: number, key: string): string {
  return ANGLE_FIELDS.has(key)
    ? (value * 180 / Math.PI).toFixed(1)
    : value.toFixed(2);
}

function parseUiValue(value: number, key: string): number {
  return ANGLE_FIELDS.has(key)
    ? value * Math.PI / 180
    : value;
}

function getHelperGeometry(): THREE.BufferGeometry {
  const cache = getHelperCache();
  if (!cache.sphere) {
    cache.sphere = new THREE.SphereGeometry(0.045, 8, 6);
  }
  return cache.sphere;
}

function getHelperMaterial(): THREE.Material {
  const cache = getHelperCache();
  if (!cache.material) {
    cache.material = new THREE.MeshBasicMaterial({ color: 0xf2d94b });
  }
  return cache.material;
}

function getFootMarkerGeometry(): THREE.BufferGeometry {
  const cache = getHelperCache();
  if (!cache.foot) {
    cache.foot = new THREE.CircleGeometry(0.18, 18);
  }
  return cache.foot;
}

function getFootMarkerMaterial(): THREE.Material {
  const cache = getHelperCache();
  if (!cache.footMaterial) {
    cache.footMaterial = new THREE.MeshBasicMaterial({
      color: 0x42d893,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
  }
  return cache.footMaterial;
}

interface PlayerLabHelperCache {
  foot?: THREE.BufferGeometry;
  footMaterial?: THREE.Material;
  material?: THREE.Material;
  sphere?: THREE.BufferGeometry;
}

function getHelperCache(): PlayerLabHelperCache {
  const globalObject = globalThis as typeof globalThis & {
    __footballPlayerLabHelperCache?: PlayerLabHelperCache;
  };
  globalObject.__footballPlayerLabHelperCache ??= {};
  return globalObject.__footballPlayerLabHelperCache;
}

function clonePlayerPoseClipForLab(clip: PlayerPoseClip): PlayerPoseClip {
  return {
    displayName: clip.displayName,
    frames: clip.frames.map((frame) => ({ ...frame })),
    id: clip.id,
    loop: clip.loop,
  };
}

function getClipDuration(clip: PlayerPoseClip): number {
  return Math.max(0.001, clip.frames.at(-1)?.timeSeconds ?? 1);
}

function pingPongTime(time: number, duration: number): number {
  const cycle = duration * 2;
  const wrapped = ((time % cycle) + cycle) % cycle;
  return wrapped <= duration ? wrapped : cycle - wrapped;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const startupValidation = validatePlayerPoseCollection(DEFAULT_PLAYER_POSES, DEFAULT_PLAYER_POSE_CLIPS);
if (!startupValidation.valid) {
  throw new Error(`Player lab preset validation failed: ${startupValidation.issues.join('; ')}`);
}

const mount = document.querySelector<HTMLDivElement>('#player-lab');
if (!mount) {
  throw new Error('Missing #player-lab mount');
}

const app = new PlayerPoseLab(mount);
app.start();
