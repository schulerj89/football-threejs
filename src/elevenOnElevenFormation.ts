import type { SnapPlacement } from './ballSpotting';
import { type FormationValidationIssue } from './formationLayout';
import {
  FORMATION_MEASUREMENTS,
  assertValidResolvedFormation,
  oppositeSide,
  resolveFormation,
  type FormationPlayDefinition,
  type FormationPoint,
  type FormationSide,
  type FormationSlot,
  type LateralAnchor,
  type LongitudinalAnchor,
  type PreferredFormationSide,
  type ResolvedFormation,
  type ResolvedFormationSlot,
} from './formationLayout';
import type { PlayerRole, PlayerTeam } from './playerModel';
import {
  ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS,
  ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS,
  ELEVEN_ON_ELEVEN_PLAYER_IDS,
} from './roster';

export type FootballPosition =
  | 'QB'
  | 'RB'
  | 'C'
  | 'LG'
  | 'RG'
  | 'LT'
  | 'RT'
  | 'TE'
  | 'WR'
  | 'SLOT'
  | 'DL'
  | 'OLB'
  | 'ILB'
  | 'CB'
  | 'FS'
  | 'SS';

export type ElevenOnElevenAlignment = 'backfield' | 'defense' | 'line';

export interface ElevenOnElevenPlayerMetadata {
  alignment: ElevenOnElevenAlignment;
  eligible: boolean;
  footballPosition: FootballPosition;
}

export const ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS = {
  centerOffsetFromSnap: 0,
  cornerCushion: 7.2,
  defensiveLineDepth: 3.8,
  defensiveLineGap: 3.4,
  guardSpacing: 2.2,
  linebackerDepth: 7.4,
  lineOfScrimmageTolerance: 0.001,
  minimumClearance: FORMATION_MEASUREMENTS.minimumPlayerClearance,
  offensiveLineSetback: 0.9,
  outsideLinebackerOffset: 9.2,
  quarterbackDepth: 4.5,
  receiverBackfieldDepth: 1.8,
  receiverSidelineInset: FORMATION_MEASUREMENTS.receiverSidelineInset,
  runningBackDepth: 8.2,
  runningBackFieldOffset: 3.2,
  safetyDepth: 17,
  slotAlignment: 10.8,
  slotDepth: 2.0,
  strongSafetyDepth: 12,
  tackleSpacing: 4.4,
  tightEndSpacing: 6.8,
} as const;

export const ELEVEN_ON_ELEVEN_OFFENSIVE_LINE_IDS = [
  'offense-wr-left',
  'offense-tackle-left',
  'offense-line-left',
  'offense-center',
  'offense-line-right',
  'offense-tackle-right',
  'offense-tight-end',
] as const;

export const ELEVEN_ON_ELEVEN_BACKFIELD_IDS = [
  'offense-qb',
  'offense-rb',
  'offense-slot',
  'offense-wr-right',
] as const;

export const ELEVEN_ON_ELEVEN_INTERIOR_LINE_IDS = [
  'offense-tackle-left',
  'offense-line-left',
  'offense-center',
  'offense-line-right',
  'offense-tackle-right',
] as const;

export const ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS = [
  'offense-wr-left',
  'offense-tight-end',
  'offense-wr-right',
  'offense-slot',
  'offense-rb',
] as const;

const STRONG_SAFETY_THREAT_IDS = [
  'offense-tight-end',
  'offense-slot',
  'offense-rb',
] as const;

const OFFENSE_PRE_SNAP_FACING = { kind: 'playDirection' } as const;
const DEFENSE_PRE_SNAP_FACING = { kind: 'againstPlayDirection' } as const;
const DEFAULT_PREFERRED_SIDE: PreferredFormationSide = 'right';

export const ELEVEN_ON_ELEVEN_PLAYER_METADATA: Record<string, ElevenOnElevenPlayerMetadata> = {
  'defense-corner-left': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'CB',
  },
  'defense-corner-right': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'CB',
  },
  'defense-line-left': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'DL',
  },
  'defense-line-middle': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'DL',
  },
  'defense-line-right': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'DL',
  },
  'defense-linebacker': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'ILB',
  },
  'defense-linebacker-inside': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'ILB',
  },
  'defense-linebacker-left': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'OLB',
  },
  'defense-linebacker-right': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'OLB',
  },
  'defense-safety': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'FS',
  },
  'defense-safety-strong': {
    alignment: 'defense',
    eligible: false,
    footballPosition: 'SS',
  },
  'offense-center': {
    alignment: 'line',
    eligible: false,
    footballPosition: 'C',
  },
  'offense-line-left': {
    alignment: 'line',
    eligible: false,
    footballPosition: 'LG',
  },
  'offense-line-right': {
    alignment: 'line',
    eligible: false,
    footballPosition: 'RG',
  },
  'offense-qb': {
    alignment: 'backfield',
    eligible: false,
    footballPosition: 'QB',
  },
  'offense-rb': {
    alignment: 'backfield',
    eligible: true,
    footballPosition: 'RB',
  },
  'offense-slot': {
    alignment: 'backfield',
    eligible: true,
    footballPosition: 'SLOT',
  },
  'offense-tackle-left': {
    alignment: 'line',
    eligible: false,
    footballPosition: 'LT',
  },
  'offense-tackle-right': {
    alignment: 'line',
    eligible: false,
    footballPosition: 'RT',
  },
  'offense-tight-end': {
    alignment: 'line',
    eligible: true,
    footballPosition: 'TE',
  },
  'offense-wr-left': {
    alignment: 'line',
    eligible: true,
    footballPosition: 'WR',
  },
  'offense-wr-right': {
    alignment: 'backfield',
    eligible: true,
    footballPosition: 'WR',
  },
} as const;

export const ELEVEN_ON_ELEVEN_PREVIEW_FORMATION =
  createElevenOnElevenPreviewFormation(DEFAULT_PREFERRED_SIDE);

export function createElevenOnElevenPreviewFormation(
  preferredSide: PreferredFormationSide = DEFAULT_PREFERRED_SIDE,
): FormationPlayDefinition {
  const strongSide = preferredSide;
  const weakSide = oppositeSide(strongSide);

  return {
    formation: [
      offenseSlot('offense-wr-left', 'receiver', point(sidelineInset(weakSide), offensiveLineDepth())),
      offenseSlot('offense-tackle-left', 'blocker', point(snap(-ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.tackleSpacing), offensiveLineDepth())),
      offenseSlot('offense-line-left', 'blocker', point(snap(-ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.guardSpacing), offensiveLineDepth())),
      offenseSlot('offense-center', 'blocker', point(snap(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.centerOffsetFromSnap), offensiveLineDepth())),
      offenseSlot('offense-line-right', 'blocker', point(snap(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.guardSpacing), offensiveLineDepth())),
      offenseSlot('offense-tackle-right', 'blocker', point(snap(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.tackleSpacing), offensiveLineDepth())),
      offenseSlot('offense-tight-end', 'blocker', point(snapSide(strongSide, ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.tightEndSpacing), offensiveLineDepth())),
      offenseSlot('offense-qb', 'quarterback', point(snap(), offenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.quarterbackDepth))),
      offenseSlot('offense-rb', 'runner', point(snapSide('field', ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.runningBackFieldOffset), offenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.runningBackDepth))),
      offenseSlot('offense-slot', 'receiver', point(snapSide(strongSide, ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.slotAlignment), offenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.slotDepth))),
      offenseSlot('offense-wr-right', 'receiver', point(sidelineInset(strongSide), offenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.receiverBackfieldDepth))),
      defenseSlot('defense-line-left', 'defender', point(snap(-ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.defensiveLineGap), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.defensiveLineDepth))),
      defenseSlot('defense-line-middle', 'defender', point(snap(), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.defensiveLineDepth))),
      defenseSlot('defense-line-right', 'defender', point(snap(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.defensiveLineGap), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.defensiveLineDepth))),
      defenseSlot('defense-linebacker-left', 'defender', point(snapSide('left', ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.outsideLinebackerOffset), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.linebackerDepth))),
      defenseSlot('defense-linebacker', 'defender', point(snap(-ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.guardSpacing), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.linebackerDepth))),
      defenseSlot('defense-linebacker-inside', 'defender', point(snap(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.guardSpacing), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.linebackerDepth))),
      defenseSlot('defense-linebacker-right', 'defender', point(snapSide('right', ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.outsideLinebackerOffset), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.linebackerDepth))),
      defenseSlot('defense-corner-left', 'coverageDefender', point(alignedTo('offense-wr-left'), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.cornerCushion))),
      defenseSlot('defense-corner-right', 'coverageDefender', point(alignedTo('offense-wr-right'), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.cornerCushion))),
      defenseSlot('defense-safety', 'coverageDefender', point(midpointOf([...ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS]), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.safetyDepth))),
      defenseSlot('defense-safety-strong', 'coverageDefender', point(midpointOf([...STRONG_SAFETY_THREAT_IDS]), defenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.strongSafetyDepth))),
    ],
    pass: {
      coverageAssignments: {
        'defense-corner-left': 'offense-wr-left',
        'defense-corner-right': 'offense-wr-right',
      },
      eligibleReceiverIds: [...ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS],
    },
    preferredSide,
    validation: {
      coverageAlignmentToleranceYards: ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.lineOfScrimmageTolerance,
      defensiveGapOffsets: {
        'defense-line-left': -ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.defensiveLineGap,
        'defense-line-middle': 0,
        'defense-line-right': ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.defensiveLineGap,
      },
      expectedDefenseCount: 11,
      expectedOffenseCount: 11,
      offensiveLineIds: [...ELEVEN_ON_ELEVEN_INTERIOR_LINE_IDS],
      receiverSidelineInsetYards: {
        'offense-wr-left': ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset,
        'offense-wr-right': ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset,
      },
      stablePlayerIds: ELEVEN_ON_ELEVEN_PLAYER_IDS,
    },
  };
}

export function resolveElevenOnElevenPreviewFormation(
  snapPlacement: SnapPlacement,
  preferredSide: PreferredFormationSide = DEFAULT_PREFERRED_SIDE,
): ResolvedFormation {
  const formation = resolveFormation(
    createElevenOnElevenPreviewFormation(preferredSide),
    snapPlacement,
  );
  formation.issues = [
    ...formation.issues,
    ...validateElevenOnElevenFormation(formation),
  ];
  assertValidResolvedFormation(formation);

  return formation;
}

export function validateElevenOnElevenFormation(
  formation: ResolvedFormation,
): FormationValidationIssue[] {
  const issues: FormationValidationIssue[] = [];
  const slotsById = new Map(formation.slots.map((slot) => [slot.id, slot]));

  validateTeamOwnership(slotsById, issues);
  validateExactPositionUniqueness(formation.slots, issues);
  validateOffensiveAlignment(formation, slotsById, issues);
  validateEligibleStatus(slotsById, issues);
  validateCornerAlignment(slotsById, issues);
  validateSafetyAlignment(slotsById, issues);

  return issues;
}

export function getElevenOnElevenPlayerMetadata(
  playerId: string,
): ElevenOnElevenPlayerMetadata | null {
  return ELEVEN_ON_ELEVEN_PLAYER_METADATA[playerId] ?? null;
}

function validateTeamOwnership(
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  validateTeamIds(ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS, 'offense', slotsById, issues);
  validateTeamIds(ELEVEN_ON_ELEVEN_DEFENSE_PLAYER_IDS, 'defense', slotsById, issues);
}

function validateTeamIds(
  playerIds: readonly string[],
  expectedTeam: PlayerTeam,
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  for (const playerId of playerIds) {
    const slot = slotsById.get(playerId);

    if (!slot) {
      continue;
    }

    if (slot.team !== expectedTeam) {
      issues.push({
        message: `${playerId} must belong to ${expectedTeam}`,
        playerIds: [playerId],
      });
    }
  }
}

function validateExactPositionUniqueness(
  slots: ResolvedFormationSlot[],
  issues: FormationValidationIssue[],
): void {
  const tolerance = ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.lineOfScrimmageTolerance;

  for (let outer = 0; outer < slots.length; outer += 1) {
    for (let inner = outer + 1; inner < slots.length; inner += 1) {
      const first = slots[outer];
      const second = slots[inner];

      if (
        Math.abs(first.position.x - second.position.x) <= tolerance &&
        Math.abs(first.position.z - second.position.z) <= tolerance
      ) {
        issues.push({
          message: `${first.id} and ${second.id} have duplicate formation positions`,
          playerIds: [first.id, second.id],
        });
      }
    }
  }
}

function validateOffensiveAlignment(
  formation: ResolvedFormation,
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  const lineSlots = getPresentSlots(ELEVEN_ON_ELEVEN_OFFENSIVE_LINE_IDS, slotsById);
  const backfieldSlots = getPresentSlots(ELEVEN_ON_ELEVEN_BACKFIELD_IDS, slotsById);
  const tolerance = ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.lineOfScrimmageTolerance;

  if (lineSlots.length !== 7) {
    issues.push({
      message: `Expected seven offensive players on the line, found ${lineSlots.length}`,
      playerIds: lineSlots.map((slot) => slot.id),
    });
  }

  if (backfieldSlots.length !== 4) {
    issues.push({
      message: `Expected four offensive players in the backfield, found ${backfieldSlots.length}`,
      playerIds: backfieldSlots.map((slot) => slot.id),
    });
  }

  for (const slot of lineSlots) {
    const expectedDepth = -ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.offensiveLineSetback;
    if (Math.abs(slot.distanceFromLineOfScrimmage - expectedDepth) > tolerance) {
      issues.push({
        message: `${slot.id} is not aligned on the offensive line`,
        playerIds: [slot.id],
      });
    }
  }

  for (const slot of backfieldSlots) {
    if (
      slot.distanceFromLineOfScrimmage >=
      -ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.offensiveLineSetback - tolerance
    ) {
      issues.push({
        message: `${slot.id} is not clearly in the backfield`,
        playerIds: [slot.id],
      });
    }
  }

  const center = slotsById.get('offense-center');
  if (center && Math.abs(center.position.x - formation.snapPlacement.spot.x) > tolerance) {
    issues.push({
      message: 'Center must align with the snap position',
      playerIds: ['offense-center'],
    });
  }
}

function validateEligibleStatus(
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  const eligibleIds = new Set<string>(ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS);

  for (const playerId of ELEVEN_ON_ELEVEN_OFFENSE_PLAYER_IDS) {
    const slot = slotsById.get(playerId);
    const metadata = getElevenOnElevenPlayerMetadata(playerId);

    if (!slot || !metadata) {
      continue;
    }

    if (metadata.eligible !== eligibleIds.has(playerId)) {
      issues.push({
        message: `${playerId} has inconsistent eligibility metadata`,
        playerIds: [playerId],
      });
    }
  }

  for (const interiorId of ELEVEN_ON_ELEVEN_INTERIOR_LINE_IDS) {
    const metadata = getElevenOnElevenPlayerMetadata(interiorId);
    if (metadata?.eligible) {
      issues.push({
        message: `${interiorId} is an interior line player and cannot be eligible`,
        playerIds: [interiorId],
      });
    }
  }
}

function validateCornerAlignment(
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  validateAlignedPair(slotsById, 'defense-corner-left', 'offense-wr-left', issues);
  validateAlignedPair(slotsById, 'defense-corner-right', 'offense-wr-right', issues);
}

function validateSafetyAlignment(
  slotsById: Map<string, ResolvedFormationSlot>,
  issues: FormationValidationIssue[],
): void {
  validateMidpointAlignment(
    slotsById,
    'defense-safety',
    [...ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS],
    'Free safety must align to the eligible threat midpoint',
    issues,
  );
  validateMidpointAlignment(
    slotsById,
    'defense-safety-strong',
    [...STRONG_SAFETY_THREAT_IDS],
    'Strong safety must align to the strong-side receiving threat midpoint',
    issues,
  );
}

function validateAlignedPair(
  slotsById: Map<string, ResolvedFormationSlot>,
  defenderId: string,
  receiverId: string,
  issues: FormationValidationIssue[],
): void {
  const defender = slotsById.get(defenderId);
  const receiver = slotsById.get(receiverId);

  if (!defender || !receiver) {
    return;
  }

  if (
    Math.abs(defender.position.x - receiver.position.x) >
    ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.lineOfScrimmageTolerance
  ) {
    issues.push({
      message: `${defenderId} is not aligned to outside receiver ${receiverId}`,
      playerIds: [defenderId, receiverId],
    });
  }
}

function validateMidpointAlignment(
  slotsById: Map<string, ResolvedFormationSlot>,
  playerId: string,
  threatIds: string[],
  message: string,
  issues: FormationValidationIssue[],
): void {
  const player = slotsById.get(playerId);
  const threats = getPresentSlots(threatIds, slotsById);

  if (!player || threats.length !== threatIds.length) {
    return;
  }

  const expectedX = average(threats.map((slot) => slot.position.x));
  if (
    Math.abs(player.position.x - expectedX) >
    ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.lineOfScrimmageTolerance
  ) {
    issues.push({
      message,
      playerIds: [playerId, ...threatIds],
    });
  }
}

function getPresentSlots(
  playerIds: readonly string[],
  slotsById: Map<string, ResolvedFormationSlot>,
): ResolvedFormationSlot[] {
  return playerIds
    .map((playerId) => slotsById.get(playerId))
    .filter((slot): slot is ResolvedFormationSlot => !!slot);
}

function offenseSlot(id: string, role: PlayerRole, formationPoint: FormationPoint): FormationSlot {
  return {
    ...formationPoint,
    id,
    preSnapFacing: OFFENSE_PRE_SNAP_FACING,
    role,
    team: 'offense',
  };
}

function defenseSlot(id: string, role: PlayerRole, formationPoint: FormationPoint): FormationSlot {
  return {
    ...formationPoint,
    id,
    preSnapFacing: DEFENSE_PRE_SNAP_FACING,
    role,
    team: 'defense',
  };
}

function point(lateral: LateralAnchor, longitudinal: LongitudinalAnchor): FormationPoint {
  return { lateral, longitudinal };
}

function snap(offsetYards = 0): LateralAnchor {
  return { kind: 'snap', offsetYards };
}

function snapSide(side: FormationSide, distanceYards: number): LateralAnchor {
  return { distanceYards, kind: 'snapSide', side };
}

function sidelineInset(side: FormationSide): LateralAnchor {
  return {
    insetYards: ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset,
    kind: 'sidelineInset',
    side,
  };
}

function alignedTo(playerId: string): LateralAnchor {
  return { kind: 'alignedToPlayer', offsetYards: 0, playerId };
}

function midpointOf(playerIds: string[]): LateralAnchor {
  return { kind: 'midpointOfPlayers', offsetYards: 0, playerIds };
}

function offensiveLineDepth(): LongitudinalAnchor {
  return offenseDepth(ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS.offensiveLineSetback);
}

function offenseDepth(depthYards: number): LongitudinalAnchor {
  return lineOfScrimmageDepth('offense', depthYards);
}

function defenseDepth(depthYards: number): LongitudinalAnchor {
  return lineOfScrimmageDepth('defense', depthYards);
}

function lineOfScrimmageDepth(
  side: LongitudinalAnchor['side'],
  depthYards: number,
): LongitudinalAnchor {
  return {
    depthYards,
    kind: 'lineOfScrimmage',
    side,
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
