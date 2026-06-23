import * as THREE from 'three';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import { createQuarterbackScoutingProfile } from '../../roster/QuarterbackScoutingProfile';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';
import type { PlayerVisualMode } from '../players/PlayerVisualMode';
import {
  createPregameWarmupLayout,
} from './PregameWarmupLayout';
import type {
  PregameWarmupGroup,
  PregameWarmupLayout,
  PregameWarmupQuarterbackAppearanceAudit,
  PregameWarmupSnapshot,
  PregameWarmupSubjectBounds,
} from './PregameWarmupTypes';
import {
  createEmptyWarmupVisualMetrics,
  createPregameWarmupVisualResources,
  type PregameWarmupVisualResources,
} from './PregameWarmupVisualFactory';

export interface PregameWarmupControllerOptions {
  enabled: boolean;
  playerVisualMode?: PlayerVisualMode;
  rosterBinding: GameplayRosterBinding;
  teamTheme: TeamPresentationTheme;
}

const WARMUP_UPDATE_FREQUENCY_HZ = 10;

export class PregameWarmupController {
  readonly group = new THREE.Group();

  private active = false;
  private enabled: boolean;
  private layout: PregameWarmupLayout | null = null;
  private resources: PregameWarmupVisualResources | null = null;
  private resourceKey: string | null = null;
  private playerVisualMode: PlayerVisualMode;
  private rosterBinding: GameplayRosterBinding;
  private teamTheme: TeamPresentationTheme;

  constructor(options: PregameWarmupControllerOptions) {
    this.enabled = options.enabled;
    this.playerVisualMode = options.playerVisualMode ?? 'procedural';
    this.rosterBinding = options.rosterBinding;
    this.teamTheme = options.teamTheme;
    this.group.name = 'pregame-warmup-controller';
    this.group.userData.pregameWarmup = true;
    this.group.visible = false;
  }

  applySettings(options: PregameWarmupControllerOptions): void {
    this.enabled = options.enabled;
    this.playerVisualMode = options.playerVisualMode ?? 'procedural';
    this.rosterBinding = options.rosterBinding;
    this.teamTheme = options.teamTheme;
    this.group.visible = this.enabled && this.active;

    if (!this.enabled) {
      this.disposeResources();
      return;
    }

    if (this.active) {
      this.rebuildIfNeeded();
    }
  }

  setActive(active: boolean): void {
    this.active = active;
    this.group.visible = this.enabled && this.active;
    if (this.group.visible) {
      this.rebuildIfNeeded();
    }
  }

  update(): void {
    if (!this.enabled || !this.active) {
      return;
    }
    this.rebuildIfNeeded();
  }

  getSnapshot(): PregameWarmupSnapshot {
    const metrics = this.resources?.metrics ?? createEmptyWarmupVisualMetrics();
    const layout = this.layout;
    const quarterback = layout?.userQuarterback ?? null;
    const profile = createQuarterbackScoutingProfile(quarterback?.player ?? null);
    const quarterbackAppearance = this.resources?.getQuarterbackAppearanceAudit() ??
      createMissingQuarterbackAppearanceAudit(quarterback?.player?.id ?? null);

    return {
      cloneCount: layout?.placements.length ?? 0,
      drawCalls: metrics.drawCalls,
      enabled: this.enabled && this.active,
      geometryCount: metrics.geometryCount,
      groupCount: layout?.groups.length ?? 0,
      groups: layout?.groups.map(cloneGroup) ?? [],
      instanceBufferBytes: metrics.instanceBufferBytes,
      materialCount: metrics.materialCount,
      meshCount: metrics.meshCount,
      noGameplayAuthority: true,
      opponentReady: Boolean(layout?.opponentQuarterback),
      playerCount: layout?.placements.length ?? 0,
      propCount: layout?.props.length ?? 0,
      quarterback: quarterback
        ? {
            appearance: quarterbackAppearance,
            archetype: profile.archetype,
            bounds: placementToSubjectBounds(quarterback, 'user-quarterback-warmup'),
            facingRadians: quarterback.facingRadians,
            formattedName: profile.formattedName,
            jerseyNumber: profile.jerseyNumber,
            ratings: profile.ratings,
            rosterPlayerId: profile.rosterPlayerId,
            strengths: [...profile.strengths],
          }
        : null,
      ready: Boolean(layout?.userQuarterback && layout.opponentQuarterback),
      teamKey: this.teamTheme.teamKey,
      textureCount: metrics.textureCount,
      triangleCount: metrics.triangleCount,
      updateFrequencyHz: WARMUP_UPDATE_FREQUENCY_HZ,
      userReady: Boolean(layout?.userQuarterback),
      zones: layout?.zones.map((zone) => ({
        bounds: { ...zone.bounds },
        center: { ...zone.center },
        id: zone.id,
        teamSide: zone.teamSide,
      })) ?? [],
    };
  }

  getSubjectBoundsForGroup(groupId: string): PregameWarmupSubjectBounds | null {
    const group = this.layout?.groups.find((candidate) => candidate.id === groupId);
    return group ? groupToSubjectBounds(group) : null;
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
    this.layout = createPregameWarmupLayout(this.rosterBinding);
    this.resources = createPregameWarmupVisualResources(this.layout, this.teamTheme, {
      footballPlayerVisual: {
        playerVisualOptions: {
          visualMode: this.playerVisualMode,
        },
      },
    });
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
      this.playerVisualMode,
      this.teamTheme.teamKey,
      lineupKey,
    ].join('::');
  }
}

function placementToSubjectBounds(
  placement: { position: { x: number; z: number } },
  source: string,
): PregameWarmupSubjectBounds {
  const halfWidth = 1.05;
  const halfDepth = 1.25;
  return {
    center: {
      x: placement.position.x,
      y: 1.28,
      z: placement.position.z,
    },
    max: {
      x: placement.position.x + halfWidth,
      z: placement.position.z + halfDepth,
    },
    min: {
      x: placement.position.x - halfWidth,
      z: placement.position.z - halfDepth,
    },
    size: {
      x: halfWidth * 2,
      z: halfDepth * 2,
    },
    source,
  };
}

function groupToSubjectBounds(group: PregameWarmupGroup): PregameWarmupSubjectBounds {
  return {
    center: {
      x: (group.bounds.minX + group.bounds.maxX) / 2,
      y: 1.45,
      z: (group.bounds.minZ + group.bounds.maxZ) / 2,
    },
    max: {
      x: group.bounds.maxX,
      z: group.bounds.maxZ,
    },
    min: {
      x: group.bounds.minX,
      z: group.bounds.minZ,
    },
    size: {
      x: group.bounds.maxX - group.bounds.minX,
      z: group.bounds.maxZ - group.bounds.minZ,
    },
    source: group.id,
  };
}

function cloneGroup(group: PregameWarmupGroup): PregameWarmupGroup {
  return {
    bounds: { ...group.bounds },
    groupId: group.groupId,
    id: group.id,
    placements: group.placements.map((placement) => ({
      ...placement,
      player: placement.player ? { ...placement.player } : null,
      position: { ...placement.position },
    })),
    props: group.props.map((prop) => ({
      ...prop,
      position: { ...prop.position },
    })),
    ready: group.ready,
    teamSide: group.teamSide,
  };
}

function createMissingQuarterbackAppearanceAudit(
  rosterPlayerId: string | null,
): PregameWarmupQuarterbackAppearanceAudit {
  return {
    bodyReady: false,
    faceguardMaterialName: null,
    fallbackReason: 'bodyMissing',
    headBounds: null,
    helmetAssetId: 'football-helmet-kit',
    helmetBounds: null,
    helmetReady: false,
    playerAssetStatus: 'idle',
    rosterPlayerId,
    shellMaterialName: null,
    subjectReady: false,
    subjectVisible: false,
  };
}
