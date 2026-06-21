import { resolveSnapPlacement } from './ballSpotting';
import type { FootballSpot } from './fieldScale';
import {
  FORMATION_MEASUREMENTS,
  assertValidResolvedFormation,
  resolveFormation,
  resolveFormationTarget,
  type FormationSide,
  type FormationPoint,
  type FormationSlot,
  type LateralAnchor,
  type LongitudinalAnchor,
  type PreferredFormationSide,
  type PreSnapFacingDefinition,
} from './formationLayout';
import {
  PLAYER_MOVEMENT_CONFIG,
  createPlayerModel,
  type PlayerModel,
  type PlayerRole,
  type Vector2,
} from './playerModel';

export type PlayId = 'inside-run' | 'outside-run' | 'quick-pass' | 'slant-flat';
export type PlayKind = 'run' | 'pass';
export type FormationPlayer = FormationSlot;

export interface ReceiverRouteDefinition {
  speed: number;
  target: FormationPoint;
}

export interface PlayDefinition {
  ballCarrierRole: PlayerRole;
  blockerLaneTargets: Record<string, FormationPoint>;
  displayName: string;
  formation: FormationPlayer[];
  id: PlayId;
  initialMovementDirection: Vector2;
  kind: PlayKind;
  pass?: {
    coverageAssignments?: Record<string, string>;
    eligibleReceiverIds: string[];
    receiverDisplayNames?: Record<string, string>;
  };
  preferredSide: PreferredFormationSide;
  receiverRoutes?: Record<string, ReceiverRouteDefinition>;
}

export type RushingPlayDefinition = PlayDefinition;

const OFFENSE_PRE_SNAP_FACING: PreSnapFacingDefinition = { kind: 'playDirection' };
const DEFENSE_PRE_SNAP_FACING: PreSnapFacingDefinition = { kind: 'againstPlayDirection' };

export const PRE_SNAP_FACING_RADIANS = {
  againstPlayDirection: Math.PI,
  playDirection: 0,
} as const;

const {
  blockerSpacing,
  coverageCushion,
  defensiveLineDepth,
  interiorLaneDepth,
  interiorLaneSpacing,
  offensiveLineSetback,
  outsideLeadInset,
  outsideTrailInset,
  passProtectDepth,
  quarterbackDepth,
  receiverSidelineInset,
  runningBackDepth,
  safetyDepth,
} = FORMATION_MEASUREMENTS;

const PLAY_SIDE: PreferredFormationSide = 'right';

export const PLAYS: PlayDefinition[] = [
  {
    ballCarrierRole: 'runner',
    blockerLaneTargets: {
      'offense-blocker-left': point(snap(-interiorLaneSpacing), defenseDepth(interiorLaneDepth)),
      'offense-blocker-right': point(snap(interiorLaneSpacing), defenseDepth(interiorLaneDepth)),
    },
    displayName: 'Inside Run',
    formation: [
      quarterbackSlot(),
      runningBackSlot('runner'),
      blockerSlot('offense-blocker-left', -blockerSpacing),
      blockerSlot('offense-blocker-right', blockerSpacing),
      receiverSlot('offense-wr', fieldSideline()),
      rusherSlot('defense-rusher-left', 'offense-blocker-left'),
      rusherSlot('defense-rusher-right', 'offense-blocker-right'),
      defenderSlotAtDepth('defense-cover-wr', alignedTo('offense-wr'), coverageCushion),
      defenderSlotAtDepth('defense-cover-rb', alignedTo('offense-rb'), coverageCushion),
      defenderSlot('defense-safety', snap()),
    ],
    id: 'inside-run',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'run',
    preferredSide: PLAY_SIDE,
  },
  {
    ballCarrierRole: 'runner',
    blockerLaneTargets: {
      'offense-blocker-left': point(
        sidelineInset('field', outsideLeadInset),
        defenseDepth(interiorLaneDepth),
      ),
      'offense-blocker-right': point(
        sidelineInset('field', outsideTrailInset),
        defenseDepth(interiorLaneDepth - 2),
      ),
    },
    displayName: 'Outside Run',
    formation: [
      quarterbackSlot(),
      runningBackSlot('runner', snapSide('field', 2.5)),
      blockerSlot('offense-blocker-left', -blockerSpacing),
      blockerSlot('offense-blocker-right', blockerSpacing),
      receiverSlot('offense-wr', fieldSideline()),
      rusherSlot('defense-rusher-left', 'offense-blocker-left'),
      rusherSlot('defense-rusher-right', 'offense-blocker-right'),
      defenderSlotAtDepth('defense-cover-wr', alignedTo('offense-wr'), coverageCushion),
      defenderSlotAtDepth('defense-cover-rb', alignedTo('offense-rb'), coverageCushion),
      defenderSlot('defense-safety', snap()),
    ],
    id: 'outside-run',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'run',
    preferredSide: PLAY_SIDE,
  },
  {
    ballCarrierRole: 'quarterback',
    blockerLaneTargets: {
      'offense-blocker-left': point(snap(-blockerSpacing), defenseDepth(passProtectDepth)),
      'offense-blocker-right': point(snap(blockerSpacing), defenseDepth(passProtectDepth)),
      'offense-rb': point(snap(), defenseDepth(passProtectDepth)),
    },
    displayName: 'Quick Pass',
    formation: [
      quarterbackSlot(),
      runningBackSlot('blocker'),
      blockerSlot('offense-blocker-left', -blockerSpacing),
      blockerSlot('offense-blocker-right', blockerSpacing),
      receiverSlot('offense-wr', fieldSideline()),
      rusherSlot('defense-rusher-left', 'offense-blocker-left'),
      rusherSlot('defense-rusher-right', 'offense-blocker-right'),
      coverageSlot('defense-cover-wr', 'offense-wr'),
      coverageSlot('defense-cover-rb', 'offense-rb'),
      defenderSlot('defense-safety', midpointOf(['offense-wr'])),
    ],
    id: 'quick-pass',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'pass',
    pass: {
      coverageAssignments: {
        'defense-cover-rb': 'offense-rb',
        'defense-cover-wr': 'offense-wr',
      },
      eligibleReceiverIds: ['offense-wr'],
      receiverDisplayNames: {
        'offense-wr': 'Receiver',
      },
    },
    preferredSide: PLAY_SIDE,
    receiverRoutes: {
      'offense-wr': {
        speed: 9.5,
        target: point(fieldCenter(), defenseDepth(11)),
      },
    },
  },
  {
    ballCarrierRole: 'quarterback',
    blockerLaneTargets: {
      'offense-blocker-left': point(snap(-blockerSpacing), defenseDepth(passProtectDepth)),
      'offense-blocker-right': point(snap(blockerSpacing), defenseDepth(passProtectDepth)),
    },
    displayName: 'Slant Flat',
    formation: [
      quarterbackSlot(),
      runningBackSlot('receiver'),
      blockerSlot('offense-blocker-left', -blockerSpacing),
      blockerSlot('offense-blocker-right', blockerSpacing),
      receiverSlot('offense-wr', fieldSideline()),
      rusherSlot('defense-rusher-left', 'offense-blocker-left'),
      rusherSlot('defense-rusher-right', 'offense-blocker-right'),
      coverageSlot('defense-cover-wr', 'offense-wr'),
      coverageSlot('defense-cover-rb', 'offense-rb'),
      defenderSlot('defense-safety', midpointOf(['offense-wr', 'offense-rb'])),
    ],
    id: 'slant-flat',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'pass',
    pass: {
      coverageAssignments: {
        'defense-cover-rb': 'offense-rb',
        'defense-cover-wr': 'offense-wr',
      },
      eligibleReceiverIds: ['offense-wr', 'offense-rb'],
      receiverDisplayNames: {
        'offense-rb': 'Flat',
        'offense-wr': 'Slant',
      },
    },
    preferredSide: PLAY_SIDE,
    receiverRoutes: {
      'offense-rb': {
        speed: 8.5,
        target: point(sidelineInset('boundary', outsideTrailInset), defenseDepth(5)),
      },
      'offense-wr': {
        speed: 9.5,
        target: point(fieldCenter(), defenseDepth(11)),
      },
    },
  },
];

export const RUSHING_PLAYS = PLAYS.filter((play) => play.kind === 'run');

export const DEFAULT_PLAY_ID: PlayId = 'inside-run';

export function getPlay(playId: string): PlayDefinition {
  const play = PLAYS.find((candidate) => candidate.id === playId);

  if (!play) {
    throw new Error(`Unknown play ${playId}`);
  }

  return play;
}

export function getRushingPlay(playId: string): RushingPlayDefinition {
  return getPlay(playId);
}

export function createFormationPlayers(
  ballSpot: FootballSpot,
  play: PlayDefinition = getPlay(DEFAULT_PLAY_ID),
): PlayerModel[] {
  const formation = resolvePlayFormation(ballSpot, play);

  return formation.slots.map((slot) =>
    createPlayerModel(slot.position, {
      collisionRadius: PLAYER_MOVEMENT_CONFIG.collisionRadius,
      facingRadians: resolvePreSnapFacing(slot.preSnapFacing),
      id: slot.id,
      role: slot.role,
      state: 'idle',
      team: slot.team,
    }),
  );
}

export function resetFormationPlayers(
  players: PlayerModel[],
  ballSpot: FootballSpot,
  play: PlayDefinition,
): void {
  const formation = resolvePlayFormation(ballSpot, play);

  for (const slot of formation.slots) {
    const player = players.find((candidate) => candidate.id === slot.id);

    if (!player) {
      throw new Error(`Missing player ${slot.id} while resetting ${play.displayName}`);
    }

    player.position.x = slot.position.x;
    player.position.z = slot.position.z;
    player.velocity.x = 0;
    player.velocity.z = 0;
    player.collisionRadius = PLAYER_MOVEMENT_CONFIG.collisionRadius;
    player.facingRadians = resolvePreSnapFacing(slot.preSnapFacing);
    player.role = slot.role;
    player.team = slot.team;
    player.currentState = 'idle';
  }
}

export function getBlockingLaneTarget(
  blocker: PlayerModel,
  ballSpot: FootballSpot,
  play: PlayDefinition,
): FootballSpot {
  const slot = getFormationSlot(play, blocker.id);
  const laneTarget = play.blockerLaneTargets[blocker.id] ?? slot;

  return resolveFormationTarget(play, laneTarget, resolveSnapPlacement(ballSpot));
}

export function getFormationSlot(
  play: PlayDefinition,
  playerId: string,
): FormationPlayer {
  const slot = play.formation.find((formationSlot) => formationSlot.id === playerId);

  if (!slot) {
    throw new Error(`Unknown formation player ${playerId}`);
  }

  return slot;
}

export function resolvePreSnapFacing(facing: PreSnapFacingDefinition): number {
  return PRE_SNAP_FACING_RADIANS[facing.kind];
}

export function getReceiverRouteTarget(
  receiver: PlayerModel,
  ballSpot: FootballSpot,
  play: PlayDefinition,
): FootballSpot | null {
  const route = play.receiverRoutes?.[receiver.id];

  if (!route) {
    return null;
  }

  return resolveFormationTarget(play, route.target, resolveSnapPlacement(ballSpot));
}

export function getReceiverRouteSpeed(receiver: PlayerModel, play: PlayDefinition): number {
  return play.receiverRoutes?.[receiver.id]?.speed ?? 0;
}

export function hasReceiverRoute(playerId: string, play: PlayDefinition): boolean {
  return !!play.receiverRoutes?.[playerId];
}

export function getEligibleReceiverIds(play: PlayDefinition): string[] {
  return play.pass?.eligibleReceiverIds ?? [];
}

export function getDefaultEligibleReceiverId(play: PlayDefinition): string | null {
  return getEligibleReceiverIds(play)[0] ?? null;
}

export function getNextEligibleReceiverId(
  play: PlayDefinition,
  currentReceiverId: string | null,
): string | null {
  const receiverIds = getEligibleReceiverIds(play);

  if (receiverIds.length === 0) {
    return null;
  }

  const currentIndex = currentReceiverId ? receiverIds.indexOf(currentReceiverId) : -1;
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % receiverIds.length;

  return receiverIds[nextIndex];
}

export function isEligibleReceiverId(play: PlayDefinition, receiverId: string | null): boolean {
  return !!receiverId && getEligibleReceiverIds(play).includes(receiverId);
}

export function getReceiverDisplayName(play: PlayDefinition, receiverId: string): string {
  return play.pass?.receiverDisplayNames?.[receiverId] ?? receiverId;
}

export function getCoverageAssignmentReceiverId(
  play: PlayDefinition,
  defenderId: string,
): string | null {
  const receiverIds = getEligibleReceiverIds(play);
  const assignment = play.pass?.coverageAssignments?.[defenderId];

  if (assignment) {
    return assignment;
  }

  return receiverIds[0] ?? null;
}

function resolvePlayFormation(ballSpot: FootballSpot, play: PlayDefinition) {
  const formation = resolveFormation(play, resolveSnapPlacement(ballSpot));
  assertValidResolvedFormation(formation);

  return formation;
}

function quarterbackSlot(): FormationSlot {
  return offenseSlot('offense-qb', 'quarterback', point(snap(), offenseDepth(quarterbackDepth)));
}

function runningBackSlot(role: PlayerRole, lateral: LateralAnchor = snap()): FormationSlot {
  return offenseSlot('offense-rb', role, point(lateral, offenseDepth(runningBackDepth)));
}

function blockerSlot(id: 'offense-blocker-left' | 'offense-blocker-right', offsetYards: number): FormationSlot {
  return offenseSlot(id, 'blocker', point(snap(offsetYards), offenseDepth(offensiveLineSetback)));
}

function receiverSlot(id: 'offense-wr', lateral: LateralAnchor): FormationSlot {
  return offenseSlot(id, 'receiver', point(lateral, offenseDepth(offensiveLineSetback)));
}

function rusherSlot(
  id: 'defense-rusher-left' | 'defense-rusher-right',
  alignedPlayerId: string,
): FormationSlot {
  return defenseSlot(id, 'defender', point(alignedTo(alignedPlayerId), defenseDepth(defensiveLineDepth)));
}

function coverageSlot(
  id: 'defense-cover-rb' | 'defense-cover-wr',
  alignedPlayerId: string,
): FormationSlot {
  return defenseSlot(id, 'coverageDefender', point(alignedTo(alignedPlayerId), defenseDepth(coverageCushion)));
}

function defenderSlot(id: string, lateral: LateralAnchor): FormationSlot {
  return defenderSlotAtDepth(id, lateral, safetyDepth);
}

function defenderSlotAtDepth(id: string, lateral: LateralAnchor, depthYards: number): FormationSlot {
  return defenseSlot(id, 'defender', point(lateral, defenseDepth(depthYards)));
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

function fieldCenter(offsetYards = 0): LateralAnchor {
  return { kind: 'fieldCenter', offsetYards };
}

function fieldSideline(): LateralAnchor {
  return sidelineInset('field', receiverSidelineInset);
}

function sidelineInset(side: 'left' | 'right' | 'field' | 'boundary', insetYards: number): LateralAnchor {
  return { insetYards, kind: 'sidelineInset', side };
}

function alignedTo(playerId: string, offsetYards = 0): LateralAnchor {
  return { kind: 'alignedToPlayer', offsetYards, playerId };
}

function midpointOf(playerIds: string[], offsetYards = 0): LateralAnchor {
  return { kind: 'midpointOfPlayers', offsetYards, playerIds };
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
