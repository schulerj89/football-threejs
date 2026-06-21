import * as THREE from 'three';
import { OFFICIAL_POSITIONING_CONFIG } from './OfficialConfiguration';
import {
  createOfficialCrewState,
  resetOfficialCrewState,
  snapshotOfficialState,
  updateOfficialCrewState,
} from './OfficialSimulation';
import {
  createOfficialVisualResources,
  syncOfficialVisualResources,
  type OfficialVisualResources,
} from './OfficialVisualFactory';
import type { GameplaySnapshot } from '../playState';
import type {
  OfficialCrewState,
  OfficialsPresentationSnapshot,
  OfficialVisualMetrics,
} from './OfficialTypes';

export type { OfficialsPresentationSnapshot } from './OfficialTypes';

export interface OfficialsPresentationControllerOptions {
  debugLabelsEnabled?: boolean;
  enabled: boolean;
}

const EMPTY_VISUAL_METRICS: OfficialVisualMetrics = {
  geometryCount: 0,
  materialCount: 0,
  meshCount: 0,
  triangleCount: 0,
};

export class OfficialsPresentationController {
  readonly group = new THREE.Group();

  private debugLabelsEnabled: boolean;
  private enabled: boolean;
  private resources: OfficialVisualResources | null = null;
  private state: OfficialCrewState | null = null;

  constructor({ debugLabelsEnabled = false, enabled }: OfficialsPresentationControllerOptions) {
    this.debugLabelsEnabled = debugLabelsEnabled;
    this.enabled = enabled;
    this.group.name = 'officials-presentation-controller';
    this.group.userData.officialsPresentation = true;
    this.group.visible = enabled;
  }

  applySettings({ debugLabelsEnabled, enabled }: OfficialsPresentationControllerOptions): void {
    this.debugLabelsEnabled = debugLabelsEnabled ?? false;
    this.enabled = enabled;
    this.group.visible = enabled;

    if (!enabled) {
      this.disposeResources();
    }
  }

  reset(snapshot: GameplaySnapshot): void {
    if (!this.enabled) {
      return;
    }

    if (!this.state) {
      this.state = createOfficialCrewState(snapshot);
    } else {
      resetOfficialCrewState(this.state, snapshot);
    }
    this.ensureResources();
    this.syncVisuals();
  }

  update(snapshot: GameplaySnapshot, deltaSeconds: number, active: boolean): void {
    if (!this.enabled) {
      return;
    }

    if (!this.state) {
      this.state = createOfficialCrewState(snapshot);
    }

    this.ensureResources();
    updateOfficialCrewState(this.state, snapshot, deltaSeconds, { active });
    this.syncVisuals();
  }

  getSnapshot(): OfficialsPresentationSnapshot {
    const officials = this.state
      ? snapshotOfficialState(this.state).map((official) => ({
          assignedSideline: official.assignedSideline,
          currentPosition: { ...official.position },
          distanceFromBall: official.distanceFromBall,
          facingRadians: official.facingRadians,
          id: official.id,
          poseIntent: official.poseIntent,
          role: official.role,
          targetPosition: { ...official.targetPosition },
          updateState: official.updateState,
        }))
      : [];

    return {
      debugLabelsEnabled: this.debugLabelsEnabled,
      enabled: this.enabled,
      officials,
      targetUpdateHz: OFFICIAL_POSITIONING_CONFIG.liveTargetUpdateHz,
      visibleOfficialCount: this.enabled ? officials.length : 0,
      visualMetrics: this.resources?.metrics ?? EMPTY_VISUAL_METRICS,
    };
  }

  dispose(): void {
    this.disposeResources();
    this.group.removeFromParent();
  }

  private ensureResources(): void {
    if (this.resources || !this.state) {
      return;
    }

    this.resources = createOfficialVisualResources(this.state.officials);
    this.group.add(this.resources.group);
  }

  private syncVisuals(): void {
    if (!this.resources || !this.state) {
      return;
    }

    syncOfficialVisualResources(this.resources, this.state.officials);
  }

  private disposeResources(): void {
    if (!this.resources) {
      this.state = null;
      return;
    }

    this.group.remove(this.resources.group);
    this.resources.dispose();
    this.resources = null;
    this.state = null;
  }
}

export {
  createOfficialsDebugOverlay,
  syncOfficialsDebugOverlay,
} from './OfficialVisualFactory';
