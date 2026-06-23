import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FIELD_BOUNDS } from '../../../src/fieldSpec';
import {
  createSidelineLayout,
  createSidelineZones,
  isOutsideProtectedFieldBounds,
  isSidelinePlacementInsideZone,
  SIDELINE_DENSITY_COUNTS,
} from '../../../src/presentation/teams/SidelineLayout';
import { SidelineTeamController } from '../../../src/presentation/teams/SidelineTeamController';
import {
  createSidelineVisualResources,
} from '../../../src/presentation/teams/SidelineVisualFactory';
import { FOOTBALL_PLAYER_VISUAL_PROFILE_ID } from '../../../src/presentation/players/FootballPlayerVisualFactory';
import {
  resolveTunnelAnchor,
} from '../../../src/presentation/teams/TunnelTableauLayout';
import { createGameplayModel, snapshotGameplayModel } from '../../../src/playState';
import { createGameplayRosterBinding } from '../../../src/roster/GameplayRosterBinding';
import { DEFAULT_TEAM_PROFILE_SETTINGS } from '../../../src/teams/TeamProfileStore';
import { resolveTeamPresentationTheme } from '../../../src/teams/TeamThemeApplier';

describe('sideline team layout', () => {
  it('resolves density counts outside the protected field bounds', () => {
    for (const density of ['low', 'medium', 'high'] as const) {
      const layout = createSidelineLayout({
        coachesEnabled: true,
        density,
        tunnelTableauEnabled: false,
      });

      expect(layout.sidelinePlacements).toHaveLength(SIDELINE_DENSITY_COUNTS[density] * 2);
      expect(layout.coachPlacements).toHaveLength(2);
      expect(layout.tunnelPlacements).toHaveLength(0);
      for (const placement of layout.sidelinePlacements) {
        const zone = layout.zones.find((candidate) => candidate.id === placement.zoneId);
        expect(zone).toBeDefined();
        expect(isSidelinePlacementInsideZone(placement, zone!)).toBe(true);
        expect(isOutsideProtectedFieldBounds(placement.position, FIELD_BOUNDS)).toBe(true);
      }
      for (const coach of layout.coachPlacements) {
        const zone = layout.zones.find((candidate) => candidate.id === coach.zoneId);
        expect(zone).toBeDefined();
        expect(isOutsideProtectedFieldBounds(coach.position, FIELD_BOUNDS)).toBe(true);
      }
    }
  });

  it('keeps opposite sideline placements mathematically symmetrical', () => {
    const layout = createSidelineLayout({
      coachesEnabled: true,
      density: 'medium',
      tunnelTableauEnabled: false,
    });
    const user = layout.sidelinePlacements.filter((placement) => placement.teamSide === 'user');
    const opponent = layout.sidelinePlacements.filter((placement) => placement.teamSide === 'opponent');

    expect(user).toHaveLength(opponent.length);
    for (let index = 0; index < user.length; index += 1) {
      expect(user[index].position.x).toBeCloseTo(-opponent[index].position.x, 6);
      expect(user[index].position.z).toBeCloseTo(opponent[index].position.z, 6);
      expect(user[index].facingRadians).toBeCloseTo(-opponent[index].facingRadians, 6);
    }

    const userCoach = layout.coachPlacements.find((coach) => coach.teamSide === 'user');
    const opponentCoach = layout.coachPlacements.find((coach) => coach.teamSide === 'opponent');
    expect(userCoach?.position.x).toBeCloseTo(-(opponentCoach?.position.x ?? 0), 6);
    expect(userCoach?.position.z).toBeCloseTo(opponentCoach?.position.z ?? 1, 6);
  });

  it('aligns tunnel zones to declared stadium tunnel anchors', () => {
    const zones = createSidelineZones();
    const userAnchor = resolveTunnelAnchor('user');
    const opponentAnchor = resolveTunnelAnchor('opponent');
    const userTunnel = zones.find((zone) => zone.id === 'user-tunnel');
    const opponentTunnel = zones.find((zone) => zone.id === 'opponent-tunnel');

    expect(userAnchor.tunnelId).toBe('left-tunnel-near');
    expect(opponentAnchor.tunnelId).toBe('right-tunnel-far');
    expect(userTunnel?.center.x).toBeCloseTo(userAnchor.position.x, 6);
    expect(userTunnel?.center.z).toBeCloseTo(userAnchor.position.z, 6);
    expect(opponentTunnel?.center.x).toBeCloseTo(opponentAnchor.position.x, 6);
    expect(opponentTunnel?.center.z).toBeCloseTo(opponentAnchor.position.z, 6);
  });

  it('creates one active tunnel tableau with eleven starter representations', () => {
    const layout = createSidelineLayout({
      coachesEnabled: false,
      density: 'low',
      rosterAppearanceIds: {
        user: Array.from({ length: 11 }, (_, index) => `starter-${index}`),
      },
      tunnelTableauEnabled: true,
    });

    expect(layout.tunnelPlacements).toHaveLength(11);
    expect(new Set(layout.tunnelPlacements.map((placement) => placement.teamSide))).toEqual(
      new Set(['user']),
    );
    expect(layout.tunnelPlacements[0].appearanceId).toBe('starter-0');
  });
});

describe('sideline team visuals', () => {
  it('renders sideline subjects with bounded instanced resources and varied skin colors', () => {
    const theme = resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS);
    const layout = createSidelineLayout({
      coachesEnabled: true,
      density: 'low',
      tunnelTableauEnabled: true,
    });
    const resources = createSidelineVisualResources(layout.allPlacements, theme, {
      coachPlacements: layout.coachPlacements,
    });

    expect(resources.metrics.meshCount).toBe(18);
    expect(resources.metrics.materialCount).toBe(2);
    expect(resources.metrics.geometryCount).toBe(16);
    expect(resources.metrics.textureCount).toBe(0);
    expect(resources.metrics.drawCalls).toBe(18);
    expect(resources.metrics.instanceBufferBytes).toBeGreaterThan(0);
    expect(resources.metrics.triangleCount).toBeGreaterThan(0);
    expect(countObjects(resources.group)).toBeLessThan(22);
    expect(countUniqueInstanceColors(resources.meshes.head)).toBeGreaterThan(1);
    expect(countUniqueInstanceColors(resources.coachMeshes.head)).toBeGreaterThan(0);

    resources.dispose();
    expect(resources.group.children).toHaveLength(0);
  });

  it('repeated enable and disable does not accumulate visual roots', () => {
    const controller = new SidelineTeamController({
      coachesEnabled: true,
      density: 'low',
      enabled: true,
      footballPlayerVisual: { helmet: 'disabled' },
      rosterBinding: createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS),
      sidelinePlayersEnabled: true,
      teamTheme: resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS),
      tunnelTableauEnabled: true,
    });

    for (let index = 0; index < 20; index += 1) {
      controller.applySettings({
        coachesEnabled: true,
        density: index % 2 === 0 ? 'low' : 'medium',
        enabled: true,
        footballPlayerVisual: { helmet: 'disabled' },
        rosterBinding: createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS),
        sidelinePlayersEnabled: true,
        teamTheme: resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS),
        tunnelTableauEnabled: true,
      });
      expect(controller.group.children).toHaveLength(1);
      expect(controller.getSnapshot().noGameplayAuthority).toBe(true);
    }

    controller.applySettings({
      coachesEnabled: false,
      density: 'low',
      enabled: false,
      footballPlayerVisual: { helmet: 'disabled' },
      rosterBinding: createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS),
      sidelinePlayersEnabled: false,
      teamTheme: resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS),
      tunnelTableauEnabled: false,
    });

    expect(controller.group.children).toHaveLength(0);
    expect(controller.getSnapshot().sidelinePlayerCount).toBe(0);
    controller.dispose();
  });

  it('keeps sideline and tunnel entities out of gameplay rosters', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    const snapshot = snapshotGameplayModel(gameplay);
    const layout = createSidelineLayout({
      coachesEnabled: true,
      density: 'high',
      tunnelTableauEnabled: true,
    });
    const sidelineIds = new Set(layout.allPlacements.map((placement) => placement.id));
    const coachIds = new Set(layout.coachPlacements.map((placement) => placement.id));

    expect(snapshot.players).toHaveLength(22);
    expect(snapshot.players.some((player) => sidelineIds.has(player.id))).toBe(false);
    expect(snapshot.players.some((player) => coachIds.has(player.id))).toBe(false);
  });

  it('updates coach and reserve reactions once from authoritative presentation events', () => {
    const controller = new SidelineTeamController({
      coachesEnabled: true,
      density: 'low',
      enabled: true,
      footballPlayerVisual: { helmet: 'disabled' },
      rosterBinding: createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS),
      sidelinePlayersEnabled: true,
      teamTheme: resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS),
      tunnelTableauEnabled: false,
    });

    const touchdownEvent = {
      id: 'touchdown:result-1',
      playState: 'dead',
      score: 6,
      type: 'touchdown',
    } as const;
    controller.update([touchdownEvent], 1 / 60);
    const touchdownSnapshot = controller.getSnapshot();
    expect(touchdownSnapshot.reactionState).toBe('touchdown');
    expect(touchdownSnapshot.lastReactionEventId).toBe(touchdownEvent.id);
    expect(touchdownSnapshot.coachStates.map((coach) => coach.state)).toEqual([
      'touchdownCelebration',
      'touchdownCelebration',
    ]);

    controller.update([touchdownEvent], 1 / 60);
    expect(controller.getSnapshot().lastReactionEventId).toBe(touchdownEvent.id);

    controller.update([
      {
        id: 'firstDown:result-2',
        playState: 'dead',
        score: 6,
        type: 'firstDown',
      },
    ], 1 / 60);
    expect(controller.getSnapshot().reactionState).toBe('firstDown');
    expect(controller.getSnapshot().coachStates[0].state).toBe('firstDownApproval');

    controller.dispose();
  });

  it('uses actual roster identities and full football-player visuals for sideline reserves', () => {
    const binding = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const controller = new SidelineTeamController({
      coachesEnabled: true,
      density: 'low',
      enabled: true,
      footballPlayerVisual: { helmet: 'disabled' },
      rosterBinding: binding,
      sidelinePlayersEnabled: true,
      teamTheme: resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS),
      tunnelTableauEnabled: true,
    });
    const snapshot = controller.getSnapshot();
    const userReserveIds = binding.userRoster.reserveIds.slice(0, SIDELINE_DENSITY_COUNTS.low);
    const opponentReserveIds = binding.opponentRoster.reserveIds.slice(0, SIDELINE_DENSITY_COUNTS.low);
    const allRosterIds = new Set([
      ...binding.userRoster.players.map((player) => player.id),
      ...binding.opponentRoster.players.map((player) => player.id),
    ]);

    expect(snapshot.sidelineRosterPlayerIds.slice(0, SIDELINE_DENSITY_COUNTS.low)).toEqual(userReserveIds);
    expect(snapshot.sidelineRosterPlayerIds.slice(SIDELINE_DENSITY_COUNTS.low)).toEqual(opponentReserveIds);
    expect(snapshot.fullFootballPlayerVisualCount).toBe(
      snapshot.sidelinePlayerCount + snapshot.tunnelPlayerCount,
    );

    const fullPlayerRoots: THREE.Object3D[] = [];
    controller.group.traverse((object) => {
      if (object.userData.fullFootballPlayerVisual === true) {
        fullPlayerRoots.push(object);
      }
    });
    expect(fullPlayerRoots).toHaveLength(snapshot.fullFootballPlayerVisualCount);
    for (const root of fullPlayerRoots) {
      expect(root.userData.visualProfileId).toBe(FOOTBALL_PLAYER_VISUAL_PROFILE_ID);
      expect(allRosterIds.has(String(root.userData.rosterPlayerId))).toBe(true);
      expect(root.userData.jerseyNumber).not.toBeNull();
    }

    controller.dispose();
  });
});

function countObjects(root: THREE.Object3D): number {
  let count = 0;
  root.traverse(() => {
    count += 1;
  });
  return count;
}

function countUniqueInstanceColors(mesh: THREE.InstancedMesh): number {
  const attribute = mesh.instanceColor;
  if (!attribute) {
    return 0;
  }
  const values = new Set<string>();
  for (let index = 0; index < attribute.count; index += 1) {
    values.add([
      attribute.getX(index).toFixed(4),
      attribute.getY(index).toFixed(4),
      attribute.getZ(index).toFixed(4),
    ].join(','));
  }
  return values.size;
}
