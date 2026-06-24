import type { SnapPlacement } from './ballSpotting';
import { FIELD_DIRECTION } from './fieldSpec';
import type { FootballSpot } from './fieldScale';
import {
  resolveFormation,
  resolveFormationTarget,
  type ResolvedFormationSlot,
} from './formationLayout';
import {
  type PlayDefinition,
} from './playbook';
import {
  resolveEligibleReceiverRoutes,
  type ResolvedReceiverRoute,
} from './receiverRoutes';

export interface SvgPoint {
  x: number;
  y: number;
}

export interface DiagramSize {
  height: number;
  width: number;
}

export interface FootballToSvgTransform {
  bounds: {
    maxForward: number;
    maxLateral: number;
    minForward: number;
    minLateral: number;
  };
  contentOffset: SvgPoint;
  padding: number;
  playDirectionZ: number;
  scale: number;
  size: DiagramSize;
  snapSpot: FootballSpot;
}

export interface PlayCallPlayerMarker {
  footballPosition: FootballSpot;
  id: string;
  point: SvgPoint;
  role: ResolvedFormationSlot['role'];
}

export interface PlayCallRoute {
  breakPoints: readonly SvgPoint[];
  footballBreakPoints: readonly FootballSpot[];
  footballPoints: FootballSpot[];
  points: SvgPoint[];
  receiverId: string;
}

export interface PlayCallBlockerAssignment {
  blockerId: string;
  defenderId: string | null;
  end: SvgPoint;
  footballEnd: FootballSpot;
  footballStart: FootballSpot;
  kind: 'passProtection' | 'runBlock';
  start: SvgPoint;
}

export interface PlayCallDiagramModel {
  alignmentIssues: PlayCallDiagramAlignmentIssue[];
  ball: SvgPoint;
  blockerAssignments: PlayCallBlockerAssignment[];
  fieldSide: 'left' | 'right';
  lineOfScrimmage: {
    end: SvgPoint;
    start: SvgPoint;
  };
  playId: string;
  playKind: PlayDefinition['kind'];
  playName: string;
  players: PlayCallPlayerMarker[];
  receiverRoutes: PlayCallRoute[];
  runDirection: PlayCallRoute | null;
  transform: FootballToSvgTransform;
}

export type PlayCallDiagramAlignmentIssueKind =
  | 'routeStartMissingPlayer'
  | 'routeStartMismatch'
  | 'blockerStartMissingPlayer'
  | 'blockerStartMismatch';

export interface PlayCallDiagramAlignmentIssue {
  artKind: 'blockerAssignment' | 'receiverRoute' | 'runDirection';
  footballDistanceYards?: number;
  footballPlayerPosition?: FootballSpot;
  footballStart?: FootballSpot;
  kind: PlayCallDiagramAlignmentIssueKind;
  playerId: string;
  playId: string;
  svgDistance?: number;
  svgPlayerPoint?: SvgPoint;
  svgStart?: SvgPoint;
}

export const PLAY_CALL_DIAGRAM_SIZE: DiagramSize = {
  height: 112,
  width: 184,
} as const;

const DIAGRAM_PADDING = 10;
export const PLAY_CALL_MARKER_PADDING = 8;
export const PLAY_CALL_ALIGNMENT_TOLERANCE_YARDS = 0.01;
export const PLAY_CALL_ALIGNMENT_TOLERANCE_SVG = 0.01;
const DIAGRAM_EDGE_MARGIN_YARDS = 0;
const SNAP_RELATIVE_DIAGRAM_BOUNDS = {
  maxForward: 26,
  maxLateral: 38,
  minForward: -18,
  minLateral: -38,
} as const;
const RUN_ARROW_YARDS = 14;

export function createPlayCallDiagramModel(
  play: PlayDefinition,
  snapPlacement: SnapPlacement,
  size: DiagramSize = PLAY_CALL_DIAGRAM_SIZE,
): PlayCallDiagramModel {
  const formation = resolveFormation(play, snapPlacement);
  const ballCarrier = getBallCarrierSlot(play, formation.slots);
  const blockerTargets = resolveBlockerTargets(play, snapPlacement);
  const blockerAssignments = createPlayCallBlockerAssignments(
    play,
    formation.slots,
    blockerTargets,
  );
  const receiverRoutes = resolveEligibleReceiverRoutes(play, snapPlacement);
  const runTarget = play.kind === 'run'
    ? resolveRunTarget(play, ballCarrier.position, blockerTargets)
    : null;
  const footballPoints = [
    snapPlacement.spot,
    ...formation.slots.map((slot) => slot.position),
    ...Object.values(blockerTargets),
    ...blockerAssignments.map((assignment) => assignment.footballEnd),
    ...receiverRoutes.flatMap((route) => route.points),
  ];

  if (runTarget) {
    footballPoints.push(runTarget);
  }

  const transform = createFootballToSvgTransform(footballPoints, snapPlacement, size);
  const lineStart = {
    x: snapPlacement.spot.x + transform.bounds.minLateral,
    z: snapPlacement.spot.z,
  };
  const lineEnd = {
    x: snapPlacement.spot.x + transform.bounds.maxLateral,
    z: snapPlacement.spot.z,
  };

  const modelWithoutAlignmentIssues = {
    ball: normalizeFootballSpotToSvg(snapPlacement.spot, transform),
    blockerAssignments: blockerAssignments.map((assignment) => ({
      blockerId: assignment.blockerId,
      defenderId: assignment.defenderId,
      end: normalizeFootballSpotToSvg(assignment.footballEnd, transform),
      footballEnd: { ...assignment.footballEnd },
      footballStart: { ...assignment.footballStart },
      kind: assignment.kind,
      start: normalizeFootballSpotToSvg(assignment.footballStart, transform),
    })),
    fieldSide: formation.fieldSide,
    lineOfScrimmage: {
      end: normalizeFootballSpotToSvg(lineEnd, transform),
      start: normalizeFootballSpotToSvg(lineStart, transform),
    },
    playId: play.id,
    playKind: play.kind,
    playName: play.displayName,
    players: formation.slots
      .filter((slot) => slot.team === 'offense')
      .map((slot) => ({
        footballPosition: { ...slot.position },
        id: slot.id,
        point: normalizeFootballSpotToSvg(slot.position, transform),
        role: slot.role,
      })),
    receiverRoutes: receiverRoutes.map((route) => createPlayCallRoute(route, transform)),
    runDirection: runTarget
      ? {
          footballPoints: [
            { ...ballCarrier.position },
            { ...runTarget },
          ],
          footballBreakPoints: [],
          breakPoints: [],
          points: [
            normalizeFootballSpotToSvg(ballCarrier.position, transform),
            normalizeFootballSpotToSvg(runTarget, transform),
          ],
          receiverId: ballCarrier.id,
        }
      : null,
    transform,
  };

  return {
    ...modelWithoutAlignmentIssues,
    alignmentIssues: validatePlayCallDiagramAlignment(modelWithoutAlignmentIssues),
  };
}

export function validatePlayCallDiagramAlignment(
  model: Omit<PlayCallDiagramModel, 'alignmentIssues'>,
  toleranceYards = PLAY_CALL_ALIGNMENT_TOLERANCE_YARDS,
  toleranceSvg = PLAY_CALL_ALIGNMENT_TOLERANCE_SVG,
): PlayCallDiagramAlignmentIssue[] {
  const playersById = new Map(model.players.map((player) => [player.id, player]));
  const issues: PlayCallDiagramAlignmentIssue[] = [];

  for (const route of model.receiverRoutes) {
    validateArtStart({
      artKind: 'receiverRoute',
      footballStart: route.footballPoints[0],
      issueKind: 'routeStart',
      issues,
      model,
      playerId: route.receiverId,
      playersById,
      svgStart: route.points[0],
      toleranceSvg,
      toleranceYards,
    });
  }

  if (model.runDirection) {
    validateArtStart({
      artKind: 'runDirection',
      footballStart: model.runDirection.footballPoints[0],
      issueKind: 'routeStart',
      issues,
      model,
      playerId: model.runDirection.receiverId,
      playersById,
      svgStart: model.runDirection.points[0],
      toleranceSvg,
      toleranceYards,
    });
  }

  for (const assignment of model.blockerAssignments) {
    validateArtStart({
      artKind: 'blockerAssignment',
      footballStart: assignment.footballStart,
      issueKind: 'blockerStart',
      issues,
      model,
      playerId: assignment.blockerId,
      playersById,
      svgStart: assignment.start,
      toleranceSvg,
      toleranceYards,
    });
  }

  return issues;
}

export function createFootballToSvgTransform(
  footballPoints: FootballSpot[],
  snapPlacement: SnapPlacement,
  size: DiagramSize = PLAY_CALL_DIAGRAM_SIZE,
): FootballToSvgTransform {
  const localPoints = footballPoints.map((point) => toLocalFootballPoint(point, snapPlacement));
  const minLateral = Math.min(
    SNAP_RELATIVE_DIAGRAM_BOUNDS.minLateral,
    ...localPoints.map((point) => point.lateral),
  );
  const maxLateral = Math.max(
    SNAP_RELATIVE_DIAGRAM_BOUNDS.maxLateral,
    ...localPoints.map((point) => point.lateral),
  );
  const minForward = Math.min(
    SNAP_RELATIVE_DIAGRAM_BOUNDS.minForward,
    ...localPoints.map((point) => point.forward),
  );
  const maxForward = Math.max(
    SNAP_RELATIVE_DIAGRAM_BOUNDS.maxForward,
    ...localPoints.map((point) => point.forward),
  );
  const bounds = {
    maxForward: maxForward + DIAGRAM_EDGE_MARGIN_YARDS,
    maxLateral: maxLateral + DIAGRAM_EDGE_MARGIN_YARDS,
    minForward: minForward - DIAGRAM_EDGE_MARGIN_YARDS,
    minLateral: minLateral - DIAGRAM_EDGE_MARGIN_YARDS,
  };
  const contentWidth = size.width - DIAGRAM_PADDING * 2;
  const contentHeight = size.height - DIAGRAM_PADDING * 2;
  const lateralRange = Math.max(1, bounds.maxLateral - bounds.minLateral);
  const forwardRange = Math.max(1, bounds.maxForward - bounds.minForward);
  const scale = Math.min(contentWidth / lateralRange, contentHeight / forwardRange);
  const usedWidth = lateralRange * scale;
  const usedHeight = forwardRange * scale;

  return {
    bounds,
    contentOffset: {
      x: DIAGRAM_PADDING + (contentWidth - usedWidth) / 2,
      y: DIAGRAM_PADDING + (contentHeight - usedHeight) / 2,
    },
    padding: DIAGRAM_PADDING,
    playDirectionZ: FIELD_DIRECTION.playDirectionZ,
    scale,
    size,
    snapSpot: { ...snapPlacement.spot },
  };
}

export function normalizeFootballSpotToSvg(
  spot: FootballSpot,
  transform: FootballToSvgTransform,
): SvgPoint {
  const localPoint = toLocalFootballPoint(
    spot,
    {
      lane: 'middle',
      spot: transform.snapSpot,
    },
    transform.playDirectionZ,
  );

  return {
    x:
      transform.contentOffset.x +
      (transform.bounds.maxLateral - localPoint.lateral) * transform.scale,
    y:
      transform.contentOffset.y +
      (transform.bounds.maxForward - localPoint.forward) * transform.scale,
  };
}

function validateArtStart({
  artKind,
  footballStart,
  issueKind,
  issues,
  model,
  playerId,
  playersById,
  svgStart,
  toleranceSvg,
  toleranceYards,
}: {
  artKind: PlayCallDiagramAlignmentIssue['artKind'];
  footballStart: FootballSpot | undefined;
  issueKind: 'blockerStart' | 'routeStart';
  issues: PlayCallDiagramAlignmentIssue[];
  model: Omit<PlayCallDiagramModel, 'alignmentIssues'>;
  playerId: string;
  playersById: Map<string, PlayCallPlayerMarker>;
  svgStart: SvgPoint | undefined;
  toleranceSvg: number;
  toleranceYards: number;
}): void {
  const player = playersById.get(playerId);

  if (!player || !footballStart || !svgStart) {
    issues.push({
      artKind,
      footballStart: footballStart ? { ...footballStart } : undefined,
      kind: issueKind === 'blockerStart'
        ? 'blockerStartMissingPlayer'
        : 'routeStartMissingPlayer',
      playerId,
      playId: model.playId,
      svgStart: svgStart ? { ...svgStart } : undefined,
    });
    return;
  }

  const footballDistanceYards = distanceBetweenFootballSpots(
    footballStart,
    player.footballPosition,
  );
  const svgDistance = distanceBetweenSvgPoints(svgStart, player.point);

  if (footballDistanceYards > toleranceYards || svgDistance > toleranceSvg) {
    issues.push({
      artKind,
      footballDistanceYards,
      footballPlayerPosition: { ...player.footballPosition },
      footballStart: { ...footballStart },
      kind: issueKind === 'blockerStart'
        ? 'blockerStartMismatch'
        : 'routeStartMismatch',
      playerId,
      playId: model.playId,
      svgDistance,
      svgPlayerPoint: { ...player.point },
      svgStart: { ...svgStart },
    });
  }
}

function resolveBlockerTargets(
  play: PlayDefinition,
  snapPlacement: SnapPlacement,
): Record<string, FootballSpot> {
  return Object.fromEntries(
    Object.entries(play.blockerLaneTargets).map(([blockerId, target]) => [
      blockerId,
      resolveFormationTarget(play, target, snapPlacement),
    ]),
  );
}

interface ResolvedPlayCallBlockerAssignment {
  blockerId: string;
  defenderId: string | null;
  footballEnd: FootballSpot;
  footballStart: FootballSpot;
  kind: PlayCallBlockerAssignment['kind'];
}

function createPlayCallBlockerAssignments(
  play: PlayDefinition,
  slots: ResolvedFormationSlot[],
  laneTargets: Record<string, FootballSpot>,
): ResolvedPlayCallBlockerAssignment[] {
  const assignmentEntries = new Set([
    ...Object.keys(laneTargets),
    ...Object.keys(play.protectionAssignments ?? {}),
  ]);
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));

  return [...assignmentEntries].flatMap((blockerId) => {
    const blocker = slotsById.get(blockerId);

    if (!blocker) {
      return [];
    }

    const defenderId = play.protectionAssignments?.[blockerId] ?? null;
    const defender = defenderId ? slotsById.get(defenderId) : null;
    const laneTarget = laneTargets[blockerId];
    const footballEnd = defender?.position ?? laneTarget;

    if (!footballEnd) {
      return [];
    }

    return [{
      blockerId,
      defenderId,
      footballEnd: { ...footballEnd },
      footballStart: { ...blocker.position },
      kind: play.kind === 'pass' ? 'passProtection' : 'runBlock',
    }];
  });
}

function resolveRunTarget(
  play: PlayDefinition,
  carrierPosition: FootballSpot,
  blockerTargets: Record<string, FootballSpot>,
): FootballSpot {
  const targetEntries = Object.values(blockerTargets);

  if (targetEntries.length > 0) {
    return {
      x: targetEntries.reduce((sum, target) => sum + target.x, 0) / targetEntries.length,
      z: targetEntries.reduce((sum, target) => sum + target.z, 0) / targetEntries.length,
    };
  }

  return {
    x: carrierPosition.x + play.initialMovementDirection.x * RUN_ARROW_YARDS,
    z: carrierPosition.z + play.initialMovementDirection.z * RUN_ARROW_YARDS,
  };
}

function createPlayCallRoute(
  route: ResolvedReceiverRoute,
  transform: FootballToSvgTransform,
): PlayCallRoute {
  const points = route.points.map((point) => normalizeFootballSpotToSvg(point, transform));
  const breakPoints = points.slice(1, -1);
  const footballBreakPoints = route.points.slice(1, -1).map((point) => ({ ...point }));

  return {
    breakPoints,
    footballBreakPoints,
    footballPoints: route.points.map((point) => ({ ...point })),
    points,
    receiverId: route.receiverId,
  };
}

function getBallCarrierSlot(
  play: PlayDefinition,
  slots: ResolvedFormationSlot[],
): ResolvedFormationSlot {
  const slot = slots.find((candidate) => candidate.role === play.ballCarrierRole);

  if (!slot) {
    throw new Error(`Missing ${play.ballCarrierRole} in ${play.displayName} play diagram`);
  }

  return slot;
}

function toLocalFootballPoint(
  spot: FootballSpot,
  snapPlacement: SnapPlacement,
  playDirectionZ = 1,
): { forward: number; lateral: number } {
  return {
    forward: (spot.z - snapPlacement.spot.z) * playDirectionZ,
    lateral: spot.x - snapPlacement.spot.x,
  };
}

function distanceBetweenFootballSpots(a: FootballSpot, b: FootballSpot): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distanceBetweenSvgPoints(a: SvgPoint, b: SvgPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
