import { FIELD_BOUNDS, type FieldBounds } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { GameplayRosterBinding } from '../roster/GameplayRosterBinding';
import { getKickerRatings } from './KickerRatings';
import { KICKOFF_FORMATION_CONFIG } from './KickoffFormationConfiguration';
import type {
  KickoffPresentationParticipant,
  KickoffSlotId,
} from './KickoffPresentationRoster';
import { resolveKickoffPresentationRoster } from './SpecialTeamsLineupResolver';
import type { KickoffDirection, KickoffState } from './KickoffTypes';
import {
  COLLEGE_SPECIAL_TEAMS_RULE_SPEC,
  resolveReceivingRestrainingLineZ,
} from './CollegeSpecialTeamsRuleSpec';
import { FOOTBALL_PLAYER_VISUAL_PROFILE_ID } from '../presentation/players/FootballPlayerVisualFactory';

export type KickoffFormationFamily = 'kickoff';

export interface KickoffFormationParticipantPlacement extends KickoffPresentationParticipant {
  facingRadians: number;
  formationFamily: KickoffFormationFamily;
  position: FootballSpot;
  presentationOnly: true;
  scale: number;
  visualProfileId: typeof FOOTBALL_PLAYER_VISUAL_PROFILE_ID;
}

export interface KickoffFormationLayout {
  ballPlacement: FootballSpot | null;
  bounds: FieldBounds | null;
  family: KickoffFormationFamily;
  noGameplayAuthority: true;
  participantRoster: ReturnType<typeof resolveKickoffPresentationRoster>;
  participants: readonly KickoffFormationParticipantPlacement[];
  placements: readonly KickoffFormationParticipantPlacement[];
}

const SLOT_OFFSETS: Record<KickoffSlotId, number> = {
  'coverage-left-1': -1,
  'coverage-left-2': -2,
  'coverage-left-3': -3,
  'coverage-left-4': -4,
  'coverage-left-5': -5,
  'coverage-right-1': 1,
  'coverage-right-2': 2,
  'coverage-right-3': 3,
  'coverage-right-4': 4,
  'coverage-right-5': 5,
  'front-line-left-1': -1,
  'front-line-left-2': -2,
  'front-line-middle': 0,
  'front-line-right-1': 1,
  'front-line-right-2': 2,
  kicker: 0,
  'returner-left': -0.5,
  'returner-right': 0.5,
  'second-line-left-1': -0.5,
  'second-line-left-2': -1.5,
  'second-line-right-1': 0.5,
  'second-line-right-2': 1.5,
};

export function createKickoffFormation(
  kickoff: KickoffState,
  binding: GameplayRosterBinding,
): KickoffFormationLayout {
  if (!kickoff.result || !kickoff.kickingTeam || !kickoff.receivingTeam) {
    return createEmptyKickoffLayout();
  }

  const participantRoster = resolveKickoffPresentationRoster(kickoff, binding);
  if (!participantRoster) {
    return createEmptyKickoffLayout();
  }

  const participants = participantRoster.participants.map((participant) =>
    createPlacement(participant, kickoff));
  const bounds = calculateBounds(participants, kickoff.result.origin);

  return {
    ballPlacement: cloneSpot(kickoff.result.origin),
    bounds,
    family: 'kickoff',
    noGameplayAuthority: true,
    participantRoster,
    participants,
    placements: participants,
  };
}

export function validateKickoffFormation(layout: KickoffFormationLayout): string[] {
  const issues: string[] = [];
  const participants = layout.participants;

  if (participants.length !== 22) {
    issues.push(`Kickoff formation must include exactly 22 participants, received ${participants.length}`);
  }

  const kickingParticipants = participants.filter((participant) => participant.phase === 'kicking');
  const receivingParticipants = participants.filter((participant) => participant.phase === 'receiving');
  if (kickingParticipants.length !== 11) {
    issues.push(`Kickoff formation must include 11 kicking-team participants, received ${kickingParticipants.length}`);
  }
  if (receivingParticipants.length !== 11) {
    issues.push(`Kickoff formation must include 11 receiving-team participants, received ${receivingParticipants.length}`);
  }

  validateUniqueParticipants(participants, issues);
  validateFieldBounds(layout, issues);
  validateClearance(participants, issues);
  validateKickoffSemantics(layout, issues);

  return issues;
}

export function resolveKickoffKickerDetails(
  kickoff: KickoffState,
  binding: GameplayRosterBinding,
): { accuracy: number; kickerId: string; power: number } | null {
  if (!kickoff.kickingTeam) {
    return null;
  }
  const roster = kickoff.kickingTeam === 'user' ? binding.userRoster : binding.opponentRoster;
  const kicker = roster.players.find((player) => player.id === roster.kickerId) ?? null;
  const ratings = getKickerRatings(kicker);
  return {
    accuracy: ratings.kickAccuracy,
    kickerId: roster.kickerId,
    power: ratings.kickPower,
  };
}

function createPlacement(
  participant: KickoffPresentationParticipant,
  kickoff: KickoffState,
): KickoffFormationParticipantPlacement {
  const result = kickoff.result;
  if (!result) {
    throw new Error('Cannot place kickoff participant without kickoff result');
  }
  const direction = kickoff.direction;
  const position = resolveSlotPosition(participant.slotId, result.origin, result.target, direction);

  return {
    ...participant,
    facingRadians: participant.phase === 'kicking'
      ? resolveFacing(direction)
      : resolveFacing(invertDirection(direction)),
    formationFamily: 'kickoff',
    position,
    presentationOnly: true,
    scale: participant.slotId === 'kicker' ? 1 : 0.98,
    visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  };
}

function resolveSlotPosition(
  slotId: KickoffSlotId,
  origin: FootballSpot,
  target: FootballSpot,
  direction: KickoffDirection,
): FootballSpot {
  const offset = SLOT_OFFSETS[slotId];

  if (slotId === 'kicker') {
    return {
      x: clampX(origin.x),
      z: clampZ(origin.z - direction * KICKOFF_FORMATION_CONFIG.kickerDepthBehindOrigin),
    };
  }

  if (slotId.startsWith('coverage-')) {
    return {
      x: clampX(offset * KICKOFF_FORMATION_CONFIG.coverageLateralSpacing),
      z: clampZ(origin.z - direction * KICKOFF_FORMATION_CONFIG.coverageRowDepthBehindOrigin),
    };
  }

  if (slotId.startsWith('front-line-')) {
    const restrainingLineZ = resolveReceivingRestrainingLineZ(direction);
    return {
      x: clampX(offset * KICKOFF_FORMATION_CONFIG.frontLineLateralSpacing),
      z: clampZ(restrainingLineZ + direction * KICKOFF_FORMATION_CONFIG.frontLineDepthBeyondRestrainingLine),
    };
  }

  if (slotId.startsWith('second-line-')) {
    const restrainingLineZ = resolveReceivingRestrainingLineZ(direction);
    return {
      x: clampX(offset * KICKOFF_FORMATION_CONFIG.secondLineLateralSpacing),
      z: clampZ(restrainingLineZ + direction * KICKOFF_FORMATION_CONFIG.secondLineDepthBeyondRestrainingLine),
    };
  }

  const restrainingLineZ = resolveReceivingRestrainingLineZ(direction);
  return {
    x: clampX(target.x + offset * KICKOFF_FORMATION_CONFIG.returnerLateralSpacing),
    z: clampZ(restrainingLineZ + direction * KICKOFF_FORMATION_CONFIG.returnerDepthBeyondRestrainingLine),
  };
}

function validateUniqueParticipants(
  participants: readonly KickoffFormationParticipantPlacement[],
  issues: string[],
): void {
  const ids = new Set<string>();
  const rosterIdsByTeam = new Map<string, Set<string>>();

  for (const participant of participants) {
    if (ids.has(participant.visualId)) {
      issues.push(`Duplicate kickoff visual ID ${participant.visualId}`);
    }
    ids.add(participant.visualId);

    const key = participant.team;
    const rosterIds = rosterIdsByTeam.get(key) ?? new Set<string>();
    if (rosterIds.has(participant.rosterPlayerId)) {
      issues.push(`Roster player ${participant.rosterPlayerId} occupies multiple kickoff slots`);
    }
    rosterIds.add(participant.rosterPlayerId);
    rosterIdsByTeam.set(key, rosterIds);
  }
}

function validateFieldBounds(layout: KickoffFormationLayout, issues: string[]): void {
  if (!layout.ballPlacement) {
    issues.push('Kickoff formation must include a ball placement');
  } else if (!isSpotInsideField(layout.ballPlacement)) {
    issues.push('Kickoff ball placement is outside field bounds');
  }

  for (const participant of layout.participants) {
    if (!isSpotInsideField(participant.position)) {
      issues.push(`${participant.visualId} is outside field bounds`);
    }
    if (layout.bounds && !boundsContainsSpot(layout.bounds, participant.position)) {
      issues.push(`${participant.visualId} is outside kickoff formation bounds`);
    }
  }
}

function validateClearance(
  participants: readonly KickoffFormationParticipantPlacement[],
  issues: string[],
): void {
  for (let index = 0; index < participants.length; index += 1) {
    const a = participants[index]!;
    for (let next = index + 1; next < participants.length; next += 1) {
      const b = participants[next]!;
      const distance = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
      if (distance < KICKOFF_FORMATION_CONFIG.minimumPlayerClearance) {
        issues.push(`${a.visualId} overlaps ${b.visualId}`);
      }
    }
  }
}

function validateKickoffSemantics(layout: KickoffFormationLayout, issues: string[]): void {
  const kickoff = layout.participants.find((participant) => participant.slotId === 'kicker');
  if (!layout.ballPlacement || !kickoff) {
    return;
  }
  const direction = kickoff.position.z <= layout.ballPlacement.z ? 1 : -1;
  const restrainingLineZ = resolveReceivingRestrainingLineZ(direction);

  for (const participant of layout.participants) {
    if (participant.phase === 'kicking' && participant.position.z * direction > layout.ballPlacement.z * direction) {
      issues.push(`${participant.visualId} is not behind the kickoff origin`);
    }
    if (participant.phase === 'kicking' && participant.slotId !== 'kicker') {
      const depthBehindLine = (layout.ballPlacement.z - participant.position.z) * direction;
      if (
        depthBehindLine < -0.001 ||
        depthBehindLine >
          COLLEGE_SPECIAL_TEAMS_RULE_SPEC.maximumNonKickerDepthBehindKickingLineYards + 0.001
      ) {
        issues.push(`${participant.visualId} violates kickoff-line depth constraints`);
      }
    }
    if (participant.phase === 'receiving' && participant.position.z * direction < restrainingLineZ * direction) {
      issues.push(`${participant.visualId} is not behind the receiving restraining line`);
    }
  }

  const coverageLeft = layout.participants.filter((participant) =>
    participant.phase === 'kicking' && participant.slotId.startsWith('coverage-left-'));
  const coverageRight = layout.participants.filter((participant) =>
    participant.phase === 'kicking' && participant.slotId.startsWith('coverage-right-'));
  if (
    coverageLeft.length < COLLEGE_SPECIAL_TEAMS_RULE_SPEC.minimumKickingPlayersPerSideOfKicker ||
    coverageRight.length < COLLEGE_SPECIAL_TEAMS_RULE_SPEC.minimumKickingPlayersPerSideOfKicker
  ) {
    issues.push('Kickoff coverage must have at least four players on each side of the kicker');
  }
  if (coverageLeft.length !== 5 || coverageRight.length !== 5) {
    issues.push('Standard kickoff coverage must have five players on each side of the kicker');
  }

  const returners = layout.participants.filter((participant) => participant.slotId.startsWith('returner-'));
  const receivingRows = layout.participants.filter((participant) =>
    participant.slotId.startsWith('front-line-') || participant.slotId.startsWith('second-line-'));
  for (const returner of returners) {
    for (const rowPlayer of receivingRows) {
      if (returner.position.z * direction <= rowPlayer.position.z * direction) {
        issues.push(`${returner.visualId} must align behind receiving rows`);
      }
    }
  }
}

function createEmptyKickoffLayout(): KickoffFormationLayout {
  return {
    ballPlacement: null,
    bounds: null,
    family: 'kickoff',
    noGameplayAuthority: true,
    participantRoster: null,
    participants: [],
    placements: [],
  };
}

function calculateBounds(
  participants: readonly KickoffFormationParticipantPlacement[],
  ballPlacement: FootballSpot,
): FieldBounds {
  return participants.reduce(
    (bounds, participant) => ({
      maxX: Math.max(bounds.maxX, participant.position.x),
      maxZ: Math.max(bounds.maxZ, participant.position.z),
      minX: Math.min(bounds.minX, participant.position.x),
      minZ: Math.min(bounds.minZ, participant.position.z),
    }),
    {
      maxX: ballPlacement.x,
      maxZ: ballPlacement.z,
      minX: ballPlacement.x,
      minZ: ballPlacement.z,
    },
  );
}

function clampX(value: number): number {
  return Math.max(
    FIELD_BOUNDS.minX + KICKOFF_FORMATION_CONFIG.fieldEdgeInset,
    Math.min(FIELD_BOUNDS.maxX - KICKOFF_FORMATION_CONFIG.fieldEdgeInset, value),
  );
}

function clampZ(value: number): number {
  return Math.max(FIELD_BOUNDS.minZ + 1, Math.min(FIELD_BOUNDS.maxZ - 1, value));
}

function isSpotInsideField(spot: FootballSpot): boolean {
  return boundsContainsSpot(FIELD_BOUNDS, spot);
}

function boundsContainsSpot(bounds: FieldBounds, spot: FootballSpot): boolean {
  return (
    spot.x >= bounds.minX &&
    spot.x <= bounds.maxX &&
    spot.z >= bounds.minZ &&
    spot.z <= bounds.maxZ
  );
}

function resolveFacing(direction: KickoffDirection): number {
  return direction > 0 ? 0 : Math.PI;
}

function invertDirection(direction: KickoffDirection): KickoffDirection {
  return direction > 0 ? -1 : 1;
}

function cloneSpot(spot: FootballSpot): FootballSpot {
  return { x: spot.x, z: spot.z };
}
