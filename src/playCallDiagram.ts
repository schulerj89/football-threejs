import type { SnapPlacement } from './ballSpotting';
import { FIELD_DIRECTION } from './fieldSpec';
import type { FootballSpot } from './fieldScale';
import {
  resolveFormation,
  resolveFormationTarget,
  type ResolvedFormationSlot,
} from './formationLayout';
import {
  getEligibleReceiverIds,
  type PlayDefinition,
} from './playbook';
import {
  getRouteFinalPoint,
  resolveReceiverRoute,
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
  id: string;
  point: SvgPoint;
  role: ResolvedFormationSlot['role'];
}

export interface PlayCallRoute {
  end: SvgPoint;
  receiverId: string;
  start: SvgPoint;
}

export interface PlayCallBlockerAssignment {
  blockerId: string;
  end: SvgPoint;
  start: SvgPoint;
}

export interface PlayCallDiagramModel {
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

export const PLAY_CALL_DIAGRAM_SIZE: DiagramSize = {
  height: 112,
  width: 184,
} as const;

const DIAGRAM_PADDING = 10;
const DIAGRAM_EDGE_MARGIN_YARDS = 4;
const MIN_BACKFIELD_YARDS = 12;
const MIN_FORWARD_YARDS = 20;
const RUN_ARROW_YARDS = 14;

export function createPlayCallDiagramModel(
  play: PlayDefinition,
  snapPlacement: SnapPlacement,
  size: DiagramSize = PLAY_CALL_DIAGRAM_SIZE,
): PlayCallDiagramModel {
  const formation = resolveFormation(play, snapPlacement);
  const ballCarrier = getBallCarrierSlot(play, formation.slots);
  const blockerTargets = resolveBlockerTargets(play, snapPlacement);
  const receiverRouteTargets = resolveReceiverRouteTargets(play, snapPlacement);
  const runTarget = play.kind === 'run'
    ? resolveRunTarget(play, ballCarrier.position, blockerTargets)
    : null;
  const footballPoints = [
    snapPlacement.spot,
    ...formation.slots.map((slot) => slot.position),
    ...Object.values(blockerTargets),
    ...Object.values(receiverRouteTargets),
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

  return {
    ball: normalizeFootballSpotToSvg(snapPlacement.spot, transform),
    blockerAssignments: Object.entries(blockerTargets)
      .map(([blockerId, target]) => {
        const blocker = formation.slots.find((slot) => slot.id === blockerId);

        if (!blocker) {
          return null;
        }

        return {
          blockerId,
          end: normalizeFootballSpotToSvg(target, transform),
          start: normalizeFootballSpotToSvg(blocker.position, transform),
        };
      })
      .filter((assignment): assignment is PlayCallBlockerAssignment => assignment !== null),
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
        id: slot.id,
        point: normalizeFootballSpotToSvg(slot.position, transform),
        role: slot.role,
      })),
    receiverRoutes: getEligibleReceiverIds(play)
      .map((receiverId) => {
        const receiver = formation.slots.find((slot) => slot.id === receiverId);
        const target = receiverRouteTargets[receiverId];

        if (!receiver || !target) {
          return null;
        }

        return {
          end: normalizeFootballSpotToSvg(target, transform),
          receiverId,
          start: normalizeFootballSpotToSvg(receiver.position, transform),
        };
      })
      .filter((route): route is PlayCallRoute => route !== null),
    runDirection: runTarget
      ? {
          end: normalizeFootballSpotToSvg(runTarget, transform),
          receiverId: ballCarrier.id,
          start: normalizeFootballSpotToSvg(ballCarrier.position, transform),
        }
      : null,
    transform,
  };
}

export function createFootballToSvgTransform(
  footballPoints: FootballSpot[],
  snapPlacement: SnapPlacement,
  size: DiagramSize = PLAY_CALL_DIAGRAM_SIZE,
): FootballToSvgTransform {
  const localPoints = footballPoints.map((point) => toLocalFootballPoint(point, snapPlacement));
  const minLateral = Math.min(...localPoints.map((point) => point.lateral), -DIAGRAM_EDGE_MARGIN_YARDS);
  const maxLateral = Math.max(...localPoints.map((point) => point.lateral), DIAGRAM_EDGE_MARGIN_YARDS);
  const minForward = Math.min(
    ...localPoints.map((point) => point.forward),
    -MIN_BACKFIELD_YARDS,
  );
  const maxForward = Math.max(...localPoints.map((point) => point.forward), MIN_FORWARD_YARDS);
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

function resolveReceiverRouteTargets(
  play: PlayDefinition,
  snapPlacement: SnapPlacement,
): Record<string, FootballSpot> {
  return Object.fromEntries(
    Object.keys(play.receiverRoutes ?? {}).flatMap((receiverId) => {
      const route = resolveReceiverRoute(play, receiverId, snapPlacement);

      return route ? [[receiverId, getRouteFinalPoint(route)]] : [];
    }),
  );
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
