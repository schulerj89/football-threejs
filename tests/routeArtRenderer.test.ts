import { describe, expect, it } from 'vitest';
import { createSnapPlacementForLane } from '../src/formationPreview';
import { INITIAL_BALL_SPOT } from '../src/field';
import {
  markPlayDead,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
  type GameplaySnapshot,
  createGameplayModel,
} from '../src/playState';
import { getEligibleReceiverIds, getPlay, type PlayDefinition } from '../src/playbook';
import { RouteArtRenderer } from '../src/presentation/RouteArtRenderer';
import { resolveEligibleReceiverRoutes } from '../src/receiverRoutes';

describe('route art renderer', () => {
  it('renders one path per eligible receiver route using exact resolved route points', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    selectPlay(gameplay, 'slant-flat');
    const renderer = new RouteArtRenderer();
    const snapshot = snapshotGameplayModel(gameplay);

    renderer.update(snapshot, gameplay.selectedPlay);
    const routeArt = renderer.getSnapshot();
    const resolvedRoutes = resolveEligibleReceiverRoutes(
      gameplay.selectedPlay,
      {
        lane: snapshot.drive.snapLane,
        spot: snapshot.drive.lineOfScrimmage,
      },
    );

    expect(routeArt.visible).toBe(true);
    expect(routeArt.routeCount).toBe(getEligibleReceiverIds(gameplay.selectedPlay).length);
    expect(routeArt.routes.map((route) => route.receiverId)).toEqual(
      getEligibleReceiverIds(gameplay.selectedPlay),
    );

    for (const route of resolvedRoutes) {
      const renderedRoute = routeArt.routes.find((candidate) => candidate.receiverId === route.receiverId);
      const path = renderer.group.getObjectByName(`route-art-path-${route.receiverId}`);

      expect(renderedRoute?.points).toEqual(route.points);
      expectFootballPointsClose(getLineFootballPoints(path), route.points);
    }

    renderer.dispose();
  });

  it('anchors pre-snap field route art to the current player position', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    selectPlay(gameplay, 'slant-flat');
    const receiver = gameplay.players.find((player) => player.id === 'offense-wr');
    const renderer = new RouteArtRenderer();

    if (!receiver) {
      throw new Error('Expected offense-wr in slant-flat formation');
    }

    receiver.position = {
      x: receiver.position.x + 3,
      z: receiver.position.z - 1.25,
    };
    renderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    const routeArt = renderer.getSnapshot();
    const renderedRoute = routeArt.routes.find((route) => route.receiverId === 'offense-wr');
    const path = renderer.group.getObjectByName('route-art-path-offense-wr');

    expect(renderedRoute?.anchor).toEqual({
      formationPosition: expect.any(Object),
      playerId: 'offense-wr',
      position: receiver.position,
      source: 'player',
    });
    expect(renderedRoute?.points[0]).toEqual(receiver.position);
    expectFootballPointsClose(getLineFootballPoints(path).slice(0, 1), [receiver.position]);

    renderer.dispose();
  });


  it('marks the selected receiver route with selected visual state', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    selectPlay(gameplay, 'slant-flat');
    gameplay.selectedReceiverId = 'offense-rb';
    const renderer = new RouteArtRenderer();

    renderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    const routeArt = renderer.getSnapshot();

    expect(routeArt.routes.find((route) => route.receiverId === 'offense-rb')?.selected).toBe(true);
    expect(routeArt.routes.find((route) => route.receiverId === 'offense-wr')?.selected).toBe(false);

    renderer.dispose();
  });

  it('is visible during preSnap and hidden during live and dead play outside audit mode', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    selectPlay(gameplay, 'quick-pass');
    const renderer = new RouteArtRenderer();

    renderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    expect(renderer.getSnapshot().visible).toBe(true);

    startPlay(gameplay);
    renderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    expect(renderer.getSnapshot().visible).toBe(false);

    markPlayDead(gameplay);
    renderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    expect(renderer.getSnapshot().visible).toBe(false);

    renderer.dispose();
  });

  it('does not mutate gameplay snapshots when route art is toggled off', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    selectPlay(gameplay, 'quick-pass');
    const snapshot = snapshotGameplayModel(gameplay);
    const before = JSON.stringify(snapshot);
    const renderer = new RouteArtRenderer({ enabled: false });

    renderer.update(snapshot, gameplay.selectedPlay);

    expect(JSON.stringify(snapshot)).toBe(before);
    expect(renderer.getSnapshot()).toMatchObject({
      enabled: false,
      visible: false,
    });

    renderer.dispose();
  });

  it('mirrors route art across left and right hash lanes', () => {
    const play = getPlay('slant-flat');
    const leftSnapshot = createSnapshotForLane(play, 'leftHash');
    const rightSnapshot = createSnapshotForLane(play, 'rightHash');
    const renderer = new RouteArtRenderer();

    renderer.update(leftSnapshot, play);
    const leftFlat = getRoute(renderer.getSnapshot(), 'offense-rb');
    renderer.update(rightSnapshot, play);
    const rightFlat = getRoute(renderer.getSnapshot(), 'offense-rb');

    expect(leftFlat.points.length).toBe(rightFlat.points.length);
    for (let index = 0; index < leftFlat.points.length; index += 1) {
      expect(leftFlat.points[index].x).toBeCloseTo(-rightFlat.points[index].x);
      expect(leftFlat.points[index].z).toBeCloseTo(rightFlat.points[index].z);
    }

    renderer.dispose();
  });

  it('reports route audit cross-track measurements from live receiver positions', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    selectPlay(gameplay, 'quick-pass');
    const renderer = new RouteArtRenderer({ auditEnabled: true });

    startPlay(gameplay);
    renderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    const audit = getRoute(renderer.getSnapshot(), 'offense-wr').audit;

    expect(audit).not.toBeNull();
    expect(audit?.receiverId).toBe('offense-wr');
    expect(audit?.totalLength).toBeGreaterThan(0);
    expect(audit?.crossTrackErrorYards).toEqual(expect.any(Number));

    renderer.dispose();
  });

  it('keeps offensive route art separate from defensive coverage art before the snap', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });
    selectPlay(gameplay, 'twin-slants-flat');
    const normalRenderer = new RouteArtRenderer();
    const defenseRenderer = new RouteArtRenderer({
      coverageShellEnabled: true,
      playArtMode: 'defense',
    });

    normalRenderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    expect(normalRenderer.getSnapshot().routeCount).toBe(getEligibleReceiverIds(gameplay.selectedPlay).length);
    expect(normalRenderer.getSnapshot().coverageZones).toEqual([]);

    defenseRenderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    const defenseSnapshot = defenseRenderer.getSnapshot();
    const preSnapCoverage = defenseSnapshot.coverageZones;

    expect(defenseSnapshot.routeCount).toBe(0);
    expect(defenseSnapshot.routes).toEqual([]);
    expect(preSnapCoverage).toHaveLength(4);
    expect(preSnapCoverage.every((zone) => zone.visible)).toBe(true);
    expect(
      defenseRenderer.group.getObjectByName('route-art-coverage-zone-defense-corner-left'),
    ).toBeDefined();
    expect(
      getGeometryPositionCount(
        defenseRenderer.group.getObjectByName('route-art-coverage-zone-defense-corner-left'),
      ),
    ).toBeGreaterThan(24);
    expect(
      getGeometryPositionCount(
        defenseRenderer.group.getObjectByName('route-art-coverage-zone-outline-defense-corner-left'),
      ),
    ).toBeGreaterThan(12);
    for (const zone of preSnapCoverage) {
      const assignmentLine = defenseRenderer.group.getObjectByName(
        `route-art-coverage-assignment-${zone.defenderId}`,
      );

      expect(assignmentLine).toBeDefined();
      expect(getGeometryPositionCount(assignmentLine)).toBe(2);
      expectFootballPointsClose(getLineFootballPoints(assignmentLine), [
        zone.anchor.position,
        zone.landmark,
      ]);
    }

    startPlay(gameplay);
    defenseRenderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);

    expect(defenseRenderer.getSnapshot().coverageZones.every((zone) => !zone.visible)).toBe(true);

    normalRenderer.dispose();
    defenseRenderer.dispose();
  });

  it('anchors pre-snap coverage zones to the current defender position', () => {
    const gameplay = createGameplayModel({ playbookId: '7v7' });
    selectPlay(gameplay, 'twin-slants-flat');
    const baselineRenderer = new RouteArtRenderer({
      coverageShellEnabled: true,
      playArtMode: 'defense',
    });
    const movedRenderer = new RouteArtRenderer({
      coverageShellEnabled: true,
      playArtMode: 'defense',
    });
    const defender = gameplay.players.find((player) => player.id === 'defense-corner-left');

    if (!defender) {
      throw new Error('Expected defense-corner-left in twin-slants-flat formation');
    }

    baselineRenderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    const baselineZone = getCoverageZone(baselineRenderer.getSnapshot(), 'defense-corner-left');

    defender.position = {
      x: defender.position.x + 2.5,
      z: defender.position.z + 1.75,
    };
    movedRenderer.update(snapshotGameplayModel(gameplay), gameplay.selectedPlay);
    const movedZone = getCoverageZone(movedRenderer.getSnapshot(), 'defense-corner-left');

    expect(movedZone.anchor).toEqual({
      formationPosition: expect.any(Object),
      playerId: 'defense-corner-left',
      position: defender.position,
      source: 'player',
    });
    expect(movedZone.landmark.x - baselineZone.landmark.x).toBeCloseTo(2.5);
    expect(movedZone.landmark.z - baselineZone.landmark.z).toBeCloseTo(1.75);
    expect(movedZone.points[0].x - baselineZone.points[0].x).toBeCloseTo(2.5);
    expect(movedZone.points[0].z - baselineZone.points[0].z).toBeCloseTo(1.75);

    baselineRenderer.dispose();
    movedRenderer.dispose();
  });
});

function createSnapshotForLane(
  play: PlayDefinition,
  lane: 'leftHash' | 'middle' | 'rightHash',
): GameplaySnapshot {
  const gameplay = createGameplayModel({ playbookId: '5v5' });
  selectPlay(gameplay, play.id);
  const snapshot = snapshotGameplayModel(gameplay);
  const snapPlacement = createSnapPlacementForLane(lane, INITIAL_BALL_SPOT.z);

  return {
    ...snapshot,
    drive: {
      ...snapshot.drive,
      lineOfScrimmage: snapPlacement.spot,
      snapLane: lane,
    },
  };
}

function getRoute(
  snapshot: ReturnType<RouteArtRenderer['getSnapshot']>,
  receiverId: string,
) {
  const route = snapshot.routes.find((candidate) => candidate.receiverId === receiverId);

  if (!route) {
    throw new Error(`Missing route ${receiverId}`);
  }

  return route;
}

function getCoverageZone(
  snapshot: ReturnType<RouteArtRenderer['getSnapshot']>,
  defenderId: string,
) {
  const zone = snapshot.coverageZones.find((candidate) => candidate.defenderId === defenderId);

  if (!zone) {
    throw new Error(`Missing coverage zone ${defenderId}`);
  }

  return zone;
}

function getLineFootballPoints(object: unknown) {
  if (!object || !('geometry' in (object as object))) {
    throw new Error('Missing route path object');
  }

  const geometry = (object as { geometry: { getAttribute: (name: string) => { count: number; getX: (index: number) => number; getZ: (index: number) => number } } }).geometry;
  const position = geometry.getAttribute('position');
  const points = [];

  for (let index = 0; index < position.count; index += 1) {
    points.push({
      x: position.getX(index),
      z: position.getZ(index),
    });
  }

  return points;
}

function getGeometryPositionCount(object: unknown): number {
  if (!object || !('geometry' in (object as object))) {
    throw new Error('Missing geometry object');
  }

  const geometry = (object as { geometry: { getAttribute: (name: string) => { count: number } } }).geometry;

  return geometry.getAttribute('position').count;
}

function expectFootballPointsClose(
  actual: readonly { x: number; z: number }[],
  expected: readonly { x: number; z: number }[],
): void {
  expect(actual).toHaveLength(expected.length);

  for (let index = 0; index < actual.length; index += 1) {
    expect(actual[index].x).toBeCloseTo(expected[index].x);
    expect(actual[index].z).toBeCloseTo(expected[index].z);
  }
}
