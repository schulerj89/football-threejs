import type { SnapLane, SnapPlacement } from './ballSpotting';
import {
  FIELD_DIMENSIONS,
  FIELD_DIRECTION,
  PLAYABLE_FIELD_BOUNDS,
  type FieldBounds,
} from './fieldSpec';
import { cloneFootballSpot, type FootballSpot } from './fieldScale';
import type { PlayerRole, PlayerTeam } from './playerModel';
import {
  FIVE_ON_FIVE_DEFENSE_PLAYER_IDS,
  FIVE_ON_FIVE_OFFENSE_PLAYER_IDS,
  FIVE_ON_FIVE_PLAYER_IDS,
} from './roster';
import { validateResolvedFormationWithContext } from './formationValidation';

export type FormationSide = 'left' | 'right' | 'field' | 'boundary';
export type ConcreteFormationSide = 'left' | 'right';
export type PreferredFormationSide = ConcreteFormationSide;

export type PreSnapFacingDefinition =
  | { kind: 'playDirection' }
  | { kind: 'againstPlayDirection' };

export type LateralAnchor =
  | {
      kind: 'snap';
      offsetYards: number;
    }
  | {
      distanceYards: number;
      kind: 'snapSide';
      side: FormationSide;
    }
  | {
      kind: 'fieldCenter';
      offsetYards: number;
    }
  | {
      kind: 'sidelineInset';
      side: FormationSide;
      insetYards: number;
    }
  | {
      kind: 'alignedToPlayer';
      playerId: string;
      offsetYards: number;
    }
  | {
      kind: 'midpointOfPlayers';
      playerIds: string[];
      offsetYards: number;
    };

export type LongitudinalAnchor = {
  depthYards: number;
  kind: 'lineOfScrimmage';
  side: 'offense' | 'defense';
};

export interface FormationPoint {
  lateral: LateralAnchor;
  longitudinal: LongitudinalAnchor;
}

export interface FormationSlot extends FormationPoint {
  id: string;
  preSnapFacing: PreSnapFacingDefinition;
  role: PlayerRole;
  team: PlayerTeam;
}

export interface FormationPlayDefinition {
  formation: FormationSlot[];
  pass?: {
    coverageAssignments?: Record<string, string>;
    eligibleReceiverIds: string[];
  };
  preferredSide: PreferredFormationSide;
  validation?: FormationValidationConfig;
}

export interface FormationValidationConfig {
  coverageAlignmentToleranceYards?: number;
  defensiveGapOffsets?: Record<string, number>;
  expectedDefenseCount: number;
  expectedOffenseCount: number;
  offensiveLineIds?: readonly string[];
  receiverSidelineInsetYards?: Record<string, number>;
  stablePlayerIds: readonly string[];
}

export interface FormationFieldSpec {
  clampLongitudinalToBounds?: boolean;
  fieldWidth: number;
  playDirectionZ: number;
  playableBounds: FieldBounds;
}

export interface ResolvedFormationSlot extends FormationSlot {
  distanceFromLineOfScrimmage: number;
  lateralDistanceFromSnap: number;
  position: FootballSpot;
}

export interface ResolvedFormation {
  boundarySide: ConcreteFormationSide;
  coverageAssignments: Record<string, string>;
  fieldSide: ConcreteFormationSide;
  issues: FormationValidationIssue[];
  slots: ResolvedFormationSlot[];
  snapPlacement: SnapPlacement;
  validation: FormationValidationConfig;
}

export interface FormationValidationIssue {
  message: string;
  playerIds: string[];
}

export const OFFENSE_PLAYER_IDS = [
  ...FIVE_ON_FIVE_OFFENSE_PLAYER_IDS,
] as const;

export const DEFENSE_PLAYER_IDS = [
  ...FIVE_ON_FIVE_DEFENSE_PLAYER_IDS,
] as const;

export const STABLE_PLAYER_IDS = [
  ...FIVE_ON_FIVE_PLAYER_IDS,
] as const;

export type StablePlayerId = typeof STABLE_PLAYER_IDS[number];

export const FORMATION_MEASUREMENTS = {
  blockerSpacing: 3.5,
  coverageCushion: 8,
  defensiveLineDepth: 4.5,
  interiorLaneDepth: 9,
  interiorLaneSpacing: 2.5,
  minimumPlayerClearance: 1.55,
  offensiveLineSetback: 1.2,
  outsideLeadInset: 10,
  outsideTrailInset: 15,
  passProtectDepth: 2.5,
  playerRadius: 0.75,
  quarterbackDepth: 4,
  receiverSidelineInset: 5.5,
  runningBackDepth: 8,
  safetyDepth: 18,
} as const;

export const DEFAULT_FORMATION_VALIDATION: FormationValidationConfig = {
  coverageAlignmentToleranceYards: 0.001,
  expectedDefenseCount: 5,
  expectedOffenseCount: 5,
  offensiveLineIds: ['offense-blocker-left', 'offense-blocker-right'],
  receiverSidelineInsetYards: {
    'offense-wr': FORMATION_MEASUREMENTS.receiverSidelineInset,
  },
  stablePlayerIds: STABLE_PLAYER_IDS,
} as const;

export const DEFAULT_FORMATION_FIELD_SPEC: FormationFieldSpec = {
  fieldWidth: FIELD_DIMENSIONS.fieldWidth,
  playableBounds: PLAYABLE_FIELD_BOUNDS,
  playDirectionZ: FIELD_DIRECTION.playDirectionZ,
} as const;

const FORMATION_EPSILON = 0.0001;

export function resolveFormation(
  play: FormationPlayDefinition,
  snapPlacement: SnapPlacement,
  fieldSpec: FormationFieldSpec = DEFAULT_FORMATION_FIELD_SPEC,
): ResolvedFormation {
  const fieldSide = resolveFieldSide(snapPlacement.lane, play.preferredSide);
  const boundarySide = oppositeSide(fieldSide);
  const resolvedSlots = new Map<string, ResolvedFormationSlot>();
  const slots: ResolvedFormationSlot[] = [];

  for (const slot of play.formation) {
    const position = resolveFormationPoint(
      slot,
      snapPlacement,
      fieldSpec,
      fieldSide,
      boundarySide,
      resolvedSlots,
    );
    const resolvedSlot: ResolvedFormationSlot = {
      ...slot,
      distanceFromLineOfScrimmage:
        (position.z - snapPlacement.spot.z) * fieldSpec.playDirectionZ,
      lateralDistanceFromSnap: position.x - snapPlacement.spot.x,
      position,
    };

    slots.push(resolvedSlot);
    resolvedSlots.set(slot.id, resolvedSlot);
  }

  const resolvedFormation: ResolvedFormation = {
    boundarySide,
    coverageAssignments: { ...(play.pass?.coverageAssignments ?? {}) },
    fieldSide,
    issues: [],
    slots,
    snapPlacement: {
      lane: snapPlacement.lane,
      spot: cloneFootballSpot(snapPlacement.spot),
    },
    validation: play.validation ?? DEFAULT_FORMATION_VALIDATION,
  };
  resolvedFormation.issues = validateResolvedFormation(resolvedFormation, fieldSpec);

  return resolvedFormation;
}

export function resolveFormationTarget(
  play: FormationPlayDefinition,
  target: FormationPoint,
  snapPlacement: SnapPlacement,
  fieldSpec: FormationFieldSpec = DEFAULT_FORMATION_FIELD_SPEC,
): FootballSpot {
  const formation = resolveFormation(play, snapPlacement, fieldSpec);
  const resolvedSlots = new Map(formation.slots.map((slot) => [slot.id, slot]));

  return resolveFormationPoint(
    target,
    snapPlacement,
    fieldSpec,
    formation.fieldSide,
    formation.boundarySide,
    resolvedSlots,
  );
}

export function validateResolvedFormation(
  formation: ResolvedFormation,
  fieldSpec: FormationFieldSpec = DEFAULT_FORMATION_FIELD_SPEC,
): FormationValidationIssue[] {
  return validateResolvedFormationWithContext(formation, fieldSpec, {
    defaultOffensiveLineIds: DEFAULT_FORMATION_VALIDATION.offensiveLineIds,
    epsilon: FORMATION_EPSILON,
    measurements: {
      minimumPlayerClearance: FORMATION_MEASUREMENTS.minimumPlayerClearance,
      playerRadius: FORMATION_MEASUREMENTS.playerRadius,
    },
  });
}

export function assertValidResolvedFormation(formation: ResolvedFormation): void {
  if (formation.issues.length === 0) {
    return;
  }

  throw new Error(
    `Invalid formation: ${formation.issues.map((issue) => issue.message).join('; ')}`,
  );
}

export function resolveFieldSide(
  snapLane: SnapLane,
  preferredSide: PreferredFormationSide,
): ConcreteFormationSide {
  if (snapLane === 'leftHash') {
    return 'right';
  }

  if (snapLane === 'rightHash') {
    return 'left';
  }

  return preferredSide;
}

export function oppositeSide(side: ConcreteFormationSide): ConcreteFormationSide {
  return side === 'left' ? 'right' : 'left';
}

function resolveFormationPoint(
  point: FormationPoint,
  snapPlacement: SnapPlacement,
  fieldSpec: FormationFieldSpec,
  fieldSide: ConcreteFormationSide,
  boundarySide: ConcreteFormationSide,
  resolvedSlots: Map<string, ResolvedFormationSlot>,
): FootballSpot {
  return {
    x: resolveLateralAnchor(
      point.lateral,
      snapPlacement,
      fieldSpec,
      fieldSide,
      boundarySide,
      resolvedSlots,
    ),
    z: resolveLongitudinalAnchor(point.longitudinal, snapPlacement, fieldSpec),
  };
}

function resolveLateralAnchor(
  anchor: LateralAnchor,
  snapPlacement: SnapPlacement,
  fieldSpec: FormationFieldSpec,
  fieldSide: ConcreteFormationSide,
  boundarySide: ConcreteFormationSide,
  resolvedSlots: Map<string, ResolvedFormationSlot>,
): number {
  if (anchor.kind === 'snap') {
    return snapPlacement.spot.x + anchor.offsetYards;
  }

  if (anchor.kind === 'snapSide') {
    const side = resolveConcreteSide(anchor.side, fieldSide, boundarySide);
    const direction = side === 'left' ? -1 : 1;

    return snapPlacement.spot.x + direction * anchor.distanceYards;
  }

  if (anchor.kind === 'fieldCenter') {
    return anchor.offsetYards;
  }

  if (anchor.kind === 'sidelineInset') {
    const side = resolveConcreteSide(anchor.side, fieldSide, boundarySide);
    const halfWidth = fieldSpec.fieldWidth / 2;

    return side === 'left'
      ? -halfWidth + anchor.insetYards
      : halfWidth - anchor.insetYards;
  }

  if (anchor.kind === 'alignedToPlayer') {
    const player = resolvedSlots.get(anchor.playerId);

    if (!player) {
      throw new Error(`Cannot align to unresolved player ${anchor.playerId}`);
    }

    return player.position.x + anchor.offsetYards;
  }

  const midpointPlayers = anchor.playerIds.map((playerId) => {
    const player = resolvedSlots.get(playerId);

    if (!player) {
      throw new Error(`Cannot calculate midpoint with unresolved player ${playerId}`);
    }

    return player;
  });
  const midpoint =
    midpointPlayers.reduce((sum, player) => sum + player.position.x, 0) /
    midpointPlayers.length;

  return midpoint + anchor.offsetYards;
}

function resolveLongitudinalAnchor(
  anchor: LongitudinalAnchor,
  snapPlacement: SnapPlacement,
  fieldSpec: FormationFieldSpec,
): number {
  const direction = anchor.side === 'defense' ? 1 : -1;
  const z = snapPlacement.spot.z + direction * anchor.depthYards * fieldSpec.playDirectionZ;

  if (!fieldSpec.clampLongitudinalToBounds) {
    return z;
  }

  return clamp(
    z,
    fieldSpec.playableBounds.minZ + FORMATION_MEASUREMENTS.playerRadius,
    fieldSpec.playableBounds.maxZ - FORMATION_MEASUREMENTS.playerRadius,
  );
}

function resolveConcreteSide(
  side: FormationSide,
  fieldSide: ConcreteFormationSide,
  boundarySide: ConcreteFormationSide,
): ConcreteFormationSide {
  if (side === 'field') {
    return fieldSide;
  }

  if (side === 'boundary') {
    return boundarySide;
  }

  return side;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
