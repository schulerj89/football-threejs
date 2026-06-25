import type {
  FormationFieldSpec,
  FormationValidationConfig,
  FormationValidationIssue,
  ResolvedFormation,
  ResolvedFormationSlot,
} from './formationLayout';

export interface FormationValidationMeasurements {
  minimumPlayerClearance: number;
  playerRadius: number;
}

export interface FormationValidationContext {
  defaultOffensiveLineIds: FormationValidationConfig['offensiveLineIds'];
  epsilon: number;
  measurements: FormationValidationMeasurements;
}

export function validateResolvedFormationWithContext(
  formation: ResolvedFormation,
  fieldSpec: FormationFieldSpec,
  context: FormationValidationContext,
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
  validateBounds(formation, fieldSpec, context, issues);
  validateClearance(formation, context, issues);
  validateSideOfBall(formation, fieldSpec, context, issues);
  validateBlockerSymmetry(formation, context, issues);
  validateLineDepths(formation, context, issues);
  validateAssignments(formation, slotsById, fieldSpec, context, issues);

  return issues;
}

function validateStableRoster(
  formation: ResolvedFormation,
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  const offenseCount = formation.slots.filter((slot) => slot.team === 'offense').length;
  const defenseCount = formation.slots.filter((slot) => slot.team === 'defense').length;

  if (offenseCount !== formation.validation.expectedOffenseCount) {
    issues.push({
      message: `Expected ${formatCount(formation.validation.expectedOffenseCount)} offense players, found ${offenseCount}`,
      playerIds: [],
    });
  }

  if (defenseCount !== formation.validation.expectedDefenseCount) {
    issues.push({
      message: `Expected ${formatCount(formation.validation.expectedDefenseCount)} defense players, found ${defenseCount}`,
      playerIds: [],
    });
  }

  for (const playerId of formation.validation.stablePlayerIds) {
    if (!slotsById.has(playerId)) {
      issues.push({ message: `Missing stable player ID ${playerId}`, playerIds: [playerId] });
    }
  }

  for (const slot of formation.slots) {
    if (!formation.validation.stablePlayerIds.includes(slot.id)) {
      issues.push({ message: `Unexpected player ID ${slot.id}`, playerIds: [slot.id] });
    }
  }
}

function validateBounds(
  formation: ResolvedFormation,
  fieldSpec: FormationFieldSpec,
  context: FormationValidationContext,
  issues: FormationValidationIssue[],
): void {
  for (const slot of formation.slots) {
    const bounds = fieldSpec.playableBounds;
    const radius = context.measurements.playerRadius;

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
  context: FormationValidationContext,
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

      if (distance < context.measurements.minimumPlayerClearance) {
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
  context: FormationValidationContext,
  issues: FormationValidationIssue[],
): void {
  const snapZ = formation.snapPlacement.spot.z;

  for (const slot of formation.slots) {
    const signedDepth = (slot.position.z - snapZ) * fieldSpec.playDirectionZ;

    if (slot.team === 'offense' && signedDepth > -context.epsilon) {
      issues.push({
        message: `${slot.id} is not on the offensive side before the snap`,
        playerIds: [slot.id],
      });
    }

    if (slot.team === 'defense' && signedDepth < context.epsilon) {
      issues.push({
        message: `${slot.id} is not on the defensive side before the snap`,
        playerIds: [slot.id],
      });
    }
  }
}

function validateBlockerSymmetry(
  formation: ResolvedFormation,
  context: FormationValidationContext,
  issues: FormationValidationIssue[],
): void {
  const lineIds = formation.validation.offensiveLineIds ?? context.defaultOffensiveLineIds ?? [];
  const lineSlots = lineIds
    .map((playerId) => getSlot(formation, playerId))
    .filter((slot): slot is ResolvedFormationSlot => !!slot)
    .sort((a, b) => a.position.x - b.position.x);
  const snapX = formation.snapPlacement.spot.x;

  if (lineSlots.length < 2) {
    return;
  }

  const lineZ = lineSlots[0].position.z;
  if (lineSlots.some((slot) => Math.abs(slot.position.z - lineZ) > context.epsilon)) {
    issues.push({
      message: 'Offensive line players do not share the same pre-snap Z coordinate',
      playerIds: lineSlots.map((slot) => slot.id),
    });
  }

  if (Math.abs(average(lineSlots.map((slot) => slot.position.x)) - snapX) > context.epsilon) {
    issues.push({
      message: 'Offensive line players are not symmetrical around the snap X',
      playerIds: lineSlots.map((slot) => slot.id),
    });
  }

  if (lineSlots.length < 3) {
    return;
  }

  const firstSpacing = lineSlots[1].position.x - lineSlots[0].position.x;
  for (let index = 2; index < lineSlots.length; index += 1) {
    const spacing = lineSlots[index].position.x - lineSlots[index - 1].position.x;
    if (Math.abs(spacing - firstSpacing) > context.epsilon) {
      issues.push({
        message: 'Offensive line spacing is not equal',
        playerIds: lineSlots.map((slot) => slot.id),
      });
      return;
    }
  }
}

function validateLineDepths(
  formation: ResolvedFormation,
  context: FormationValidationContext,
  issues: FormationValidationIssue[],
): void {
  validateDefensiveGapOffsets(formation, context, issues);

  const leftRusher = getSlot(formation, 'defense-rusher-left');
  const rightRusher = getSlot(formation, 'defense-rusher-right');

  if (
    leftRusher &&
    rightRusher &&
    Math.abs(leftRusher.position.z - rightRusher.position.z) > context.epsilon
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
  fieldSpec: FormationFieldSpec,
  context: FormationValidationContext,
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

  validateCoverageAlignment(formation, slotsById, context, issues);
  validateReceiverSidelineInsets(formation, slotsById, fieldSpec, context, issues);
}

function getSlot(
  formation: ResolvedFormation,
  playerId: string,
): ResolvedFormationSlot | undefined {
  return formation.slots.find((slot) => slot.id === playerId);
}

function validateCoverageAlignment(
  formation: ResolvedFormation,
  slotsById: Map<string, ResolvedFormationSlot>,
  context: FormationValidationContext,
  issues: FormationValidationIssue[],
): void {
  const tolerance = formation.validation.coverageAlignmentToleranceYards ?? 0.001;

  for (const [defenderId, receiverId] of Object.entries(formation.coverageAssignments)) {
    const defender = slotsById.get(defenderId);
    const receiver = slotsById.get(receiverId);

    if (!defender || !receiver) {
      continue;
    }

    if (Math.abs(defender.position.x - receiver.position.x) > tolerance) {
      issues.push({
        message: `${defenderId} is not aligned to coverage assignment ${receiverId}`,
        playerIds: [defenderId, receiverId],
      });
    }
  }
}

function validateReceiverSidelineInsets(
  formation: ResolvedFormation,
  slotsById: Map<string, ResolvedFormationSlot>,
  fieldSpec: FormationFieldSpec,
  context: FormationValidationContext,
  issues: FormationValidationIssue[],
): void {
  const expectedInsets = formation.validation.receiverSidelineInsetYards ?? {};

  for (const [playerId, expectedInset] of Object.entries(expectedInsets)) {
    const receiver = slotsById.get(playerId);

    if (!receiver) {
      continue;
    }

    const halfWidth = fieldSpec.fieldWidth / 2;
    const inset = Math.min(
      Math.abs(receiver.position.x - -halfWidth),
      Math.abs(halfWidth - receiver.position.x),
    );

    if (Math.abs(inset - expectedInset) > context.epsilon) {
      issues.push({
        message: `${playerId} does not preserve receiver sideline inset`,
        playerIds: [playerId],
      });
    }
  }
}

function validateDefensiveGapOffsets(
  formation: ResolvedFormation,
  context: FormationValidationContext,
  issues: FormationValidationIssue[],
): void {
  const gapOffsets = formation.validation.defensiveGapOffsets ?? {};

  for (const [playerId, expectedOffset] of Object.entries(gapOffsets)) {
    const defender = getSlot(formation, playerId);

    if (!defender) {
      continue;
    }

    if (Math.abs(defender.lateralDistanceFromSnap - expectedOffset) > context.epsilon) {
      issues.push({
        message: `${playerId} is not aligned to declared defensive gap`,
        playerIds: [playerId],
      });
    }
  }
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatCount(count: number): string {
  if (count === 5) {
    return 'five';
  }

  if (count === 7) {
    return 'seven';
  }

  return count.toString();
}
