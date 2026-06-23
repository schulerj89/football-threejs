import * as THREE from 'three';
import type { PresentationAudioEvent } from '../../audio/PresentationEventBridge';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import type { FootballPosition, RosterPlayer } from '../../roster/RosterPlayer';
import {
  getRosterPlayer,
  type TeamRoster,
} from '../../roster/TeamRoster';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';
import type { PlayerRole } from '../../playerModel';
import type { FootballPlayerVisualFactoryOptions } from '../players/FootballPlayerVisualFactory';
import type { PlayerVisualMode } from '../players/PlayerVisualMode';
import {
  createSidelineLayout,
} from './SidelineLayout';
import {
  createSidelineDebugOverlay,
  createSidelineFootballPlayerVisualResources,
  syncSidelineDebugOverlay,
  type SidelineVisualResources,
} from './SidelineVisualFactory';
import type {
  SidelineCoachPlacement,
  SidelineCoachState,
  SidelineDensity,
  SidelineLayout,
  SidelinePresentationSettings,
  SidelineReactionState,
  SidelineRosterIdentity,
  SidelineTeamControllerSnapshot,
  SidelineTeamSide,
} from './SidelineTeamTypes';

export type { SidelineTeamControllerSnapshot } from './SidelineTeamTypes';

export interface SidelineTeamControllerOptions {
  coachesEnabled: boolean;
  enabled: boolean;
  density: SidelineDensity;
  footballPlayerVisual?: Pick<
    FootballPlayerVisualFactoryOptions,
    'attachHelmet' | 'helmet' | 'playerVisualOptions'
  >;
  rosterBinding: GameplayRosterBinding;
  playerVisualMode?: PlayerVisualMode;
  sidelinePlayersEnabled: boolean;
  teamTheme: TeamPresentationTheme;
  tunnelTableauEnabled: boolean;
}

const SIDELINE_UPDATE_FREQUENCY_HZ = 12;
const SIDELINE_REACTION_DURATIONS: Record<SidelineReactionState, number> = {
  disappointed: 1.8,
  firstDown: 1.45,
  idle: 0,
  touchdown: 3.0,
  watching: 0,
} as const;

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

  private coachesEnabled: boolean;
  private enabled: boolean;
  private density: SidelineDensity;
  private sidelinePlayersEnabled: boolean;
  private tunnelTableauEnabled: boolean;
  private playerVisualMode?: PlayerVisualMode;
  private footballPlayerVisual?: Pick<
    FootballPlayerVisualFactoryOptions,
    'attachHelmet' | 'helmet' | 'playerVisualOptions'
  >;
  private rosterBinding: GameplayRosterBinding;
  private teamTheme: TeamPresentationTheme;
  private layout: SidelineLayout | null = null;
  private resources: SidelineVisualResources | null = null;
  private resourceKey: string | null = null;
  private lastReactionEventId: string | null = null;
  private reactionRemainingSeconds = 0;
  private reactionState: SidelineReactionState = 'idle';
  private readonly processedEventIds = new Set<string>();
  private visualSyncDirty = false;

  constructor(options: SidelineTeamControllerOptions) {
    this.coachesEnabled = options.coachesEnabled;
    this.enabled = options.enabled;
    this.density = options.density;
    this.sidelinePlayersEnabled = options.sidelinePlayersEnabled;
    this.tunnelTableauEnabled = options.tunnelTableauEnabled;
    this.rosterBinding = options.rosterBinding;
    this.playerVisualMode = options.playerVisualMode;
    this.footballPlayerVisual = options.footballPlayerVisual;
    this.teamTheme = options.teamTheme;
    this.group.name = 'sideline-team-controller';
    this.group.userData.sidelinePresentation = true;
    this.group.visible = this.enabled;
    this.rebuildIfNeeded();
  }

  applySettings(options: SidelineTeamControllerOptions): void {
    this.coachesEnabled = options.coachesEnabled;
    this.enabled = options.enabled;
    this.density = options.density;
    this.sidelinePlayersEnabled = options.sidelinePlayersEnabled;
    this.tunnelTableauEnabled = options.tunnelTableauEnabled;
    this.rosterBinding = options.rosterBinding;
    this.playerVisualMode = options.playerVisualMode;
    this.footballPlayerVisual = options.footballPlayerVisual;
    this.teamTheme = options.teamTheme;
    this.group.visible = this.enabled;

    if (!this.enabled) {
      this.disposeResources();
      return;
    }

    this.rebuildIfNeeded();
  }

  update(
    events: readonly PresentationAudioEvent[] = [],
    deltaSeconds = 0,
  ): void {
    if (!this.enabled) {
      return;
    }
    this.rebuildIfNeeded();
    this.processPresentationEvents(events);
    this.advanceReaction(deltaSeconds);
    this.syncVisualsIfNeeded();
  }

  getSettings(): SidelinePresentationSettings {
    return {
      coachesEnabled: this.coachesEnabled,
      density: this.density,
      enabled: this.enabled,
      sidelinePlayersEnabled: this.sidelinePlayersEnabled,
      tunnelTableauEnabled: this.tunnelTableauEnabled,
    };
  }

  getSnapshot(): SidelineTeamControllerSnapshot {
    const metrics = this.resources?.metrics ?? EMPTY_METRICS;
    const coachPlacements = this.createCoachPlacements();
    return {
      ...metrics,
      coachCount: coachPlacements.length,
      coachesEnabled: this.coachesEnabled,
      coachStates: coachPlacements.map((coach) => ({
        id: coach.id,
        state: coach.state,
        teamSide: coach.teamSide,
      })),
      density: this.density,
      enabled: this.enabled,
      lastReactionEventId: this.lastReactionEventId,
      noGameplayAuthority: true,
      reactionState: this.reactionState,
      semanticTargets: {
        opponentCoach: cloneVec3(coachPlacements.find((coach) => coach.teamSide === 'opponent')?.position),
        opponentSidelineGroup: cloneVec3(this.findZoneCenter('opponent-sideline')),
        userCoach: cloneVec3(coachPlacements.find((coach) => coach.teamSide === 'user')?.position),
        userSidelineGroup: cloneVec3(this.findZoneCenter('user-sideline')),
      },
      fullFootballPlayerVisualCount: countFullFootballPlayerVisuals(this.resources?.group ?? null),
      sidelineRosterPlayerIds: this.layout?.sidelinePlacements
        .map((placement) => placement.rosterPlayerId)
        .filter((id): id is string => Boolean(id)) ?? [],
      sidelinePlayerCount: this.layout?.sidelinePlacements.length ?? 0,
      sidelinePlayersEnabled: this.sidelinePlayersEnabled,
      teamKey: this.teamTheme.teamKey,
      tunnelRosterPlayerIds: this.layout?.tunnelPlacements
        .map((placement) => placement.rosterPlayerId)
        .filter((id): id is string => Boolean(id)) ?? [],
      tunnelPlayerCount: this.layout?.tunnelPlacements.length ?? 0,
      tunnelTableauEnabled: this.tunnelTableauEnabled,
      updateFrequencyHz: SIDELINE_UPDATE_FREQUENCY_HZ,
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
      coachesEnabled: this.coachesEnabled,
      density: this.density,
      featuredTunnelTeamSide: 'user',
      rosterAppearanceIds: createRosterAppearanceIds(this.rosterBinding),
      rosterIdentities: createRosterIdentities(this.rosterBinding),
      sidelinePlayersEnabled: this.sidelinePlayersEnabled,
      tunnelTableauEnabled: this.tunnelTableauEnabled,
    });
    this.resources = createSidelineFootballPlayerVisualResources(this.layout.allPlacements, this.teamTheme, {
      coachPlacements: this.createCoachPlacements(),
      footballPlayerVisual: this.footballPlayerVisual,
      playerVisualMode: this.playerVisualMode,
      reactionState: this.reactionState,
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
      this.sidelinePlayersEnabled ? 'reserves' : 'no-reserves',
      this.coachesEnabled ? 'coaches' : 'no-coaches',
      this.density,
      this.tunnelTableauEnabled ? 'tunnel' : 'no-tunnel',
      this.teamTheme.teamKey,
      lineupKey,
    ].join('::');
  }

  private processPresentationEvents(events: readonly PresentationAudioEvent[]): void {
    for (const event of events) {
      if (this.processedEventIds.has(event.id)) {
        continue;
      }
      this.processedEventIds.add(event.id);
      if (this.processedEventIds.size > 64) {
        const oldestEventId = this.processedEventIds.values().next().value;
        if (oldestEventId) {
          this.processedEventIds.delete(oldestEventId);
        }
      }

      const nextReaction = resolveReactionStateFromEvent(event.type);
      if (!nextReaction) {
        continue;
      }

      this.lastReactionEventId = event.id;
      this.setReactionState(nextReaction);
    }
  }

  private advanceReaction(deltaSeconds: number): void {
    if (this.reactionRemainingSeconds <= 0) {
      return;
    }

    this.reactionRemainingSeconds = Math.max(0, this.reactionRemainingSeconds - Math.max(0, deltaSeconds));
    if (this.reactionRemainingSeconds === 0 && this.reactionState !== 'idle') {
      this.setReactionState('idle');
    }
  }

  private setReactionState(nextState: SidelineReactionState): void {
    this.reactionState = nextState;
    this.reactionRemainingSeconds = SIDELINE_REACTION_DURATIONS[nextState];
    this.visualSyncDirty = true;
  }

  private syncVisualsIfNeeded(): void {
    if (!this.visualSyncDirty || !this.resources || !this.layout) {
      return;
    }

    this.resources.sync(this.layout.allPlacements, this.teamTheme, {
      coachPlacements: this.createCoachPlacements(),
      footballPlayerVisual: this.footballPlayerVisual,
      playerVisualMode: this.playerVisualMode,
      reactionState: this.reactionState,
    });
    this.visualSyncDirty = false;
  }

  private createCoachPlacements(): readonly SidelineCoachPlacement[] {
    return this.layout?.coachPlacements.map((coach) => ({
      ...coach,
      state: this.resolveCoachState(),
    })) ?? [];
  }

  private resolveCoachState(): SidelineCoachState {
    if (this.reactionState === 'touchdown') {
      return 'touchdownCelebration';
    }
    if (this.reactionState === 'firstDown') {
      return 'firstDownApproval';
    }
    if (this.reactionState === 'disappointed') {
      return 'disappointedResult';
    }
    if (this.reactionState === 'watching') {
      return 'watchingPlay';
    }
    return 'neutral';
  }

  private findZoneCenter(id: SidelineTeamControllerSnapshot['zones'][number]['id']) {
    return this.layout?.zones.find((zone) => zone.id === id)?.center ?? null;
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

function createRosterIdentities(
  binding: GameplayRosterBinding,
): Partial<Record<SidelineTeamSide, readonly SidelineRosterIdentity[]>> {
  return {
    opponent: createTeamRosterIdentities(binding.opponentRoster, 'opponent'),
    user: createTeamRosterIdentities(binding.userRoster, 'user'),
  };
}

function createTeamRosterIdentities(
  roster: TeamRoster,
  side: SidelineTeamSide,
): SidelineRosterIdentity[] {
  const inactiveStarterIds = side === 'user'
    ? roster.defensiveStarterIds
    : roster.offensiveStarterIds;
  const lastResortStarterIds = side === 'user'
    ? roster.offensiveStarterIds
    : roster.defensiveStarterIds;
  const orderedIds = uniqueIds([
    ...roster.reserveIds,
    roster.kickerId,
    roster.punterId,
    roster.longSnapperId,
    ...inactiveStarterIds,
    ...lastResortStarterIds,
  ]);

  return orderedIds
    .map((id) => getRosterPlayer(roster, id))
    .filter((player): player is RosterPlayer => Boolean(player))
    .map((player) => ({
      appearanceId: player.appearanceId,
      footballPosition: player.footballPosition,
      jerseyNumber: player.jerseyNumber,
      role: resolveVisualRoleForFootballPosition(player.footballPosition),
      rosterPlayerId: player.id,
    }));
}

function resolveVisualRoleForFootballPosition(position: FootballPosition): PlayerRole {
  switch (position) {
    case 'QB':
      return 'quarterback';
    case 'RB':
      return 'runner';
    case 'SLOT':
    case 'TE':
    case 'WR':
      return 'receiver';
    case 'C':
    case 'LG':
    case 'LS':
    case 'LT':
    case 'P':
    case 'RG':
    case 'RT':
      return 'blocker';
    case 'CB':
    case 'FS':
    case 'SS':
      return 'coverageDefender';
    case 'DL':
    case 'ILB':
    case 'K':
    case 'OLB':
      return 'defender';
  }
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

function countFullFootballPlayerVisuals(root: THREE.Object3D | null): number {
  if (!root) {
    return 0;
  }
  let count = 0;
  root.traverse((object) => {
    if (object.userData.fullFootballPlayerVisual === true) {
      count += 1;
    }
  });
  return count;
}

function resolveReactionStateFromEvent(
  eventType: PresentationAudioEvent['type'],
): SidelineReactionState | null {
  if (eventType === 'playPrepared' || eventType === 'playReset') {
    return 'idle';
  }

  if (eventType === 'playStarted') {
    return 'watching';
  }

  if (eventType === 'touchdown') {
    return 'touchdown';
  }

  if (eventType === 'firstDown') {
    return 'firstDown';
  }

  if (
    eventType === 'incomplete' ||
    eventType === 'outOfBounds' ||
    eventType === 'sack' ||
    eventType === 'tackle' ||
    eventType === 'turnoverOnDowns'
  ) {
    return 'disappointed';
  }

  return null;
}

function cloneVec3(value: SidelineCoachPlacement['position'] | null | undefined) {
  return value ? { ...value } : null;
}
