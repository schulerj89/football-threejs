import type { SnapLane, SnapPlacement } from './ballSpotting';
import {
  FIELD_DIMENSIONS,
  FIELD_DIRECTION,
  PLAYABLE_FIELD_BOUNDS,
  type FieldBounds,
} from './fieldSpec';
import { cloneFootballSpot, type FootballSpot } from './fieldScale';
import type { PlayerRole, PlayerTeam } from './playerModel';

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
}

export interface FormationFieldSpec {
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
}

export interface FormationValidationIssue {
  message: string;
  playerIds: string[];
}

export const OFFENSE_PLAYER_IDS = [
  'offense-qb',
  'offense-rb',
  'offense-blocker-left',
  'offense-blocker-right',
  'offense-wr',
] as const;

export const DEFENSE_PLAYER_IDS = [
  'defense-rusher-left',
  'defense-rusher-right',
  'defense-cover-wr',
  'defense-cover-rb',
  'defense-safety',
] as const;

export const STABLE_PLAYER_IDS = [
  ...OFFENSE_PLAYER_IDS,
  ...DEFENSE_PLAYER_IDS,
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
  const issues: FormationValidationIssue[] = [];
  const slotsById = new Map<string, ResolvedFormationSlot>();

  for (const slot of formation.slots) {
    if (slotsById.has(slot.id)) {
      issues.push({
        message: `Duplicate player ID ${slot.id}`,
        playerIds: [slot.id],
      });
    }
    slotsById.set(slot.id, slot);
  }

  validateStableRoster(formation, slotsById, issues);
  validateBounds(formation, fieldSpec, issues);
  validateClearance(formation, issues);
  validateSideOfBall(formation, fieldSpec, issues);
  validateBlockerSymmetry(formation, issues);
  validateLineDepths(formation, issues);
  validateAssignments(formation, slotsById, issues);

  return issues;
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

  return snapPlacement.spot.z + direction * anchor.depthYards * fieldSpec.playDirectionZ;
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

function validateStableRoster(
  formation: ResolvedFormation,
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  const offenseCount = formation.slots.filter((slot) => slot.team === 'offense').length;
  const defenseCount = formation.slots.filter((slot) => slot.team === 'defense').length;

  if (offenseCount !== 5) {
    issues.push({ message: `Expected five offense players, found ${offenseCount}`, playerIds: [] });
  }

  if (defenseCount !== 5) {
    issues.push({ message: `Expected five defense players, found ${defenseCount}`, playerIds: [] });
  }

  for (const playerId of STABLE_PLAYER_IDS) {
    if (!slotsById.has(playerId)) {
      issues.push({ message: `Missing stable player ID ${playerId}`, playerIds: [playerId] });
    }
  }

  for (const slot of formation.slots) {
    if (!STABLE_PLAYER_IDS.includes(slot.id as StablePlayerId)) {
      issues.push({ message: `Unexpected player ID ${slot.id}`, playerIds: [slot.id] });
    }
  }
}

function validateBounds(
  formation: ResolvedFormation,
  fieldSpec: FormationFieldSpec,
  issues: FormationValidationIssue[],
): void {
  for (const slot of formation.slots) {
    const bounds = fieldSpec.playableBounds;
    const radius = FORMATION_MEASUREMENTS.playerRadius;

    if (
      slot.position.x < bounds.minX + radius ||
      slot.position.x > bounds.maxX - radius ||
      slot.position.z < bounds.minZ + radius ||
      slot.position.z > bounds.maxZ - radius
    ) {
      issues.push({
        message: `${slot.id} is outside playable field bounds`,
        playerIds: [slot.id],
      });
    }
  }
}

function validateClearance(
  formation: ResolvedFormation,
  issues: FormationValidationIssue[],
): void {
  for (let outer = 0; outer < formation.slots.length; outer += 1) {
    for (let inner = outer + 1; inner < formation.slots.length; inner += 1) {
      const first = formation.slots[outer];
      const second = formation.slots[inner];
      const distance = Math.hypot(
        first.position.x - second.position.x,
        first.position.z - second.position.z,
      );

      if (distance < FORMATION_MEASUREMENTS.minimumPlayerClearance) {
        issues.push({
          message: `${first.id} and ${second.id} overlap or violate clearance`,
          playerIds: [first.id, second.id],
        });
      }
    }
  }
}

function validateSideOfBall(
  formation: ResolvedFormation,
  fieldSpec: FormationFieldSpec,
  issues: FormationValidationIssue[],
): void {
  const snapZ = formation.snapPlacement.spot.z;

  for (const slot of formation.slots) {
    const signedDepth = (slot.position.z - snapZ) * fieldSpec.playDirectionZ;

    if (slot.team === 'offense' && signedDepth > -FORMATION_EPSILON) {
      issues.push({
        message: `${slot.id} is not on the offensive side before the snap`,
        playerIds: [slot.id],
      });
    }

    if (slot.team === 'defense' && signedDepth < FORMATION_EPSILON) {
      issues.push({
        message: `${slot.id} is not on the defensive side before the snap`,
        playerIds: [slot.id],
      });
    }
  }
}

function validateBlockerSymmetry(
  formation: ResolvedFormation,
  issues: FormationValidationIssue[],
): void {
  const left = getSlot(formation, 'offense-blocker-left');
  const right = getSlot(formation, 'offense-blocker-right');
  const snapX = formation.snapPlacement.spot.x;

  if (!left || !right) {
    return;
  }

  if (Math.abs(left.position.z - right.position.z) > FORMATION_EPSILON) {
    issues.push({
      message: 'Offensive blockers do not share the same pre-snap Z coordinate',
      playerIds: [left.id, right.id],
    });
  }

  if (Math.abs((left.position.x + right.position.x) / 2 - snapX) > FORMATION_EPSILON) {
    issues.push({
      message: 'Offensive blockers are not symmetrical around the snap X',
      playerIds: [left.id, right.id],
    });
  }
}

function validateLineDepths(
  formation: ResolvedFormation,
  issues: FormationValidationIssue[],
): void {
  const leftRusher = getSlot(formation, 'defense-rusher-left');
  const rightRusher = getSlot(formation, 'defense-rusher-right');

  if (
    leftRusher &&
    rightRusher &&
    Math.abs(leftRusher.position.z - rightRusher.position.z) > FORMATION_EPSILON
  ) {
    issues.push({
      message: 'Defensive rushers do not share the same pre-snap Z coordinate',
      playerIds: [leftRusher.id, rightRusher.id],
    });
  }
}

function validateAssignments(
  formation: ResolvedFormation,
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  for (const receiverId of Object.values(formation.coverageAssignments)) {
    if (!slotsById.has(receiverId)) {
      issues.push({
        message: `Coverage assignment references missing player ${receiverId}`,
        playerIds: [receiverId],
      });
    }
  }

  for (const defenderId of Object.keys(formation.coverageAssignments)) {
    if (!slotsById.has(defenderId)) {
      issues.push({
        message: `Coverage assignment uses missing defender ${defenderId}`,
        playerIds: [defenderId],
      });
    }
  }
}

function getSlot(
  formation: ResolvedFormation,
  playerId: string,
): ResolvedFormationSlot | undefined {
  return formation.slots.find((slot) => slot.id === playerId);
}
