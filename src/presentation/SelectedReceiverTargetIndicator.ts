import * as THREE from 'three';
import type { FootballSpot } from '../fieldScale';
import type { GameplaySnapshot } from '../playState';

export interface SelectedReceiverTargetIndicatorState {
  receiverId: string | null;
  position: FootballSpot | null;
  visible: boolean;
  visibilityReason: string;
}

export interface SelectedReceiverTargetIndicatorSnapshot extends SelectedReceiverTargetIndicatorState {
  pulseScale: number;
}

const INDICATOR_CONFIG = {
  heightY: 0.115,
  innerRadius: 0.72,
  outerRadius: 1.02,
  pulseAmplitude: 0.08,
  pulseSpeed: 5.8,
} as const;

export class SelectedReceiverTargetIndicator {
  readonly group = new THREE.Group();

  private readonly ringGeometry = new THREE.RingGeometry(
    INDICATOR_CONFIG.innerRadius,
    INDICATOR_CONFIG.outerRadius,
    48,
  );
  private readonly ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x39ff79,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.86,
  });
  private readonly ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private elapsedSeconds = 0;
  private state: SelectedReceiverTargetIndicatorState = {
    position: null,
    receiverId: null,
    visibilityReason: 'notUpdated',
    visible: false,
  };

  constructor() {
    this.group.name = 'selected-receiver-target-indicator';
    this.group.userData.selectedReceiverTargetIndicator = true;
    this.ring.name = 'selected-receiver-target-indicator-ring';
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 12;
    this.group.add(this.ring);
    this.group.visible = false;
  }

  update(gameplay: GameplaySnapshot, deltaSeconds: number): void {
    this.elapsedSeconds += deltaSeconds;
    this.state = resolveSelectedReceiverTargetIndicatorState(gameplay);
    this.group.visible = this.state.visible;

    if (!this.state.visible || !this.state.position) {
      return;
    }

    const pulseScale = this.resolvePulseScale();
    this.group.position.set(
      this.state.position.x,
      INDICATOR_CONFIG.heightY,
      this.state.position.z,
    );
    this.group.scale.setScalar(pulseScale);
  }

  getSnapshot(): SelectedReceiverTargetIndicatorSnapshot {
    return {
      ...this.state,
      position: this.state.position ? { ...this.state.position } : null,
      pulseScale: this.resolvePulseScale(),
    };
  }

  dispose(): void {
    this.ringGeometry.dispose();
    this.ringMaterial.dispose();
    this.group.clear();
  }

  private resolvePulseScale(): number {
    return 1 + Math.sin(this.elapsedSeconds * INDICATOR_CONFIG.pulseSpeed) *
      INDICATOR_CONFIG.pulseAmplitude;
  }
}

export function resolveSelectedReceiverTargetIndicatorState(
  gameplay: GameplaySnapshot,
): SelectedReceiverTargetIndicatorState {
  if (gameplay.playState !== 'live') {
    return {
      position: null,
      receiverId: gameplay.selectedReceiver?.id ?? null,
      visibilityReason: 'notLive',
      visible: false,
    };
  }

  if (gameplay.selectedPlay.kind !== 'pass') {
    return {
      position: null,
      receiverId: null,
      visibilityReason: 'notPassPlay',
      visible: false,
    };
  }

  if (gameplay.passAttempted || gameplay.ball.state.kind === 'inFlight') {
    return {
      position: null,
      receiverId: gameplay.selectedReceiver?.id ?? null,
      visibilityReason: 'passAlreadyThrown',
      visible: false,
    };
  }

  if (
    gameplay.ball.possession.kind !== 'player' ||
    gameplay.ball.possession.playerId !== gameplay.player.id
  ) {
    return {
      position: null,
      receiverId: gameplay.selectedReceiver?.id ?? null,
      visibilityReason: 'notQuarterbackPossession',
      visible: false,
    };
  }

  const receiverId = gameplay.selectedReceiver?.id ?? null;
  const receiver = receiverId
    ? gameplay.players.find((player) => player.id === receiverId) ?? null
    : null;

  if (!receiverId || !receiver) {
    return {
      position: null,
      receiverId,
      visibilityReason: 'missingSelectedReceiver',
      visible: false,
    };
  }

  return {
    position: { ...receiver.position },
    receiverId,
    visibilityReason: 'visible',
    visible: true,
  };
}
