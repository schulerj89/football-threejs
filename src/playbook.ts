import { resolveSnapPlacement } from './ballSpotting';
import { FIELD_BOUNDS } from './fieldSpec';
import type { FootballSpot } from './fieldScale';
import {
  DEFAULT_FORMATION_FIELD_SPEC,
  FORMATION_MEASUREMENTS,
  assertValidResolvedFormation,
  resolveFormation,
  resolveFormationTarget,
  type FormationFieldSpec,
  type FormationSide,
  type FormationPoint,
  type FormationSlot,
  type LateralAnchor,
  type LongitudinalAnchor,
  type PreferredFormationSide,
  type PreSnapFacingDefinition,
} from './formationLayout';
import {
  ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS,
  ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS,
  createElevenOnElevenPreviewFormation,
} from './elevenOnElevenFormation';
import {
  PLAYER_MOVEMENT_CONFIG,
  createPlayerModel,
  type PlayerModel,
  type PlayerRole,
  type Vector2,
} from './playerModel';
import {
  getRouteFinalPoint,
  resolveReceiverRoute,
  type ReceiverRouteDefinition,
  type RouteWaypointDefinition,
} from './receiverRoutes';
import {
  FIVE_ON_FIVE_ROSTER,
  ELEVEN_ON_ELEVEN_PLAYER_IDS,
  ELEVEN_ON_ELEVEN_ROSTER,
  SEVEN_ON_SEVEN_PLAYER_IDS,
  SEVEN_ON_SEVEN_ROSTER,
  type PlaybookId,
  type RosterContract,
} from './roster';
import { SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS } from './sevenOnSevenFormation';

export type PlayId =
  | 'inside-run'
  | 'inside-zone-11'
  | 'inside-zone-7'
  | 'outside-run'
  | 'outside-zone-7'
  | 'quick-pass'
  | 'quick-pass-7'
  | 'slant-flat'
  | 'spread-quick-11'
  | 'twin-slants-flat';
export type PlayKind = 'run' | 'pass';
export type FormationPlayer = FormationSlot;

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
    deepHelpAssignments?: Record<string, string[]>;
    eligibleReceiverIds: string[];
    receiverDisplayNames?: Record<string, string>;
  };
  playbookId: PlaybookId;
  preferredSide: PreferredFormationSide;
  protectionAssignments?: Record<string, string>;
  receiverRoutes?: Record<string, ReceiverRouteDefinition>;
  roster: RosterContract;
  validation?: Parameters<typeof resolveFormation>[0]['validation'];
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

const SEVEN = SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS;
const ELEVEN = ELEVEN_ON_ELEVEN_FORMATION_MEASUREMENTS;
const PLAY_SIDE: PreferredFormationSide = 'right';
const RUNTIME_FORMATION_FIELD_SPEC: FormationFieldSpec = {
  ...DEFAULT_FORMATION_FIELD_SPEC,
  clampLongitudinalToBounds: true,
  playableBounds: FIELD_BOUNDS,
};
const SPREAD_QUICK_ELEVEN_RECEIVER_IDS = [
  'offense-wr-left',
  'offense-wr-right',
  'offense-slot',
  'offense-tight-end',
  'offense-rb',
] as const;

export const FIVE_ON_FIVE_PLAYS: PlayDefinition[] = [
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
    playbookId: '5v5',
    preferredSide: PLAY_SIDE,
    roster: FIVE_ON_FIVE_ROSTER,
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
    playbookId: '5v5',
    preferredSide: PLAY_SIDE,
    roster: FIVE_ON_FIVE_ROSTER,
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
    playbookId: '5v5',
    preferredSide: PLAY_SIDE,
    receiverRoutes: {
      'offense-wr': route('quick-pass-receiver', 9.5, [
        waypoint('stem', point(alignedTo('offense-wr'), defenseDepth(4))),
        waypoint('break', point(fieldCenter(), defenseDepth(11))),
      ]),
    },
    roster: FIVE_ON_FIVE_ROSTER,
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
    playbookId: '5v5',
    preferredSide: PLAY_SIDE,
    receiverRoutes: {
      'offense-rb': route('flat', 8.5, [
        waypoint('backfield-release', point(snapSide('boundary', 4), offenseDepth(3.5))),
        waypoint('out', point(sidelineInset('boundary', outsideTrailInset), defenseDepth(5))),
      ]),
      'offense-wr': route('slant', 9.5, [
        waypoint('stem', point(alignedTo('offense-wr'), defenseDepth(4))),
        waypoint('break', point(fieldCenter(), defenseDepth(11))),
      ]),
    },
    roster: FIVE_ON_FIVE_ROSTER,
  },
];

export const SEVEN_ON_SEVEN_PLAYS: PlayDefinition[] = [
  {
    ballCarrierRole: 'runner',
    blockerLaneTargets: {
      'offense-center': point(alignedTo('defense-line-middle'), defenseDepth(interiorLaneDepth)),
      'offense-line-left': point(alignedTo('defense-line-left'), defenseDepth(interiorLaneDepth)),
      'offense-line-right': point(alignedTo('defense-line-right'), defenseDepth(interiorLaneDepth)),
      'offense-wr-left': point(alignedTo('defense-corner-left'), defenseDepth(SEVEN.cornerCushion)),
      'offense-wr-right': point(alignedTo('defense-corner-right'), defenseDepth(SEVEN.cornerCushion)),
    },
    displayName: 'Inside Zone 7',
    formation: [
      sevenOffenseSlot('offense-center', 'blocker', point(snap(), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-line-left', 'blocker', point(snap(-SEVEN.offensiveLineSpacing), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-line-right', 'blocker', point(snap(SEVEN.offensiveLineSpacing), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-qb', 'quarterback', point(snap(), offenseDepth(SEVEN.quarterbackDepth))),
      sevenOffenseSlot('offense-rb', 'runner', point(snap(), offenseDepth(SEVEN.runningBackDepth))),
      sevenOffenseSlot('offense-wr-left', 'blocker', point(sidelineInset('left', SEVEN.receiverSidelineInset), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-wr-right', 'blocker', point(sidelineInset('right', SEVEN.receiverSidelineInset), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenDefenseSlot('defense-line-left', 'defender', point(snap(-SEVEN.defensiveLineGap), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-line-middle', 'defender', point(snap(), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-line-right', 'defender', point(snap(SEVEN.defensiveLineGap), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-corner-left', 'defender', point(alignedTo('offense-wr-left'), defenseDepth(SEVEN.cornerCushion))),
      sevenDefenseSlot('defense-corner-right', 'defender', point(alignedTo('offense-wr-right'), defenseDepth(SEVEN.cornerCushion))),
      sevenDefenseSlot('defense-linebacker', 'defender', point(snap(), defenseDepth(SEVEN.linebackerDepth))),
      sevenDefenseSlot('defense-safety', 'defender', point(midpointOf(['offense-wr-left', 'offense-wr-right']), defenseDepth(SEVEN.safetyDepth))),
    ],
    id: 'inside-zone-7',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'run',
    playbookId: '7v7',
    preferredSide: PLAY_SIDE,
    protectionAssignments: {
      'offense-center': 'defense-line-middle',
      'offense-line-left': 'defense-line-left',
      'offense-line-right': 'defense-line-right',
      'offense-wr-left': 'defense-corner-left',
      'offense-wr-right': 'defense-corner-right',
    },
    roster: SEVEN_ON_SEVEN_ROSTER,
    validation: sevenOnSevenValidation(),
  },
  {
    ballCarrierRole: 'runner',
    blockerLaneTargets: {
      'offense-center': point(snapSide('field', 2.5), defenseDepth(interiorLaneDepth)),
      'offense-line-left': point(snapSide('field', 5.5), defenseDepth(interiorLaneDepth)),
      'offense-line-right': point(snapSide('field', 8.5), defenseDepth(interiorLaneDepth - 1.5)),
      'offense-wr-left': point(alignedTo('defense-corner-left'), defenseDepth(SEVEN.cornerCushion)),
      'offense-wr-right': point(alignedTo('defense-corner-right'), defenseDepth(SEVEN.cornerCushion)),
    },
    displayName: 'Outside Zone 7',
    formation: [
      sevenOffenseSlot('offense-center', 'blocker', point(snap(), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-line-left', 'blocker', point(snap(-SEVEN.offensiveLineSpacing), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-line-right', 'blocker', point(snap(SEVEN.offensiveLineSpacing), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-qb', 'quarterback', point(snap(), offenseDepth(SEVEN.quarterbackDepth))),
      sevenOffenseSlot('offense-rb', 'runner', point(runningBackFieldSide(), offenseDepth(SEVEN.runningBackDepth))),
      sevenOffenseSlot('offense-wr-left', 'blocker', point(sidelineInset('left', SEVEN.receiverSidelineInset), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-wr-right', 'blocker', point(sidelineInset('right', SEVEN.receiverSidelineInset), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenDefenseSlot('defense-line-left', 'defender', point(snap(-SEVEN.defensiveLineGap), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-line-middle', 'defender', point(snap(), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-line-right', 'defender', point(snap(SEVEN.defensiveLineGap), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-corner-left', 'defender', point(alignedTo('offense-wr-left'), defenseDepth(SEVEN.cornerCushion))),
      sevenDefenseSlot('defense-corner-right', 'defender', point(alignedTo('offense-wr-right'), defenseDepth(SEVEN.cornerCushion))),
      sevenDefenseSlot('defense-linebacker', 'defender', point(snap(), defenseDepth(SEVEN.linebackerDepth))),
      sevenDefenseSlot('defense-safety', 'defender', point(midpointOf(['offense-wr-left', 'offense-wr-right']), defenseDepth(SEVEN.safetyDepth))),
    ],
    id: 'outside-zone-7',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'run',
    playbookId: '7v7',
    preferredSide: PLAY_SIDE,
    protectionAssignments: {
      'offense-center': 'defense-line-middle',
      'offense-line-left': 'defense-line-left',
      'offense-line-right': 'defense-line-right',
      'offense-wr-left': 'defense-corner-left',
      'offense-wr-right': 'defense-corner-right',
    },
    roster: SEVEN_ON_SEVEN_ROSTER,
    validation: sevenOnSevenValidation(),
  },
  {
    ballCarrierRole: 'quarterback',
    blockerLaneTargets: {
      'offense-center': point(alignedTo('defense-line-middle'), defenseDepth(passProtectDepth)),
      'offense-line-left': point(alignedTo('defense-line-left'), defenseDepth(passProtectDepth)),
      'offense-line-right': point(alignedTo('defense-line-right'), defenseDepth(passProtectDepth)),
    },
    displayName: 'Quick Pass 7',
    formation: [
      sevenOffenseSlot('offense-center', 'blocker', point(snap(), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-line-left', 'blocker', point(snap(-SEVEN.offensiveLineSpacing), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-line-right', 'blocker', point(snap(SEVEN.offensiveLineSpacing), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-qb', 'quarterback', point(snap(), offenseDepth(SEVEN.quarterbackDepth))),
      sevenOffenseSlot('offense-rb', 'receiver', point(runningBackFieldSide(), offenseDepth(SEVEN.runningBackDepth))),
      sevenOffenseSlot('offense-wr-left', 'receiver', point(sidelineInset('left', SEVEN.receiverSidelineInset), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-wr-right', 'receiver', point(sidelineInset('right', SEVEN.receiverSidelineInset), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenDefenseSlot('defense-line-left', 'defender', point(snap(-SEVEN.defensiveLineGap), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-line-middle', 'defender', point(snap(), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-line-right', 'defender', point(snap(SEVEN.defensiveLineGap), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-corner-left', 'coverageDefender', point(alignedTo('offense-wr-left'), defenseDepth(SEVEN.cornerCushion))),
      sevenDefenseSlot('defense-corner-right', 'coverageDefender', point(alignedTo('offense-wr-right'), defenseDepth(SEVEN.cornerCushion))),
      sevenDefenseSlot('defense-linebacker', 'coverageDefender', point(alignedTo('offense-rb'), defenseDepth(SEVEN.linebackerDepth))),
      sevenDefenseSlot('defense-safety', 'coverageDefender', point(midpointOf(['offense-wr-left', 'offense-wr-right']), defenseDepth(SEVEN.safetyDepth))),
    ],
    id: 'quick-pass-7',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'pass',
    pass: {
      coverageAssignments: {
        'defense-corner-left': 'offense-wr-left',
        'defense-corner-right': 'offense-wr-right',
        'defense-linebacker': 'offense-rb',
      },
      deepHelpAssignments: {
        'defense-safety': ['offense-wr-left', 'offense-wr-right'],
      },
      eligibleReceiverIds: ['offense-wr-left', 'offense-wr-right', 'offense-rb'],
      receiverDisplayNames: {
        'offense-rb': 'Running Back',
        'offense-wr-left': 'Receiver Left',
        'offense-wr-right': 'Receiver Right',
      },
    },
    playbookId: '7v7',
    preferredSide: PLAY_SIDE,
    protectionAssignments: {
      'offense-center': 'defense-line-middle',
      'offense-line-left': 'defense-line-left',
      'offense-line-right': 'defense-line-right',
    },
    receiverRoutes: {
      'offense-rb': route('quick-pass-7-checkdown', 8, [
        waypoint('release', point(snapSide('boundary', 3), offenseDepth(1.5))),
        waypoint('checkdown', point(sidelineInset('boundary', SEVEN.receiverSidelineInset + 6), defenseDepth(2.5))),
      ]),
      'offense-wr-left': route('quick-pass-7-left-out', 9, [
        waypoint('stem', point(alignedTo('offense-wr-left'), defenseDepth(4.5))),
        waypoint('out', point(sidelineInset('left', SEVEN.receiverSidelineInset - 1.5), defenseDepth(6.5))),
      ]),
      'offense-wr-right': route('quick-pass-7-right-slant', 9.25, [
        waypoint('clear-stem', point(alignedTo('offense-wr-right'), defenseDepth(5.5))),
        waypoint('short-slant', point(fieldCenter(7), defenseDepth(9.5))),
      ]),
    },
    roster: SEVEN_ON_SEVEN_ROSTER,
    validation: sevenOnSevenValidation(),
  },
  {
    ballCarrierRole: 'quarterback',
    blockerLaneTargets: {
      'offense-center': point(alignedTo('defense-line-middle'), defenseDepth(passProtectDepth)),
      'offense-line-left': point(alignedTo('defense-line-left'), defenseDepth(passProtectDepth)),
      'offense-line-right': point(alignedTo('defense-line-right'), defenseDepth(passProtectDepth)),
    },
    displayName: 'Twin Slants Flat',
    formation: [
      sevenOffenseSlot('offense-center', 'blocker', point(snap(), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-line-left', 'blocker', point(snap(-SEVEN.offensiveLineSpacing), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-line-right', 'blocker', point(snap(SEVEN.offensiveLineSpacing), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-qb', 'quarterback', point(snap(), offenseDepth(SEVEN.quarterbackDepth))),
      sevenOffenseSlot('offense-rb', 'receiver', point(runningBackFieldSide(), offenseDepth(SEVEN.runningBackDepth))),
      sevenOffenseSlot('offense-wr-left', 'receiver', point(sidelineInset('left', SEVEN.receiverSidelineInset), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenOffenseSlot('offense-wr-right', 'receiver', point(sidelineInset('right', SEVEN.receiverSidelineInset), offenseDepth(SEVEN.offensiveLineSetback))),
      sevenDefenseSlot('defense-line-left', 'defender', point(snap(-SEVEN.defensiveLineGap), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-line-middle', 'defender', point(snap(), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-line-right', 'defender', point(snap(SEVEN.defensiveLineGap), defenseDepth(SEVEN.defensiveLineDepth))),
      sevenDefenseSlot('defense-corner-left', 'coverageDefender', point(alignedTo('offense-wr-left'), defenseDepth(SEVEN.cornerCushion))),
      sevenDefenseSlot('defense-corner-right', 'coverageDefender', point(alignedTo('offense-wr-right'), defenseDepth(SEVEN.cornerCushion))),
      sevenDefenseSlot('defense-linebacker', 'coverageDefender', point(alignedTo('offense-rb'), defenseDepth(SEVEN.linebackerDepth))),
      sevenDefenseSlot('defense-safety', 'coverageDefender', point(midpointOf(['offense-wr-left', 'offense-wr-right']), defenseDepth(SEVEN.safetyDepth))),
    ],
    id: 'twin-slants-flat',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'pass',
    pass: {
      coverageAssignments: {
        'defense-corner-left': 'offense-wr-left',
        'defense-corner-right': 'offense-wr-right',
        'defense-linebacker': 'offense-rb',
      },
      deepHelpAssignments: {
        'defense-safety': ['offense-wr-left', 'offense-wr-right'],
      },
      eligibleReceiverIds: ['offense-wr-left', 'offense-wr-right', 'offense-rb'],
      receiverDisplayNames: {
        'offense-rb': 'Running Back',
        'offense-wr-left': 'Receiver Left',
        'offense-wr-right': 'Receiver Right',
      },
    },
    playbookId: '7v7',
    preferredSide: PLAY_SIDE,
    protectionAssignments: {
      'offense-center': 'defense-line-middle',
      'offense-line-left': 'defense-line-left',
      'offense-line-right': 'defense-line-right',
    },
    receiverRoutes: {
      'offense-rb': route('twin-slants-flat-rb', 8.5, [
        waypoint('flat', point(sidelineInset('field', SEVEN.receiverSidelineInset + 3), defenseDepth(4.5))),
      ]),
      'offense-wr-left': route('twin-slants-left', 9.5, [
        waypoint('slant', slantTarget('left')),
      ]),
      'offense-wr-right': route('twin-slants-right', 9.5, [
        waypoint('slant', slantTarget('right')),
      ]),
    },
    roster: SEVEN_ON_SEVEN_ROSTER,
    validation: sevenOnSevenValidation(),
  },
];

export const ELEVEN_ON_ELEVEN_PLAYS: PlayDefinition[] = [
  {
    ballCarrierRole: 'runner',
    blockerLaneTargets: {
      'offense-center': point(alignedTo('defense-line-middle'), defenseDepth(interiorLaneDepth)),
      'offense-line-left': point(alignedTo('defense-line-left'), defenseDepth(interiorLaneDepth)),
      'offense-line-right': point(alignedTo('defense-line-right'), defenseDepth(interiorLaneDepth)),
      'offense-slot': point(alignedTo('defense-linebacker'), defenseDepth(ELEVEN.linebackerDepth)),
      'offense-tackle-left': point(alignedTo('defense-linebacker-left'), defenseDepth(ELEVEN.linebackerDepth)),
      'offense-tackle-right': point(alignedTo('defense-linebacker-right'), defenseDepth(ELEVEN.linebackerDepth)),
      'offense-tight-end': point(alignedTo('defense-linebacker-inside'), defenseDepth(ELEVEN.linebackerDepth)),
      'offense-wr-left': point(alignedTo('defense-corner-left'), defenseDepth(ELEVEN.cornerCushion)),
      'offense-wr-right': point(alignedTo('defense-corner-right'), defenseDepth(ELEVEN.cornerCushion)),
    },
    displayName: 'Inside Zone 11',
    formation: createElevenOnElevenRunFormation(),
    id: 'inside-zone-11',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'run',
    playbookId: '11v11',
    preferredSide: PLAY_SIDE,
    protectionAssignments: {
      'offense-center': 'defense-line-middle',
      'offense-line-left': 'defense-line-left',
      'offense-line-right': 'defense-line-right',
      'offense-slot': 'defense-linebacker',
      'offense-tackle-left': 'defense-linebacker-left',
      'offense-tackle-right': 'defense-linebacker-right',
      'offense-tight-end': 'defense-linebacker-inside',
      'offense-wr-left': 'defense-corner-left',
      'offense-wr-right': 'defense-corner-right',
    },
    roster: ELEVEN_ON_ELEVEN_ROSTER,
    validation: elevenOnElevenValidation(),
  },
  {
    ballCarrierRole: 'quarterback',
    blockerLaneTargets: {
      'offense-center': point(alignedTo('defense-line-middle'), defenseDepth(passProtectDepth)),
      'offense-line-left': point(alignedTo('defense-line-left'), defenseDepth(passProtectDepth)),
      'offense-line-right': point(alignedTo('defense-line-right'), defenseDepth(passProtectDepth)),
      'offense-tackle-left': point(alignedTo('defense-linebacker-left'), defenseDepth(ELEVEN.linebackerDepth)),
      'offense-tackle-right': point(alignedTo('defense-linebacker-right'), defenseDepth(ELEVEN.linebackerDepth)),
    },
    displayName: 'Spread Quick 11',
    formation: createElevenOnElevenPassFormation(),
    id: 'spread-quick-11',
    initialMovementDirection: { x: 0, z: 1 },
    kind: 'pass',
    pass: {
      coverageAssignments: {
        'defense-corner-left': 'offense-wr-left',
        'defense-corner-right': 'offense-wr-right',
        'defense-linebacker': 'offense-rb',
        'defense-linebacker-inside': 'offense-tight-end',
        'defense-safety-strong': 'offense-slot',
      },
      deepHelpAssignments: {
        'defense-safety': [...SPREAD_QUICK_ELEVEN_RECEIVER_IDS],
      },
      eligibleReceiverIds: [...SPREAD_QUICK_ELEVEN_RECEIVER_IDS],
      receiverDisplayNames: {
        'offense-rb': 'Running Back',
        'offense-slot': 'Slot',
        'offense-tight-end': 'Tight End',
        'offense-wr-left': 'Receiver Left',
        'offense-wr-right': 'Receiver Right',
      },
    },
    playbookId: '11v11',
    preferredSide: PLAY_SIDE,
    protectionAssignments: {
      'offense-center': 'defense-line-middle',
      'offense-line-left': 'defense-line-left',
      'offense-line-right': 'defense-line-right',
      'offense-tackle-left': 'defense-linebacker-left',
      'offense-tackle-right': 'defense-linebacker-right',
    },
    receiverRoutes: {
      'offense-rb': route('spread-quick-11-rb-check-flat', 8, [
        waypoint('check-release', point(snapSide('boundary', 3.5), offenseDepth(1.5))),
        waypoint('opposite-flat', point(sidelineInset('boundary', ELEVEN.receiverSidelineInset + 5), defenseDepth(3.5))),
      ]),
      'offense-slot': route('spread-quick-11-slot-seam-settle', 9.25, [
        waypoint('seam', point(alignedTo('offense-slot'), defenseDepth(7))),
        waypoint('settle', point(snapSide('field', ELEVEN.slotAlignment - 2), defenseDepth(9.5))),
      ]),
      'offense-tight-end': route('spread-quick-11-tight-end-flat', 8.5, [
        waypoint('flat-release', point(snapSide('field', ELEVEN.tightEndSpacing + 2), defenseDepth(2.5))),
        waypoint('field-flat', point(sidelineInset('field', ELEVEN.receiverSidelineInset + 6), defenseDepth(4.5))),
      ]),
      'offense-wr-left': route('spread-quick-11-left-slant', 9.5, [
        waypoint('stem', point(alignedTo('offense-wr-left'), defenseDepth(4.5))),
        waypoint('slant', point(snapSide('field', 4), defenseDepth(10.5))),
      ]),
      'offense-wr-right': route('spread-quick-11-right-hitch', 8.75, [
        waypoint('stem', point(alignedTo('offense-wr-right'), defenseDepth(5.5))),
        waypoint('hitch', point(alignedTo('offense-wr-right'), defenseDepth(7.5))),
      ]),
    },
    roster: ELEVEN_ON_ELEVEN_ROSTER,
    validation: elevenOnElevenValidation(),
  },
];

export const PLAYS = SEVEN_ON_SEVEN_PLAYS;
export const ALL_PLAYS = [
  ...FIVE_ON_FIVE_PLAYS,
  ...SEVEN_ON_SEVEN_PLAYS,
  ...ELEVEN_ON_ELEVEN_PLAYS,
] as const;
export const RUSHING_PLAYS = ALL_PLAYS.filter((play) => play.kind === 'run');

export const DEFAULT_PLAY_ID: PlayId = 'inside-run';
export const DEFAULT_SEVEN_ON_SEVEN_PLAY_ID: PlayId = 'inside-zone-7';
export const DEFAULT_ELEVEN_ON_ELEVEN_PLAY_ID: PlayId = 'inside-zone-11';

export interface PlaybookOption {
  description: string;
  displayName: string;
  id: PlaybookId;
}

export const PLAYBOOK_OPTIONS: readonly PlaybookOption[] = [
  {
    description: 'Normal low-poly 11v11 prototype',
    displayName: '11v11 Prototype',
    id: '11v11',
  },
  {
    description: 'Development regression mode',
    displayName: '7v7 Development Regression Mode',
    id: '7v7',
  },
  {
    description: 'Legacy regression mode',
    displayName: '5v5 Legacy Regression Mode',
    id: '5v5',
  },
] as const;

export function getPlaybookOptions(): PlaybookOption[] {
  return PLAYBOOK_OPTIONS.map((option) => ({ ...option }));
}

export function resolvePlaybookId(value: string | null): PlaybookId {
  if (value === '5v5' || value === '7v7' || value === '11v11') {
    return value;
  }

  return '11v11';
}

export function getAvailablePlays(playbookId: PlaybookId = '11v11'): PlayDefinition[] {
  if (playbookId === '11v11') {
    return [...ELEVEN_ON_ELEVEN_PLAYS];
  }

  return playbookId === '7v7' ? [...SEVEN_ON_SEVEN_PLAYS] : [...FIVE_ON_FIVE_PLAYS];
}

export function getDefaultPlayId(playbookId: PlaybookId = '11v11'): PlayId {
  if (playbookId === '11v11') {
    return DEFAULT_ELEVEN_ON_ELEVEN_PLAY_ID;
  }

  return playbookId === '7v7' ? DEFAULT_SEVEN_ON_SEVEN_PLAY_ID : DEFAULT_PLAY_ID;
}

export function createElevenOnElevenPlayForPreferredSide(
  play: PlayDefinition,
  preferredSide: PreferredFormationSide,
): PlayDefinition {
  if (play.playbookId !== '11v11') {
    return play;
  }

  return {
    ...play,
    formation: play.id === 'spread-quick-11'
      ? createElevenOnElevenPassFormation(preferredSide)
      : createElevenOnElevenRunFormation(preferredSide),
    preferredSide,
  };
}

export function getPlay(playId: string): PlayDefinition {
  const play = ALL_PLAYS.find((candidate) => candidate.id === playId);

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
  play: PlayDefinition = getPlay(DEFAULT_ELEVEN_ON_ELEVEN_PLAY_ID),
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
  const route = resolveReceiverRoute(play, receiver.id, resolveSnapPlacement(ballSpot));

  if (!route) {
    return null;
  }

  return getRouteFinalPoint(route);
}

export function getReceiverRouteSpeed(receiver: PlayerModel, play: PlayDefinition): number {
  return play.receiverRoutes?.[receiver.id]?.speedYardsPerSecond ?? 0;
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

export function getDeepHelpReceiverIds(play: PlayDefinition, defenderId: string): string[] {
  return play.pass?.deepHelpAssignments?.[defenderId] ?? [];
}

export function getProtectionAssignmentDefenderId(
  play: PlayDefinition,
  blockerId: string,
): string | null {
  return play.protectionAssignments?.[blockerId] ?? null;
}

function resolvePlayFormation(ballSpot: FootballSpot, play: PlayDefinition) {
  const formation = resolveFormation(
    play,
    resolveSnapPlacement(ballSpot),
    RUNTIME_FORMATION_FIELD_SPEC,
  );
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

function sevenOffenseSlot(id: string, role: PlayerRole, formationPoint: FormationPoint): FormationSlot {
  return offenseSlot(id, role, formationPoint);
}

function sevenDefenseSlot(id: string, role: PlayerRole, formationPoint: FormationPoint): FormationSlot {
  return defenseSlot(id, role, formationPoint);
}

function sevenOnSevenValidation(): PlayDefinition['validation'] {
  return {
    coverageAlignmentToleranceYards: 0.001,
    defensiveGapOffsets: {
      'defense-line-left': -SEVEN.defensiveLineGap,
      'defense-line-middle': 0,
      'defense-line-right': SEVEN.defensiveLineGap,
    },
    expectedDefenseCount: 7,
    expectedOffenseCount: 7,
    offensiveLineIds: ['offense-line-left', 'offense-center', 'offense-line-right'],
    receiverSidelineInsetYards: {
      'offense-wr-left': SEVEN.receiverSidelineInset,
      'offense-wr-right': SEVEN.receiverSidelineInset,
    },
    stablePlayerIds: SEVEN_ON_SEVEN_PLAYER_IDS,
  };
}

function elevenOnElevenValidation(): PlayDefinition['validation'] {
  return {
    coverageAlignmentToleranceYards: ELEVEN.lineOfScrimmageTolerance,
    defensiveGapOffsets: {
      'defense-line-left': -ELEVEN.defensiveLineGap,
      'defense-line-middle': 0,
      'defense-line-right': ELEVEN.defensiveLineGap,
    },
    expectedDefenseCount: 11,
    expectedOffenseCount: 11,
    offensiveLineIds: [
      'offense-tackle-left',
      'offense-line-left',
      'offense-center',
      'offense-line-right',
      'offense-tackle-right',
    ],
    receiverSidelineInsetYards: {
      'offense-wr-left': ELEVEN.receiverSidelineInset,
      'offense-wr-right': ELEVEN.receiverSidelineInset,
    },
    stablePlayerIds: ELEVEN_ON_ELEVEN_PLAYER_IDS,
  };
}

function createElevenOnElevenRunFormation(
  preferredSide: PreferredFormationSide = PLAY_SIDE,
): FormationSlot[] {
  const baseFormation = createElevenOnElevenPreviewFormation(preferredSide);
  const runBlockerIds = new Set<string>([
    ...ELEVEN_ON_ELEVEN_ELIGIBLE_RECEIVER_IDS,
    'offense-center',
    'offense-line-left',
    'offense-line-right',
    'offense-tackle-left',
    'offense-tackle-right',
  ]);

  return baseFormation.formation.map((slot) => {
    if (slot.id === 'offense-rb') {
      return { ...slot, role: 'runner' };
    }

    if (slot.id === 'offense-qb') {
      return { ...slot, role: 'quarterback' };
    }

    if (slot.team === 'offense' && runBlockerIds.has(slot.id)) {
      return { ...slot, role: 'blocker' };
    }

    if (slot.team === 'defense') {
      return { ...slot, role: 'defender' };
    }

    return slot;
  });
}

function createElevenOnElevenPassFormation(
  preferredSide: PreferredFormationSide = PLAY_SIDE,
): FormationSlot[] {
  const baseFormation = createElevenOnElevenPreviewFormation(preferredSide);
  const passProtectorIds = new Set<string>([
    'offense-center',
    'offense-line-left',
    'offense-line-right',
    'offense-tackle-left',
    'offense-tackle-right',
  ]);
  const receiverIds = new Set<string>(SPREAD_QUICK_ELEVEN_RECEIVER_IDS);
  const passRusherIds = new Set<string>([
    'defense-line-left',
    'defense-line-middle',
    'defense-line-right',
    'defense-linebacker-left',
    'defense-linebacker-right',
  ]);

  return baseFormation.formation.map((slot) => {
    if (slot.id === 'offense-qb') {
      return { ...slot, role: 'quarterback' };
    }

    if (slot.team === 'offense' && passProtectorIds.has(slot.id)) {
      return { ...slot, role: 'blocker' };
    }

    if (slot.team === 'offense' && receiverIds.has(slot.id)) {
      return { ...slot, role: 'receiver' };
    }

    if (slot.team === 'defense' && passRusherIds.has(slot.id)) {
      return { ...slot, role: 'defender' };
    }

    if (slot.id === 'defense-linebacker') {
      return {
        ...slot,
        ...point(alignedTo('offense-rb'), defenseDepth(ELEVEN.linebackerDepth)),
        role: 'coverageDefender',
      };
    }

    if (slot.id === 'defense-linebacker-inside') {
      return {
        ...slot,
        ...point(alignedTo('offense-tight-end'), defenseDepth(ELEVEN.linebackerDepth)),
        role: 'coverageDefender',
      };
    }

    if (slot.id === 'defense-safety-strong') {
      return {
        ...slot,
        ...point(alignedTo('offense-slot'), defenseDepth(ELEVEN.strongSafetyDepth)),
        role: 'coverageDefender',
      };
    }

    if (slot.team === 'defense') {
      return { ...slot, role: 'coverageDefender' };
    }

    return slot;
  });
}

function slantTarget(side: 'left' | 'right'): FormationPoint {
  const insideOffsetYards = side === 'left' ? -4 : 4;

  return point(fieldCenter(insideOffsetYards), defenseDepth(12));
}

function point(lateral: LateralAnchor, longitudinal: LongitudinalAnchor): FormationPoint {
  return { lateral, longitudinal };
}

function route(
  id: string,
  speedYardsPerSecond: number,
  waypoints: readonly RouteWaypointDefinition[],
): ReceiverRouteDefinition {
  return {
    id,
    speedYardsPerSecond,
    waypoints,
  };
}

function waypoint(id: string, pointDefinition: FormationPoint): RouteWaypointDefinition {
  return {
    id,
    point: pointDefinition,
  };
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

function runningBackFieldSide(): LateralAnchor {
  return {
    distanceYards: SEVEN.runningBackFieldOffset,
    kind: 'snapSide',
    side: 'field',
  };
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
