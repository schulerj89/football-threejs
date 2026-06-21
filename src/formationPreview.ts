import { createBallModel, type BallModel } from './ballModel';
import {
  SNAP_LANE_X,
  type SnapLane,
  type SnapPlacement,
} from './ballSpotting';
import { DRIVE_CONFIG, type DriveSnapshot } from './driveModel';
import { INITIAL_BALL_SPOT, OPPOSING_GOAL_LINE_Z } from './field';
import { cloneFootballSpot, type FootballSpot } from './fieldScale';
import {
  assertValidResolvedFormation,
  resolveFormation,
  type FormationPlayDefinition,
  type FormationPoint,
  type FormationSlot,
  type LateralAnchor,
  type LongitudinalAnchor,
  type PreferredFormationSide,
  type ResolvedFormation,
} from './formationLayout';
import { createPlayerModel, snapshotPlayerModel, type PlayerModel, type PlayerRole } from './playerModel';
import { resolvePreSnapFacing } from './playbook';
import type { GameplaySnapshot } from './playState';
import {
  SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS,
  SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS,
  SEVEN_ON_SEVEN_PLAYER_IDS,
} from './roster';
import { SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS } from './sevenOnSevenFormation';

export type FormationPreviewMode = '7v7';

export interface FormationPreviewModel {
  ball: BallModel;
  formation: ResolvedFormation;
  mode: FormationPreviewMode;
  players: PlayerModel[];
  snapPlacement: SnapPlacement;
}

export interface FormationPreviewSnapshot {
  fieldSide: ResolvedFormation['fieldSide'];
  boundarySide: ResolvedFormation['boundarySide'];
  issues: ResolvedFormation['issues'];
  mode: FormationPreviewMode;
  players: ReturnType<typeof snapshotPlayerModel>[];
  snapLane: SnapLane;
  snapPlacement: SnapPlacement;
}

export {
  SEVEN_ON_SEVEN_DEFENSE_PLAYER_IDS,
  SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS,
  SEVEN_ON_SEVEN_OFFENSE_PLAYER_IDS,
  SEVEN_ON_SEVEN_PLAYER_IDS,
};

const PLAY_SIDE: PreferredFormationSide = 'right';
const OFFENSE_PRE_SNAP_FACING = { kind: 'playDirection' } as const;
const DEFENSE_PRE_SNAP_FACING = { kind: 'againstPlayDirection' } as const;

export const SEVEN_ON_SEVEN_PREVIEW_FORMATION: FormationPlayDefinition = {
  formation: [
    offenseSlot('offense-center', 'blocker', point(snap(), offenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSetback))),
    offenseSlot('offense-line-left', 'blocker', point(snap(-SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSpacing), offenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSetback))),
    offenseSlot('offense-line-right', 'blocker', point(snap(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSpacing), offenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSetback))),
    offenseSlot('offense-qb', 'quarterback', point(snap(), offenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.quarterbackDepth))),
    offenseSlot('offense-rb', 'runner', point(runningBackFieldSide(), offenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.runningBackDepth))),
    offenseSlot('offense-wr-left', 'receiver', point(sidelineInset('left', SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset), offenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSetback))),
    offenseSlot('offense-wr-right', 'receiver', point(sidelineInset('right', SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset), offenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSetback))),
    defenseSlot('defense-line-left', 'defender', point(snap(-SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineGap), defenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineDepth))),
    defenseSlot('defense-line-middle', 'defender', point(snap(), defenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineDepth))),
    defenseSlot('defense-line-right', 'defender', point(snap(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineGap), defenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineDepth))),
    defenseSlot('defense-corner-left', 'coverageDefender', point(alignedTo('offense-wr-left'), defenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.cornerCushion))),
    defenseSlot('defense-corner-right', 'coverageDefender', point(alignedTo('offense-wr-right'), defenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.cornerCushion))),
    defenseSlot('defense-linebacker', 'defender', point(midpointOf(['offense-line-left', 'offense-center', 'offense-line-right']), defenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.linebackerDepth))),
    defenseSlot('defense-safety', 'defender', point(midpointOf(['offense-wr-left', 'offense-wr-right']), defenseDepth(SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.safetyDepth))),
  ],
  pass: {
    coverageAssignments: {
      'defense-corner-left': 'offense-wr-left',
      'defense-corner-right': 'offense-wr-right',
    },
    eligibleReceiverIds: ['offense-wr-left', 'offense-wr-right'],
  },
  preferredSide: PLAY_SIDE,
  validation: {
    coverageAlignmentToleranceYards: 0.001,
    defensiveGapOffsets: {
      'defense-line-left': -SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineGap,
      'defense-line-middle': 0,
      'defense-line-right': SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineGap,
    },
    expectedDefenseCount: 7,
    expectedOffenseCount: 7,
    offensiveLineIds: ['offense-line-left', 'offense-center', 'offense-line-right'],
    receiverSidelineInsetYards: {
      'offense-wr-left': SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset,
      'offense-wr-right': SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset,
    },
    stablePlayerIds: SEVEN_ON_SEVEN_PLAYER_IDS,
  },
};

export function resolveFormationPreviewMode(value: string | null): FormationPreviewMode | null {
  return value === '7v7' ? '7v7' : null;
}

export function createFormationPreviewModel(
  mode: FormationPreviewMode = '7v7',
  lane: SnapLane = 'middle',
  spot: FootballSpot = INITIAL_BALL_SPOT,
): FormationPreviewModel {
  const snapPlacement = createSnapPlacementForLane(lane, spot.z);
  const formation = resolveSevenOnSevenPreviewFormation(snapPlacement);
  const players = createPlayersFromFormation(formation);
  const ball = createBallModel(snapPlacement.spot);

  return {
    ball,
    formation,
    mode,
    players,
    snapPlacement,
  };
}

export function setFormationPreviewSnapLane(
  preview: FormationPreviewModel,
  lane: SnapLane,
): void {
  const snapPlacement = createSnapPlacementForLane(lane, preview.snapPlacement.spot.z);
  const formation = resolveSevenOnSevenPreviewFormation(snapPlacement);

  preview.snapPlacement = snapPlacement;
  preview.formation = formation;
  resetPreviewPlayers(preview.players, formation);
  preview.ball.position.x = snapPlacement.spot.x;
  preview.ball.position.z = snapPlacement.spot.z;
}

export function snapshotFormationPreviewModel(
  preview: FormationPreviewModel,
): FormationPreviewSnapshot {
  return {
    boundarySide: preview.formation.boundarySide,
    fieldSide: preview.formation.fieldSide,
    issues: preview.formation.issues.map((issue) => ({
      message: issue.message,
      playerIds: [...issue.playerIds],
    })),
    mode: preview.mode,
    players: preview.players.map(snapshotPlayerModel),
    snapLane: preview.snapPlacement.lane,
    snapPlacement: cloneSnapPlacement(preview.snapPlacement),
  };
}

export function snapshotFormationPreviewAsGameplay(
  preview: FormationPreviewModel,
): GameplaySnapshot {
  const lineOfScrimmage = cloneFootballSpot(preview.snapPlacement.spot);
  const firstDownMarker = {
    x: 0,
    z: Math.min(OPPOSING_GOAL_LINE_Z, lineOfScrimmage.z + DRIVE_CONFIG.firstDownYards),
  };
  const primaryPlayer = getPreviewPrimaryPlayer(preview.players);
  const drive: DriveSnapshot = {
    currentDown: 1,
    firstDownMarker,
    lastDriveResult: null,
    lineOfScrimmage,
    snapLane: preview.snapPlacement.lane,
    state: 'active',
    yardsToFirstDown: DRIVE_CONFIG.firstDownYards,
  };

  return {
    activePlayStartSpot: null,
    ball: {
      possession: { kind: 'none' },
      position: { ...preview.ball.position },
      state: { kind: 'dead' },
    },
    blocking: {
      engagements: [],
    },
    currentBallSpot: cloneFootballSpot(lineOfScrimmage),
    drive,
    exactDeadBallSpot: null,
    formationOrigin: cloneFootballSpot(lineOfScrimmage),
    forwardPassEligible: true,
    lastPlayResult: null,
    nextBallSpot: cloneFootballSpot(lineOfScrimmage),
    nextSnapSpot: cloneFootballSpot(lineOfScrimmage),
    passAttempted: false,
    passFeedback: null,
    player: snapshotPlayerModel(primaryPlayer),
    players: preview.players.map(snapshotPlayerModel),
    playbookId: '7v7',
    receiverRouteStates: [],
    playState: 'preSnap',
    score: 0,
    scoreAttack: {
      durationSeconds: 120,
      finalScore: null,
      remainingSeconds: 120,
      state: 'ready',
    },
    selectedPlay: {
      displayName: '7v7 Formation Preview',
      id: 'inside-run',
      initialMovementDirection: { x: 0, z: 1 },
      kind: 'run',
    },
    selectedReceiver: null,
    snapLane: preview.snapPlacement.lane,
  };
}

export function resolveSevenOnSevenPreviewFormation(
  snapPlacement: SnapPlacement,
): ResolvedFormation {
  const formation = resolveFormation(SEVEN_ON_SEVEN_PREVIEW_FORMATION, snapPlacement);
  assertValidResolvedFormation(formation);
  return formation;
}

export function createSnapPlacementForLane(lane: SnapLane, z: number = INITIAL_BALL_SPOT.z): SnapPlacement {
  return {
    lane,
    spot: {
      x: SNAP_LANE_X[lane],
      z,
    },
  };
}

function createPlayersFromFormation(formation: ResolvedFormation): PlayerModel[] {
  return formation.slots.map((slot) =>
    createPlayerModel(slot.position, {
      facingRadians: resolvePreSnapFacing(slot.preSnapFacing),
      id: slot.id,
      role: slot.role,
      state: 'idle',
      team: slot.team,
    }),
  );
}

function resetPreviewPlayers(players: PlayerModel[], formation: ResolvedFormation): void {
  for (const slot of formation.slots) {
    const player = players.find((candidate) => candidate.id === slot.id);

    if (!player) {
      throw new Error(`Missing preview player ${slot.id}`);
    }

    player.position.x = slot.position.x;
    player.position.z = slot.position.z;
    player.velocity.x = 0;
    player.velocity.z = 0;
    player.facingRadians = resolvePreSnapFacing(slot.preSnapFacing);
    player.currentState = 'idle';
    player.role = slot.role;
    player.team = slot.team;
  }
}

function getPreviewPrimaryPlayer(players: PlayerModel[]): PlayerModel {
  const quarterback = players.find((player) => player.id === 'offense-qb');

  if (!quarterback) {
    throw new Error('Missing offense-qb in 7v7 preview');
  }

  return quarterback;
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

function runningBackFieldSide(): LateralAnchor {
  return {
    distanceYards: SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.runningBackFieldOffset,
    kind: 'snapSide',
    side: 'field',
  };
}

function sidelineInset(side: 'left' | 'right' | 'field' | 'boundary', insetYards: number): LateralAnchor {
  return { insetYards, kind: 'sidelineInset', side };
}

function alignedTo(playerId: string): LateralAnchor {
  return { kind: 'alignedToPlayer', offsetYards: 0, playerId };
}

function midpointOf(playerIds: string[]): LateralAnchor {
  return { kind: 'midpointOfPlayers', offsetYards: 0, playerIds };
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

function cloneSnapPlacement(placement: SnapPlacement): SnapPlacement {
  return {
    lane: placement.lane,
    spot: cloneFootballSpot(placement.spot),
  };
}
