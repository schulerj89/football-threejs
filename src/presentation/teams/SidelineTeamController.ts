import * as THREE from 'three';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';
import {
  createSidelineLayout,
} from './SidelineLayout';
import {
  createSidelineDebugOverlay,
  createSidelineVisualResources,
  syncSidelineDebugOverlay,
  type SidelineVisualResources,
} from './SidelineVisualFactory';
import type {
  SidelineDensity,
  SidelineLayout,
  SidelinePresentationSettings,
  SidelineTeamControllerSnapshot,
  SidelineTeamSide,
} from './SidelineTeamTypes';

export type { SidelineTeamControllerSnapshot } from './SidelineTeamTypes';

export interface SidelineTeamControllerOptions {
  enabled: boolean;
  density: SidelineDensity;
  rosterBinding: GameplayRosterBinding;
  teamTheme: TeamPresentationTheme;
  tunnelTableauEnabled: boolean;
}

const EMPTY_METRICS = {
  drawCalls: 0,
  geometryCount: 0,
  instanceBufferBytes: 0,
  materialCount: 0,
  meshCount: 0,
  textureCount: 0,
  triangleCount: 0,
} as const;

export class SidelineTeamController {
  readonly group = new THREE.Group();

  private enabled: boolean;
  private density: SidelineDensity;
  private tunnelTableauEnabled: boolean;
  private rosterBinding: GameplayRosterBinding;
  private teamTheme: TeamPresentationTheme;
  private layout: SidelineLayout | null = null;
  private resources: SidelineVisualResources | null = null;
  private resourceKey: string | null = null;

  constructor(options: SidelineTeamControllerOptions) {
    this.enabled = options.enabled;
    this.density = options.density;
    this.tunnelTableauEnabled = options.tunnelTableauEnabled;
    this.rosterBinding = options.rosterBinding;
    this.teamTheme = options.teamTheme;
    this.group.name = 'sideline-team-controller';
    this.group.userData.sidelinePresentation = true;
    this.group.visible = this.enabled;
    this.rebuildIfNeeded();
  }

  applySettings(options: SidelineTeamControllerOptions): void {
    this.enabled = options.enabled;
    this.density = options.density;
    this.tunnelTableauEnabled = options.tunnelTableauEnabled;
    this.rosterBinding = options.rosterBinding;
    this.teamTheme = options.teamTheme;
    this.group.visible = this.enabled;

    if (!this.enabled) {
      this.disposeResources();
      return;
    }

    this.rebuildIfNeeded();
  }

  update(): void {
    if (!this.enabled) {
      return;
    }
    this.rebuildIfNeeded();
  }

  getSettings(): SidelinePresentationSettings {
    return {
      density: this.density,
      enabled: this.enabled,
      tunnelTableauEnabled: this.tunnelTableauEnabled,
    };
  }

  getSnapshot(): SidelineTeamControllerSnapshot {
    const metrics = this.resources?.metrics ?? EMPTY_METRICS;
    return {
      ...metrics,
      density: this.density,
      enabled: this.enabled,
      noGameplayAuthority: true,
      sidelinePlayerCount: this.layout?.sidelinePlacements.length ?? 0,
      teamKey: this.teamTheme.teamKey,
      tunnelPlayerCount: this.layout?.tunnelPlacements.length ?? 0,
      tunnelTableauEnabled: this.tunnelTableauEnabled,
      updateFrequencyHz: 0,
      zones: this.layout?.zones.map((zone) => ({
        bounds: { ...zone.bounds },
        center: { ...zone.center },
        id: zone.id,
        teamSide: zone.teamSide,
      })) ?? [],
    };
  }

  dispose(): void {
    this.disposeResources();
    this.group.removeFromParent();
  }

  private rebuildIfNeeded(): void {
    if (!this.enabled) {
      return;
    }

    const key = this.createResourceKey();
    if (this.resources && this.resourceKey === key) {
      return;
    }

    this.disposeResources();
    this.resourceKey = key;
    this.layout = createSidelineLayout({
      density: this.density,
      featuredTunnelTeamSide: 'user',
      rosterAppearanceIds: createRosterAppearanceIds(this.rosterBinding),
      tunnelTableauEnabled: this.tunnelTableauEnabled,
    });
    this.resources = createSidelineVisualResources(this.layout.allPlacements, this.teamTheme);
    this.group.add(this.resources.group);
  }

  private disposeResources(): void {
    if (this.resources) {
      this.group.remove(this.resources.group);
      this.resources.dispose();
      this.resources = null;
    }
    this.layout = null;
    this.resourceKey = null;
  }

  private createResourceKey(): string {
    const lineupKey = this.rosterBinding.activeLineup.bindings
      .map((binding) => `${binding.gameplayPlayerId}:${binding.rosterPlayerId}`)
      .join('|');
    return [
      this.enabled ? 'enabled' : 'disabled',
      this.density,
      this.tunnelTableauEnabled ? 'tunnel' : 'no-tunnel',
      this.teamTheme.teamKey,
      lineupKey,
    ].join('::');
  }
}

export {
  createSidelineDebugOverlay,
  syncSidelineDebugOverlay,
};

function createRosterAppearanceIds(
  binding: GameplayRosterBinding,
): Partial<Record<SidelineTeamSide, readonly string[]>> {
  return {
    opponent: binding.activeLineup.bindings
      .filter((lineupBinding) => lineupBinding.team === 'defense')
      .map((lineupBinding) => lineupBinding.rosterPlayerId)
      .slice(0, 11),
    user: binding.activeLineup.bindings
      .filter((lineupBinding) => lineupBinding.team === 'offense')
      .map((lineupBinding) => lineupBinding.rosterPlayerId)
      .slice(0, 11),
  };
}
