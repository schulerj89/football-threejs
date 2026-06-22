import { describe, expect, it } from 'vitest';
import { SNAP_LANE_X, createCenterSnapPlacement, type SnapPlacement } from '../src/ballSpotting';
import { INITIAL_BALL_SPOT } from '../src/field';
import {
  PLAY_CALL_DIAGRAM_SIZE,
  PLAY_CALL_MARKER_PADDING,
  createFootballToSvgTransform,
  createPlayCallDiagramModel,
  normalizeFootballSpotToSvg,
} from '../src/playCallDiagram';
import {
  ALL_PLAYS,
  getEligibleReceiverIds,
  getPlay,
  PLAYS,
} from '../src/playbook';
import {
  createPlayCardAccessibilityLabel,
  resolvePlayCallTrayLayout,
} from '../src/playCallUi';
import { resolveEligibleReceiverRoutes } from '../src/receiverRoutes';

describe('play call diagrams', () => {
  it('creates one diagram model for every available offensive play', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const diagrams = PLAYS.map((play) => createPlayCallDiagramModel(play, snapPlacement));

    expect(diagrams).toHaveLength(PLAYS.length);
    expect(diagrams.map((diagram) => diagram.playName)).toEqual(
      PLAYS.map((play) => play.displayName),
    );
  });

  it('renders run plays with a run-direction arrow and blocker assignments', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const insideRun = createPlayCallDiagramModel(getPlay('inside-run'), snapPlacement);
    const outsideRun = createPlayCallDiagramModel(getPlay('outside-run'), snapPlacement);

    expect(insideRun.runDirection).not.toBeNull();
    expect(outsideRun.runDirection).not.toBeNull();
    expect(insideRun.receiverRoutes).toHaveLength(0);
    expect(outsideRun.blockerAssignments.length).toBeGreaterThanOrEqual(2);
    expect(outsideRun.blockerAssignments.every((assignment) => assignment.kind === 'runBlock')).toBe(true);
    expect(getRouteEnd(outsideRun.runDirection)?.x).toBeLessThan(
      getRouteEnd(insideRun.runDirection)?.x ?? 0,
    );
  });

  it('renders passing plays with one route per eligible receiver', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);

    for (const playId of ['quick-pass', 'slant-flat']) {
      const play = getPlay(playId);
      const diagram = createPlayCallDiagramModel(play, snapPlacement);

      expect(diagram.runDirection).toBeNull();
      expect(diagram.receiverRoutes).toHaveLength(getEligibleReceiverIds(play).length);
      expect(diagram.receiverRoutes.map((route) => route.receiverId)).toEqual(
        getEligibleReceiverIds(play),
      );
      expect(diagram.receiverRoutes.every((route) => route.points.length >= 2)).toBe(true);
    }
  });

  it('renders Twin Slants Flat with three receiver routes and three protection assignments', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const play = getPlay('twin-slants-flat');
    const diagram = createPlayCallDiagramModel(play, snapPlacement);

    expect(diagram.playName).toBe('Twin Slants Flat');
    expect(diagram.runDirection).toBeNull();
    expect(diagram.receiverRoutes).toHaveLength(3);
    expect(diagram.receiverRoutes.map((route) => route.receiverId)).toEqual([
      'offense-wr-left',
      'offense-wr-right',
      'offense-rb',
    ]);
    expect(diagram.blockerAssignments.map((assignment) => assignment.blockerId).sort()).toEqual([
      'offense-center',
      'offense-line-left',
      'offense-line-right',
    ]);
  });

  it('mirrors pass-route directions to match the gameplay camera presentation', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const quickPass = createPlayCallDiagramModel(getPlay('quick-pass'), snapPlacement);
    const slantFlat = createPlayCallDiagramModel(getPlay('slant-flat'), snapPlacement);

    expect(getRouteEnd(quickPass.receiverRoutes[0])?.x).toBeGreaterThan(
      getRouteStart(quickPass.receiverRoutes[0])?.x ?? 0,
    );
    expect(getRouteEnd(slantFlat.receiverRoutes[0])?.x).toBeGreaterThan(
      getRouteStart(slantFlat.receiverRoutes[0])?.x ?? 0,
    );
    expect(getRouteEnd(slantFlat.receiverRoutes[1])?.x).toBeGreaterThan(
      getRouteStart(slantFlat.receiverRoutes[1])?.x ?? 0,
    );
  });

  it('normalizes every resolved route point into the play-card route geometry', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const play = getPlay('slant-flat');
    const diagram = createPlayCallDiagramModel(play, snapPlacement);
    const resolvedRoutes = resolveEligibleReceiverRoutes(play, snapPlacement);

    for (const resolvedRoute of resolvedRoutes) {
      const cardRoute = diagram.receiverRoutes.find((route) => route.receiverId === resolvedRoute.receiverId);

      expect(cardRoute).toBeDefined();
      expect(cardRoute?.footballPoints).toEqual(resolvedRoute.points);
      expect(cardRoute?.footballBreakPoints).toEqual(
        resolvedRoute.points.slice(1, -1),
      );
      expect(cardRoute?.points).toEqual(
        resolvedRoute.points.map((point) => normalizeFootballSpotToSvg(point, diagram.transform)),
      );
      expect(cardRoute?.breakPoints).toEqual(
        resolvedRoute.points
          .slice(1, -1)
          .map((point) => normalizeFootballSpotToSvg(point, diagram.transform)),
      );
    }
  });

  it('preserves route break order for multi-segment 11v11 pass routes', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const play = getPlay('spread-quick-11');
    const diagram = createPlayCallDiagramModel(play, snapPlacement);

    for (const route of diagram.receiverRoutes) {
      const resolvedRoute = resolveEligibleReceiverRoutes(play, snapPlacement)
        .find((candidate) => candidate.receiverId === route.receiverId);

      expect(route.breakPoints).toEqual(route.points.slice(1, -1));
      expect(route.breakPoints).toEqual(
        resolvedRoute?.points
          .slice(1, -1)
          .map((point) => normalizeFootballSpotToSvg(point, diagram.transform)),
      );
    }
  });

  it('keeps every play-card SVG point inside the viewBox marker padding', () => {
    for (const play of ALL_PLAYS) {
      for (const snapPlacement of createSnapPlacements()) {
        const diagram = createPlayCallDiagramModel(play, snapPlacement);
        const points = collectDiagramPoints(diagram);

        for (const point of points) {
          expect(point.x).toBeGreaterThanOrEqual(PLAY_CALL_MARKER_PADDING);
          expect(point.x).toBeLessThanOrEqual(PLAY_CALL_DIAGRAM_SIZE.width - PLAY_CALL_MARKER_PADDING);
          expect(point.y).toBeGreaterThanOrEqual(PLAY_CALL_MARKER_PADDING);
          expect(point.y).toBeLessThanOrEqual(PLAY_CALL_DIAGRAM_SIZE.height - PLAY_CALL_MARKER_PADDING);
        }
      }
    }
  });

  it('uses a consistent snap-relative scale across current plays and snap lanes', () => {
    const scales = ALL_PLAYS.flatMap((play) =>
      createSnapPlacements().map((snapPlacement) =>
        createPlayCallDiagramModel(play, snapPlacement).transform.scale,
      ),
    );

    expect(new Set(scales.map((scale) => scale.toFixed(6))).size).toBe(1);
  });

  it('mirrors left- and right-hash diagrams from the same snap-relative route data', () => {
    const play = getPlay('slant-flat');
    const left = createPlayCallDiagramModel(play, createSnapPlacement('leftHash'));
    const right = createPlayCallDiagramModel(play, createSnapPlacement('rightHash'));

    expect(left.receiverRoutes.map((route) => route.receiverId)).toEqual(
      right.receiverRoutes.map((route) => route.receiverId),
    );

    for (const leftRoute of left.receiverRoutes) {
      const rightRoute = right.receiverRoutes.find((route) => route.receiverId === leftRoute.receiverId);
      expect(rightRoute).toBeDefined();
      expect(rightRoute?.points).toHaveLength(leftRoute.points.length);

      leftRoute.points.forEach((leftPoint, index) => {
        const rightPoint = rightRoute!.points[index];
        expect(leftPoint.x + rightPoint.x).toBeCloseTo(PLAY_CALL_DIAGRAM_SIZE.width, 4);
        expect(leftPoint.y).toBeCloseTo(rightPoint.y, 4);
      });
    }
  });

  it('distinguishes run blocking from pass protection and keeps assignment references', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const runPlay = getPlay('inside-zone-11');
    const passPlay = getPlay('spread-quick-11');
    const runDiagram = createPlayCallDiagramModel(runPlay, snapPlacement);
    const passDiagram = createPlayCallDiagramModel(passPlay, snapPlacement);

    expect(runDiagram.blockerAssignments.every((assignment) => assignment.kind === 'runBlock')).toBe(true);
    expect(passDiagram.blockerAssignments.every((assignment) => assignment.kind === 'passProtection')).toBe(true);
    expect(indexAssignments(runDiagram.blockerAssignments)).toEqual(runPlay.protectionAssignments);
    expect(indexAssignments(passDiagram.blockerAssignments)).toEqual(passPlay.protectionAssignments);
  });

  it('draws the added 11v11 rushing plays from real blocking data with mirrored field-side arrows', () => {
    for (const playId of ['outside-zone-11', 'off-tackle-11'] as const) {
      const play = getPlay(playId);
      const leftHash = createPlayCallDiagramModel(play, createSnapPlacement('leftHash'));
      const rightHash = createPlayCallDiagramModel(play, createSnapPlacement('rightHash'));
      const middle = createPlayCallDiagramModel(play, createSnapPlacement('middle'));

      expect(leftHash.receiverRoutes).toHaveLength(0);
      expect(leftHash.runDirection).not.toBeNull();
      expect(rightHash.runDirection).not.toBeNull();
      expect(middle.runDirection).not.toBeNull();
      expect(leftHash.blockerAssignments.every((assignment) => assignment.kind === 'runBlock')).toBe(true);
      expect(indexAssignments(leftHash.blockerAssignments)).toEqual(play.protectionAssignments);
      expect(indexAssignments(rightHash.blockerAssignments)).toEqual(play.protectionAssignments);
      expect(getFootballRouteEnd(leftHash.runDirection)!.x).toBeGreaterThan(
        getFootballRouteStart(leftHash.runDirection)!.x,
      );
      expect(getFootballRouteEnd(middle.runDirection)!.x).toBeGreaterThan(
        getFootballRouteStart(middle.runDirection)!.x,
      );
      expect(getFootballRouteEnd(rightHash.runDirection)!.x).toBeLessThan(
        getFootballRouteStart(rightHash.runDirection)!.x,
      );
    }
  });

  it('uses desktop 3 by 2 layout metadata for six cards and horizontal scroll on small screens', () => {
    expect(resolvePlayCallTrayLayout(1280, 6)).toEqual({
      cardCount: 6,
      columns: 3,
      mode: 'desktopGrid',
      rows: 2,
    });
    expect(resolvePlayCallTrayLayout(390, 6)).toEqual({
      cardCount: 6,
      columns: 6,
      mode: 'horizontalScroll',
      rows: 1,
    });
  });

  it('creates accessible play-card labels with shortcut and run/pass context', () => {
    expect(createPlayCardAccessibilityLabel(getPlay('spread-quick-11'), 2))
      .toBe('Spread Quick 11, pass play, shortcut 2');
    expect(createPlayCardAccessibilityLabel(getPlay('inside-zone-11'), 1))
      .toBe('Inside Zone 11, run play, shortcut 1');
  });

  it('normalizes football coordinates into SVG coordinates with the defense above the line', () => {
    const snapPlacement = createCenterSnapPlacement(INITIAL_BALL_SPOT);
    const transform = createFootballToSvgTransform(
      [
        INITIAL_BALL_SPOT,
        { x: 0, z: INITIAL_BALL_SPOT.z - 8 },
        { x: 0, z: INITIAL_BALL_SPOT.z + 10 },
      ],
      snapPlacement,
      { height: 100, width: 160 },
    );
    const linePoint = normalizeFootballSpotToSvg(INITIAL_BALL_SPOT, transform);
    const backfieldPoint = normalizeFootballSpotToSvg(
      { x: 0, z: INITIAL_BALL_SPOT.z - 8 },
      transform,
    );
    const downfieldPoint = normalizeFootballSpotToSvg(
      { x: 0, z: INITIAL_BALL_SPOT.z + 10 },
      transform,
    );

    expect(linePoint.x).toBeGreaterThan(0);
    expect(linePoint.y).toBeGreaterThan(0);
    expect(downfieldPoint.y).toBeLessThan(linePoint.y);
    expect(backfieldPoint.y).toBeGreaterThan(linePoint.y);
  });
});

type Diagram = ReturnType<typeof createPlayCallDiagramModel>;

function createSnapPlacements(): SnapPlacement[] {
  return [
    createSnapPlacement('leftHash'),
    createSnapPlacement('middle'),
    createSnapPlacement('rightHash'),
  ];
}

function createSnapPlacement(lane: SnapPlacement['lane']): SnapPlacement {
  return {
    lane,
    spot: {
      x: SNAP_LANE_X[lane],
      z: INITIAL_BALL_SPOT.z,
    },
  };
}

function collectDiagramPoints(diagram: Diagram): Array<{ x: number; y: number }> {
  return [
    diagram.ball,
    diagram.lineOfScrimmage.start,
    diagram.lineOfScrimmage.end,
    ...diagram.players.map((player) => player.point),
    ...diagram.blockerAssignments.flatMap((assignment) => [assignment.start, assignment.end]),
    ...(diagram.runDirection?.points ?? []),
    ...diagram.receiverRoutes.flatMap((route) => [
      ...route.points,
      ...route.breakPoints,
    ]),
  ];
}

function getRouteStart(route: { points: ReadonlyArray<{ x: number; y: number }> } | null): { x: number; y: number } | null {
  return route?.points[0] ?? null;
}

function getRouteEnd(route: { points: ReadonlyArray<{ x: number; y: number }> } | null): { x: number; y: number } | null {
  return route?.points[route.points.length - 1] ?? null;
}

function getFootballRouteStart(route: { footballPoints: ReadonlyArray<{ x: number; z: number }> } | null): { x: number; z: number } | null {
  return route?.footballPoints[0] ?? null;
}

function getFootballRouteEnd(route: { footballPoints: ReadonlyArray<{ x: number; z: number }> } | null): { x: number; z: number } | null {
  return route?.footballPoints[route.footballPoints.length - 1] ?? null;
}

function indexAssignments(
  assignments: ReadonlyArray<{ blockerId: string; defenderId: string | null }>,
): Record<string, string> {
  return Object.fromEntries(
    assignments
      .filter((assignment): assignment is { blockerId: string; defenderId: string } =>
        !!assignment.defenderId)
      .map((assignment) => [assignment.blockerId, assignment.defenderId]),
  );
}
