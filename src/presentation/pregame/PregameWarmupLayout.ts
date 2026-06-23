import {
  FIELD_BOUNDS,
  type FieldBounds,
} from '../../fieldSpec';
import type { PlayerTeam } from '../../playerModel';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import type { FootballPosition, RosterPlayer } from '../../roster/RosterPlayer';
import type { SidelineTeamSide } from '../teams/SidelineTeamTypes';
import type {
  PregameWarmupGroup,
  PregameWarmupGroupId,
  PregameWarmupLayout,
  PregameWarmupPlacement,
  PregameWarmupPoseId,
  PregameWarmupPropPlacement,
  PregameWarmupRole,
  PregameWarmupVec3,
  PregameWarmupZone,
  PregameWarmupZoneId,
} from './PregameWarmupTypes';

export const PREGAME_WARMUP_LAYOUT_CONFIG = {
  fieldClearance: 6.8,
  groupDepth: 15,
  groupSpacing: 11.5,
  lineSpacing: 1.15,
  playerSpacing: 1.65,
  practiceZoneDepth: 58,
  practiceZoneWidth: 15,
  protectedGameplayMargin: 2.5,
  receiverDepth: 6.8,
  runningBackLaneSpacing: 1.1,
} as const;

const GROUP_ORDER: readonly PregameWarmupGroupId[] = [
  'quarterbackThrowing',
  'runningBackFootwork',
  'offensiveLineStance',
  'receiverWarmup',
] as const;

export function createPregameWarmupLayout(
  rosterBinding: GameplayRosterBinding,
): PregameWarmupLayout {
  const zones = createPregameWarmupZones();
  const userGroups = createTeamWarmupGroups('user', rosterBinding.userRoster.players, zones);
  const opponentGroups = createTeamWarmupGroups('opponent', rosterBinding.opponentRoster.players, zones);
  const groups = [...userGroups, ...opponentGroups];
  const placements = groups.flatMap((group) => [...group.placements]);
  const props = groups.flatMap((group) => [...group.props]);

  return {
    groups,
    opponentQuarterback: placements.find(
      (placement) => placement.teamSide === 'opponent' && placement.role === 'quarterback',
    ) ?? null,
    placements,
    props,
    protectedFieldBounds: FIELD_BOUNDS,
    userQuarterback: placements.find(
      (placement) => placement.teamSide === 'user' && placement.role === 'quarterback',
    ) ?? null,
    zones,
  };
}

export function createPregameWarmupZones(): PregameWarmupZone[] {
  const halfDepth = PREGAME_WARMUP_LAYOUT_CONFIG.practiceZoneDepth / 2;
  const userMinX = FIELD_BOUNDS.minX -
    PREGAME_WARMUP_LAYOUT_CONFIG.fieldClearance -
    PREGAME_WARMUP_LAYOUT_CONFIG.practiceZoneWidth;
  const userMaxX = FIELD_BOUNDS.minX - PREGAME_WARMUP_LAYOUT_CONFIG.fieldClearance;
  const opponentMinX = FIELD_BOUNDS.maxX + PREGAME_WARMUP_LAYOUT_CONFIG.fieldClearance;
  const opponentMaxX = opponentMinX + PREGAME_WARMUP_LAYOUT_CONFIG.practiceZoneWidth;
  const minZ = Math.max(FIELD_BOUNDS.minZ + 11, -halfDepth);
  const maxZ = Math.min(FIELD_BOUNDS.maxZ - 11, halfDepth);

  return [
    createZone('user-warmup', 'user', {
      maxX: userMaxX,
      maxZ,
      minX: userMinX,
      minZ,
    }),
    createZone('opponent-warmup', 'opponent', {
      maxX: opponentMaxX,
      maxZ,
      minX: opponentMinX,
      minZ,
    }),
  ];
}

export function arePregameWarmupZonesMirrored(
  userZone: PregameWarmupZone,
  opponentZone: PregameWarmupZone,
): boolean {
  return (
    userZone.bounds.minX === -opponentZone.bounds.maxX &&
    userZone.bounds.maxX === -opponentZone.bounds.minX &&
    userZone.bounds.minZ === opponentZone.bounds.minZ &&
    userZone.bounds.maxZ === opponentZone.bounds.maxZ
  );
}

export function isPregameWarmupPlacementOutsideProtectedField(
  placement: PregameWarmupPlacement | PregameWarmupPropPlacement,
  margin = PREGAME_WARMUP_LAYOUT_CONFIG.protectedGameplayMargin,
): boolean {
  return (
    placement.position.x < FIELD_BOUNDS.minX - margin ||
    placement.position.x > FIELD_BOUNDS.maxX + margin ||
    placement.position.z < FIELD_BOUNDS.minZ - margin ||
    placement.position.z > FIELD_BOUNDS.maxZ + margin
  );
}

function createTeamWarmupGroups(
  teamSide: SidelineTeamSide,
  rosterPlayers: readonly RosterPlayer[],
  zones: readonly PregameWarmupZone[],
): PregameWarmupGroup[] {
  const zoneId: PregameWarmupZoneId = teamSide === 'user' ? 'user-warmup' : 'opponent-warmup';
  const zone = zones.find((candidate) => candidate.id === zoneId);
  if (!zone) {
    return [];
  }

  return GROUP_ORDER.map((groupId, index) => {
    const center = createGroupCenter(zone, index);
    return createGroup(teamSide, zone, groupId, center, rosterPlayers);
  });
}

function createGroup(
  teamSide: SidelineTeamSide,
  zone: PregameWarmupZone,
  groupId: PregameWarmupGroupId,
  center: PregameWarmupVec3,
  rosterPlayers: readonly RosterPlayer[],
): PregameWarmupGroup {
  const placements = createGroupPlacements(teamSide, zone.id, groupId, center, rosterPlayers);
  const props = createGroupProps(teamSide, zone.id, groupId, center);
  const bounds = calculateGroupBounds(placements, props);

  return {
    bounds,
    groupId,
    id: `${teamSide}-${groupId}`,
    placements,
    props,
    ready: placements.length > 0,
    teamSide,
  };
}

function createGroupPlacements(
  teamSide: SidelineTeamSide,
  zoneId: PregameWarmupZoneId,
  groupId: PregameWarmupGroupId,
  center: PregameWarmupVec3,
  rosterPlayers: readonly RosterPlayer[],
): PregameWarmupPlacement[] {
  const team = resolveGameplayTeam(teamSide);
  const inward = teamSide === 'user' ? 1 : -1;
  const facing = Math.atan2(inward, 0);
  const player = (position: FootballPosition, occurrence = 0) =>
    rosterPlayers.filter((candidate) => candidate.footballPosition === position)[occurrence] ?? null;

  if (groupId === 'quarterbackThrowing') {
    const qb = player('QB');
    const centerPlayer = player('C');
    const receivers = [player('WR', 0), player('WR', 1), player('TE')].filter(Boolean);
    return [
      createPlacement(teamSide, team, zoneId, groupId, 'center', centerPlayer, {
        x: center.x + inward * 1.25,
        y: 0,
        z: center.z,
      }, facing, 'crouched', 0),
      createPlacement(teamSide, team, zoneId, groupId, 'quarterback', qb, {
        x: center.x - inward * 1.45,
        y: 0,
        z: center.z - 1.2,
      }, facing, 'handsOnHips', 1),
      ...receivers.map((receiver, index) =>
        createPlacement(teamSide, team, zoneId, groupId, receiver?.footballPosition === 'TE' ? 'tightEnd' : 'receiver', receiver, {
          x: center.x + inward * (3.4 + index * 0.65),
          y: 0,
          z: center.z + (index - 1) * PREGAME_WARMUP_LAYOUT_CONFIG.receiverDepth,
        }, facing, 'armsLow', index + 2)),
    ];
  }

  if (groupId === 'runningBackFootwork') {
    return [
      createPlacement(teamSide, team, zoneId, groupId, 'runningBack', player('RB'), {
        x: center.x,
        y: 0,
        z: center.z - 1.6,
      }, facing, 'slightLean', 0),
      createPlacement(teamSide, team, zoneId, groupId, 'coachMarker', null, {
        x: center.x + inward * 2.3,
        y: 0,
        z: center.z + 1.8,
      }, facing, 'handsOnHips', 1),
    ];
  }

  if (groupId === 'offensiveLineStance') {
    const line: Array<[FootballPosition, number]> = [
      ['LT', 0],
      ['LG', 0],
      ['C', 0],
      ['RG', 0],
      ['RT', 0],
    ];
    return line.map(([position, occurrence], index) =>
      createPlacement(teamSide, team, zoneId, groupId, 'lineman', player(position, occurrence), {
        x: center.x,
        y: 0,
        z: center.z + (index - 2) * PREGAME_WARMUP_LAYOUT_CONFIG.lineSpacing,
      }, facing, 'staggeredStance', index));
  }

  const receivers = [
    player('WR', 0),
    player('WR', 1),
    player('SLOT'),
  ];
  return receivers.map((receiver, index) =>
    createPlacement(teamSide, team, zoneId, groupId, 'receiver', receiver, {
      x: center.x + inward * (index % 2 === 0 ? 0.7 : 2.2),
      y: 0,
      z: center.z + (index - 1) * 3.2,
    }, facing, index === 1 ? 'slightLean' : 'neutral', index));
}

function createGroupProps(
  teamSide: SidelineTeamSide,
  zoneId: PregameWarmupZoneId,
  groupId: PregameWarmupGroupId,
  center: PregameWarmupVec3,
): PregameWarmupPropPlacement[] {
  const inward = teamSide === 'user' ? 1 : -1;
  const facing = Math.atan2(inward, 0);

  if (groupId === 'quarterbackThrowing') {
    return [];
  }

  if (groupId !== 'runningBackFootwork') {
    return [];
  }

  return Array.from({ length: 4 }, (_, index) =>
    createProp(teamSide, zoneId, groupId, 'cone', {
      x: center.x + inward * (0.65 + index * 0.7),
      y: 0,
      z: center.z + (index - 1.5) * PREGAME_WARMUP_LAYOUT_CONFIG.runningBackLaneSpacing,
    }, facing, 1, index));
}

function createPlacement(
  teamSide: SidelineTeamSide,
  team: PlayerTeam,
  zoneId: PregameWarmupZoneId,
  groupId: PregameWarmupGroupId,
  role: PregameWarmupRole,
  player: RosterPlayer | null,
  position: PregameWarmupVec3,
  facingRadians: number,
  pose: PregameWarmupPoseId,
  index: number,
): PregameWarmupPlacement {
  const id = `pregame-warmup-${teamSide}-${groupId}-${role}-${index}`;
  return {
    appearanceId: player?.appearanceId ?? id,
    facingRadians,
    groupId,
    id,
    player,
    position,
    pose,
    role,
    scale: role === 'lineman' ? 0.95 : 0.88,
    team,
    teamSide,
    zoneId,
  };
}

function createProp(
  teamSide: SidelineTeamSide,
  zoneId: PregameWarmupZoneId,
  groupId: PregameWarmupGroupId,
  role: PregameWarmupPropPlacement['role'],
  position: PregameWarmupVec3,
  facingRadians: number,
  scale: number,
  index: number,
): PregameWarmupPropPlacement {
  return {
    facingRadians,
    groupId,
    id: `pregame-warmup-${teamSide}-${groupId}-${role}-${index}`,
    position,
    role,
    scale,
    teamSide,
    zoneId,
  };
}

function createGroupCenter(zone: PregameWarmupZone, index: number): PregameWarmupVec3 {
  const sideSign = zone.teamSide === 'user' ? 1 : -1;
  const inwardEdgeX = zone.teamSide === 'user' ? zone.bounds.maxX : zone.bounds.minX;
  return {
    x: inwardEdgeX - sideSign * 4.7,
    y: 0,
    z: -17.5 + index * PREGAME_WARMUP_LAYOUT_CONFIG.groupSpacing,
  };
}

function calculateGroupBounds(
  placements: readonly PregameWarmupPlacement[],
  props: readonly PregameWarmupPropPlacement[],
): FieldBounds {
  const points = [...placements, ...props].map((placement) => placement.position);
  if (points.length === 0) {
    return { maxX: 0, maxZ: 0, minX: 0, minZ: 0 };
  }

  return {
    maxX: Math.max(...points.map((point) => point.x)) + 0.9,
    maxZ: Math.max(...points.map((point) => point.z)) + 0.9,
    minX: Math.min(...points.map((point) => point.x)) - 0.9,
    minZ: Math.min(...points.map((point) => point.z)) - 0.9,
  };
}

function createZone(
  id: PregameWarmupZoneId,
  teamSide: SidelineTeamSide,
  bounds: FieldBounds,
): PregameWarmupZone {
  return {
    bounds,
    center: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: 0,
      z: (bounds.minZ + bounds.maxZ) / 2,
    },
    id,
    teamSide,
  };
}

function resolveGameplayTeam(teamSide: SidelineTeamSide): PlayerTeam {
  return teamSide === 'user' ? 'offense' : 'defense';
}
