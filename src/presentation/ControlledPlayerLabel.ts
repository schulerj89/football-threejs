import * as THREE from 'three';
import type { GameplayCameraDebugSnapshot } from '../camera/GameplayCameraController';
import type { GameplaySnapshot } from '../playState';
import {
  getRosterPlayerForGameplayId,
  type GameplayRosterBinding,
} from '../roster/GameplayRosterBinding';
import {
  formatRosterInitialName,
  type RosterPlayer,
} from '../roster/RosterPlayer';
import {
  getReadableTextColor,
  type TeamPresentationTheme,
} from '../teams/TeamThemeApplier';

export type PlayerLabelKind = 'controlled' | 'selectedReceiver';

export interface PlayerLabelSettings {
  controlledPlayerLabelEnabled: boolean;
  selectedReceiverLabelEnabled: boolean;
}

export interface PlayerLabelState {
  displayName: string | null;
  footballPosition: string | null;
  gameplayPlayerId: string | null;
  jerseyNumber: number | null;
  kind: PlayerLabelKind;
  labelPosition: { x: number; y: number; z: number };
  rosterPlayerId: string | null;
  visibilityReason: string;
  visible: boolean;
}

export interface ControlledPlayerLabelSnapshot {
  labels: PlayerLabelState[];
  textureCacheKeys: string[];
  textureCacheSize: number;
  visibleLabelCount: number;
}

const LABEL_CONFIG = {
  fieldLiftYards: 0.18,
  behindPlayerYards: 1.15,
  selectedReceiverSideOffsetYards: 1.1,
  canvasWidth: 256,
  canvasHeight: 128,
  perspectiveScaleFactor: 0.045,
  minWorldHeight: 0.72,
  maxWorldHeight: 1.65,
  orthographicWorldHeight: 1.12,
} as const;

export class ControlledPlayerLabelRenderer {
  readonly group = new THREE.Group();

  private readonly controlledSprite = createLabelSprite('controlled-player-label');
  private readonly selectedReceiverSprite = createLabelSprite('selected-receiver-label');
  private readonly textureCache = new Map<string, THREE.CanvasTexture>();
  private appPhase: 'coinToss' | 'gameplay' | 'kickoff' | 'matchSetup' | 'pregamePresentation' | 'title' = 'title';
  private binding: GameplayRosterBinding;
  private settings: PlayerLabelSettings;
  private snapshot: ControlledPlayerLabelSnapshot = {
    labels: [],
    textureCacheKeys: [],
    textureCacheSize: 0,
    visibleLabelCount: 0,
  };
  private teamKey: string;
  private teamTheme: TeamPresentationTheme;

  constructor(options: {
    binding: GameplayRosterBinding;
    settings: PlayerLabelSettings;
    teamTheme: TeamPresentationTheme;
  }) {
    this.binding = options.binding;
    this.settings = options.settings;
    this.teamTheme = options.teamTheme;
    this.teamKey = options.teamTheme.teamKey;
    this.group.name = 'controlled-player-labels';
    this.group.userData.controlledPlayerLabels = true;
    this.group.add(this.controlledSprite, this.selectedReceiverSprite);
  }

  setApplicationPhase(appPhase: 'coinToss' | 'gameplay' | 'kickoff' | 'matchSetup' | 'pregamePresentation' | 'title'): void {
    this.appPhase = appPhase;
  }

  setBinding(binding: GameplayRosterBinding): void {
    this.binding = binding;
  }

  setSettings(settings: PlayerLabelSettings): void {
    this.settings = settings;
  }

  setTeamTheme(teamTheme: TeamPresentationTheme): void {
    if (teamTheme.teamKey !== this.teamKey) {
      this.clearTextureCache();
      this.teamKey = teamTheme.teamKey;
    }
    this.teamTheme = teamTheme;
  }

  update(
    gameplay: GameplaySnapshot,
    camera: THREE.Camera,
    cameraSnapshot: GameplayCameraDebugSnapshot,
    gameplayActive = true,
  ): void {
    const labels = resolveControlledPlayerLabelStates({
      activeShotName: cameraSnapshot.activeShotName ?? null,
      appPhase: this.appPhase,
      binding: this.binding,
      gameplay,
      gameplayActive,
      settings: this.settings,
    });
    this.syncSprite(this.controlledSprite, labels[0], gameplay, camera);
    this.syncSprite(this.selectedReceiverSprite, labels[1], gameplay, camera);
    this.snapshot = {
      labels,
      textureCacheKeys: [...this.textureCache.keys()].sort(),
      textureCacheSize: this.textureCache.size,
      visibleLabelCount: labels.filter((label) => label.visible).length,
    };
  }

  getSnapshot(): ControlledPlayerLabelSnapshot {
    return {
      labels: this.snapshot.labels.map((label) => ({
        ...label,
        labelPosition: { ...label.labelPosition },
      })),
      textureCacheKeys: [...this.snapshot.textureCacheKeys],
      textureCacheSize: this.snapshot.textureCacheSize,
      visibleLabelCount: this.snapshot.visibleLabelCount,
    };
  }

  dispose(): void {
    this.clearTextureCache();
    for (const sprite of [this.controlledSprite, this.selectedReceiverSprite]) {
      const material = sprite.material as THREE.SpriteMaterial;
      material.map = null;
      material.dispose();
    }
    this.group.clear();
  }

  private syncSprite(
    sprite: THREE.Sprite,
    label: PlayerLabelState | undefined,
    gameplay: GameplaySnapshot,
    camera: THREE.Camera,
  ): void {
    if (!label?.visible || !label.gameplayPlayerId) {
      sprite.visible = false;
      return;
    }

    const rosterPlayer = getRosterPlayerForGameplayId(this.binding, label.gameplayPlayerId);
    if (!rosterPlayer) {
      sprite.visible = false;
      return;
    }

    const material = sprite.material as THREE.SpriteMaterial;
    const texture = this.getTexture(rosterPlayer, label.kind);
    if (material.map !== texture) {
      material.map = texture;
      material.needsUpdate = true;
    }

    sprite.position.set(
      label.labelPosition.x,
      label.labelPosition.y,
      label.labelPosition.z,
    );
    const worldHeight = calculateLabelWorldHeight(camera, sprite.position);
    sprite.scale.set(worldHeight * 2, worldHeight, 1);
    sprite.visible = true;
    sprite.userData.gameplayPlayerId = label.gameplayPlayerId;
    sprite.userData.rosterPlayerId = rosterPlayer.id;
    sprite.userData.playState = gameplay.playState;
  }

  private getTexture(
    rosterPlayer: RosterPlayer,
    kind: PlayerLabelKind,
  ): THREE.CanvasTexture {
    const cacheKey = `${rosterPlayer.id}:${kind}`;
    const existing = this.textureCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const texture = createLabelTexture(rosterPlayer, kind, this.teamTheme);
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  private clearTextureCache(): void {
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.textureCache.clear();
  }
}

export function resolveControlledPlayerLabelStates(options: {
  activeShotName: string | null;
    appPhase: 'coinToss' | 'gameplay' | 'kickoff' | 'matchSetup' | 'pregamePresentation' | 'title';
  binding: GameplayRosterBinding;
  gameplay: GameplaySnapshot;
  gameplayActive?: boolean;
  settings: PlayerLabelSettings;
}): [PlayerLabelState, PlayerLabelState] {
  const controlled = resolveLabelState('controlled', options.gameplay.player.id, options);
  const selectedReceiverId = options.gameplay.selectedReceiver?.id ?? null;
  const selected = resolveLabelState('selectedReceiver', selectedReceiverId, options);

  return [controlled, selected];
}

export function createControlledPlayerLabelOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'controlled-player-label-debug-overlay';
  return overlay;
}

export function syncControlledPlayerLabelOverlay(
  overlay: HTMLDivElement,
  snapshot: ControlledPlayerLabelSnapshot,
): void {
  overlay.replaceChildren(
    ...snapshot.labels.map((label) => {
      const line = document.createElement('div');
      const number = label.jerseyNumber === null ? '--' : `#${label.jerseyNumber}`;
      line.textContent = [
        label.kind,
        label.gameplayPlayerId ?? 'none',
        label.rosterPlayerId ?? 'none',
        label.displayName ?? 'none',
        number,
        label.visible ? 'visible' : label.visibilityReason,
        `pos ${label.labelPosition.x.toFixed(1)},${label.labelPosition.z.toFixed(1)}`,
      ].join(' | ');
      return line;
    }),
  );
}

function resolveLabelState(
  kind: PlayerLabelKind,
  gameplayPlayerId: string | null,
  options: {
    activeShotName: string | null;
    appPhase: 'coinToss' | 'gameplay' | 'kickoff' | 'matchSetup' | 'pregamePresentation' | 'title';
    binding: GameplayRosterBinding;
    gameplay: GameplaySnapshot;
    gameplayActive?: boolean;
    settings: PlayerLabelSettings;
  },
): PlayerLabelState {
  const basePlayer = gameplayPlayerId
    ? options.gameplay.players.find((player) => player.id === gameplayPlayerId) ?? null
    : null;
  const rosterPlayer = gameplayPlayerId
    ? getRosterPlayerForGameplayId(options.binding, gameplayPlayerId)
    : null;
  const labelPosition = basePlayer
    ? calculateLabelPosition(
        basePlayer.position.x,
        basePlayer.position.z,
        basePlayer.facingRadians,
        kind,
      )
    : { x: 0, y: LABEL_CONFIG.fieldLiftYards, z: 0 };
  const visibilityReason = getVisibilityReason(kind, gameplayPlayerId, options);

  return {
    displayName: rosterPlayer?.displayName ?? null,
    footballPosition: rosterPlayer?.footballPosition ?? null,
    gameplayPlayerId,
    jerseyNumber: rosterPlayer?.jerseyNumber ?? null,
    kind,
    labelPosition,
    rosterPlayerId: rosterPlayer?.id ?? null,
    visibilityReason,
    visible: visibilityReason === 'visible' && !!basePlayer && !!rosterPlayer,
  };
}

function getVisibilityReason(
  kind: PlayerLabelKind,
  gameplayPlayerId: string | null,
  options: {
    activeShotName: string | null;
    appPhase: 'coinToss' | 'gameplay' | 'kickoff' | 'matchSetup' | 'pregamePresentation' | 'title';
    gameplay: GameplaySnapshot;
    gameplayActive?: boolean;
    settings: PlayerLabelSettings;
  },
): string {
  if (options.appPhase !== 'gameplay') {
    return 'titleScreen';
  }

  if (options.gameplayActive === false) {
    return 'menuOrPaused';
  }

  if (options.gameplay.playState === 'gameOver') {
    return 'gameOver';
  }

  if (options.activeShotName) {
    return 'presentationShot';
  }

  if (kind === 'controlled' && !options.settings.controlledPlayerLabelEnabled) {
    return 'controlledLabelDisabled';
  }

  if (kind === 'selectedReceiver') {
    if (!options.settings.selectedReceiverLabelEnabled) {
      return 'selectedReceiverLabelDisabled';
    }
    if (!gameplayPlayerId) {
      return 'noSelectedReceiver';
    }
    if (gameplayPlayerId === options.gameplay.player.id) {
      return 'sameAsControlled';
    }
  }

  return gameplayPlayerId ? 'visible' : 'missingGameplayPlayer';
}

function calculateLabelPosition(
  x: number,
  z: number,
  facingRadians: number,
  kind: PlayerLabelKind,
): { x: number; y: number; z: number } {
  const backwardX = -Math.sin(facingRadians) * LABEL_CONFIG.behindPlayerYards;
  const backwardZ = -Math.cos(facingRadians) * LABEL_CONFIG.behindPlayerYards;
  const sideOffset = kind === 'selectedReceiver'
    ? LABEL_CONFIG.selectedReceiverSideOffsetYards
    : 0;

  return {
    x: x + backwardX + sideOffset,
    y: LABEL_CONFIG.fieldLiftYards,
    z: z + backwardZ,
  };
}

function createLabelSprite(name: string): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = name;
  sprite.renderOrder = 80;
  sprite.visible = false;
  return sprite;
}

function calculateLabelWorldHeight(camera: THREE.Camera, position: THREE.Vector3): number {
  if (camera instanceof THREE.PerspectiveCamera) {
    return clamp(
      camera.position.distanceTo(position) * LABEL_CONFIG.perspectiveScaleFactor,
      LABEL_CONFIG.minWorldHeight,
      LABEL_CONFIG.maxWorldHeight,
    );
  }

  return LABEL_CONFIG.orthographicWorldHeight;
}

function createLabelTexture(
  rosterPlayer: RosterPlayer,
  kind: PlayerLabelKind,
  teamTheme: TeamPresentationTheme,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CONFIG.canvasWidth;
  canvas.height = LABEL_CONFIG.canvasHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create controlled player label texture');
  }

  const team = rosterPlayer.id.startsWith(teamTheme.defense.profile.id)
    ? teamTheme.defense
    : teamTheme.offense;
  const background = kind === 'selectedReceiver'
    ? team.uniform.helmetShell
    : team.uniform.jersey;
  const foreground = getReadableTextColor(background);
  const accent = team.uniform.stripe;
  const name = formatRosterInitialName(rosterPlayer);
  const number = `#${rosterPlayer.jerseyNumber}`;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(8, 11, 14, 0.62)';
  roundedRect(context, 14, 14, canvas.width - 28, canvas.height - 28, 12);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 5;
  context.stroke();

  context.fillStyle = background;
  roundedRect(context, 22, 22, canvas.width - 44, canvas.height - 44, 8);
  context.fill();

  context.fillStyle = foreground;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = 'bold 30px monospace';
  context.fillText(name, canvas.width / 2, 48, canvas.width - 44);
  context.font = 'bold 34px monospace';
  context.fillText(number, canvas.width / 2, 86, canvas.width - 44);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = `label-${rosterPlayer.id}-${kind}`;
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
