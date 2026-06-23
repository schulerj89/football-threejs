import { FIELD_BOUNDS, type FieldBounds } from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { MatchPossession } from '../match/MatchTypes';
import type { PlayerRole, PlayerTeam } from '../playerModel';
import type { GameplayRosterBinding } from '../roster/GameplayRosterBinding';
import type { RosterPlayer } from '../roster/RosterPlayer';
import type { TeamRoster } from '../roster/TeamRoster';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  type FootballPlayerVisualPosition,
  type FootballPlayerVisualTeamSide,
} from '../presentation/players/FootballPlayerVisualFactory';
import { createSpecialTeamsDepthChart } from './SpecialTeamsDepthChart';
import {
  PLACE_KICK_SIMULATION_CONFIG,
  resolveKickerSpot,
} from './PlaceKickSimulation';
import type {
  PlaceKickFormationLayout,
  PlaceKickFormationParticipantPlacement,
  PlaceKickState,
} from './PlaceKickTypes';
import type { KickoffDirection } from './KickoffTypes';

const PLACE_KICK_FORMATION_CONFIG = {
  defenderDepthYards: 2.4,
  defenderSpacingYards: 2.45,
  minimumPlayerClearanceYards: 0.72,
  protectorBackRowDepthYards: -0.72,
  protectorFrontRowDepthYards: -0.28,
  protectorSpacingYards: 1.45,
} as const;

export function createPlaceKickFormation(
  placeKick: PlaceKickState,
  binding: GameplayRosterBinding,
): PlaceKickFormationLayout {
  if (!placeKick.kickingTeam || !placeKick.defendingTeam) {
    return createEmptyPlaceKickLayout();
  }

  const kickingRoster = getRosterForPossession(binding, placeKick.kickingTeam);
  const defendingRoster = getRosterForPossession(binding, placeKick.defendingTeam);
  const protection = createProtectionPlacements(placeKick, kickingRoster, placeKick.kickingTeam);
  const defense = createDefensePlacements(placeKick, defendingRoster, placeKick.defendingTeam);
  const participants = [...protection, ...defense];

  return {
    ballPlacement: { ...placeKick.ballPlacement },
    bounds: calculateBounds(participants, placeKick.ballPlacement),
    family: 'placeKick',
    noGameplayAuthority: true,
    participants,
    placements: participants,
  };
}

export function validatePlaceKickFormation(layout: PlaceKickFormationLayout): string[] {
  const issues: string[] = [];

  if (layout.participants.length !== 22) {
    issues.push(`Place-kick formation must include exactly 22 participants, received ${layout.participants.length}`);
  }

  const protection = layout.participants.filter((participant) => participant.phase === 'protection');
  const defense = layout.participants.filter((participant) => participant.phase === 'defense');
  if (protection.length !== 11) {
    issues.push(`Place-kick protection must include 11 participants, received ${protection.length}`);
  }
  if (defense.length !== 11) {
    issues.push(`Place-kick defense must include 11 participants, received ${defense.length}`);
  }

  validateUniqueParticipants(layout.participants, issues);
  validateBounds(layout, issues);
  validateClearance(layout.participants, issues);

  return issues;
}

function createProtectionPlacements(
  placeKick: PlaceKickState,
  roster: TeamRoster,
  team: MatchPossession,
): PlaceKickFormationParticipantPlacement[] {
  const chart = createSpecialTeamsDepthChart(roster);
  const snapper = getRosterPlayerById(roster, chart.placeKick.longSnapperId);
  const holder = getRosterPlayerById(roster, chart.placeKick.holderId);
  const kicker = getRosterPlayerById(roster, chart.placeKick.kickerId);
  const protectors = chart.placeKick.protectorIds
    .map((id) => getRosterPlayerById(roster, id))
    .filter((player): player is RosterPlayer => Boolean(player));
  const direction = placeKick.direction;

  return [
    snapper
      ? createParticipant(placeKick, team, snapper, 'long-snapper', 'blocker', placeKick.snapSpot, direction)
      : null,
    holder
      ? createParticipant(placeKick, team, holder, 'holder', 'quarterback', placeKick.holderSpot, direction)
      : null,
    kicker
      ? createParticipant(placeKick, team, kicker, 'kicker', 'runner', resolveKickerSpot(direction), direction)
      : null,
    ...protectors.map((player, index) =>
      createParticipant(
        placeKick,
        team,
        player,
        `protector-${index + 1}`,
        'blocker',
        {
          x: (index - 3.5) * PLACE_KICK_FORMATION_CONFIG.protectorSpacingYards,
          z: placeKick.snapSpot.z + direction * (
            index < 4
              ? PLACE_KICK_FORMATION_CONFIG.protectorFrontRowDepthYards
              : PLACE_KICK_FORMATION_CONFIG.protectorBackRowDepthYards
          ),
        },
        direction,
      )),
  ].filter((participant): participant is PlaceKickFormationParticipantPlacement => Boolean(participant));
}

function createDefensePlacements(
  placeKick: PlaceKickState,
  roster: TeamRoster,
  team: MatchPossession,
): PlaceKickFormationParticipantPlacement[] {
  const chart = createSpecialTeamsDepthChart(roster);
  const rushers = chart.placeKickDefense.rusherIds
    .map((id) => getRosterPlayerById(roster, id))
    .filter((player): player is RosterPlayer => Boolean(player));
  const direction = placeKick.direction;

  return rushers.map((player, index) =>
    createParticipant(
      placeKick,
      team,
      player,
      `rusher-${index + 1}`,
      'defender',
      {
        x: (index - 5) * PLACE_KICK_FORMATION_CONFIG.defenderSpacingYards,
        z: placeKick.snapSpot.z + direction * PLACE_KICK_FORMATION_CONFIG.defenderDepthYards,
      },
      -direction as KickoffDirection,
    ));
}

function createParticipant(
  placeKick: PlaceKickState,
  team: MatchPossession,
  player: RosterPlayer,
  slotId: string,
  role: PlayerRole,
  position: FootballSpot,
  facingDirection: KickoffDirection,
): PlaceKickFormationParticipantPlacement {
  const teamSide = team === 'user' ? 'user' : 'opponent';
  const gameplayTeam = getGameplayTeamForPossession(team);

  return {
    appearanceId: player.appearanceId,
    facingRadians: facingDirection > 0 ? 0 : Math.PI,
    footballPosition: player.footballPosition as FootballPlayerVisualPosition,
    gameplayTeam,
    jerseyNumber: player.jerseyNumber,
    phase: team === placeKick.kickingTeam ? 'protection' : 'defense',
    position: { ...position },
    presentationOnly: true,
    role,
    rosterPlayerId: player.id,
    scale: slotId === 'kicker' ? 1 : 0.98,
    slotId,
    team,
    teamSide,
    visualId: `place-kick-${placeKick.sequenceIndex}-${team}-${slotId}`,
    visualProfileId: FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  };
}

function createEmptyPlaceKickLayout(): PlaceKickFormationLayout {
  return {
    ballPlacement: null,
    bounds: null,
    family: 'placeKick',
    noGameplayAuthority: true,
    participants: [],
    placements: [],
  };
}

function getRosterForPossession(
  binding: GameplayRosterBinding,
  team: MatchPossession,
): TeamRoster {
  return team === 'user' ? binding.userRoster : binding.opponentRoster;
}

function getGameplayTeamForPossession(team: MatchPossession): PlayerTeam {
  return team === 'user' ? 'offense' : 'defense';
}

function getRosterPlayerById(roster: TeamRoster, id: string): RosterPlayer | null {
  return roster.players.find((player) => player.id === id) ?? null;
}

function validateUniqueParticipants(
  participants: readonly PlaceKickFormationParticipantPlacement[],
  issues: string[],
): void {
  const visualIds = new Set<string>();
  const rosterIdsByTeam = new Map<MatchPossession, Set<string>>();

  for (const participant of participants) {
    if (visualIds.has(participant.visualId)) {
      issues.push(`Duplicate place-kick visual ID ${participant.visualId}`);
    }
    visualIds.add(participant.visualId);
    const ids = rosterIdsByTeam.get(participant.team) ?? new Set<string>();
    if (ids.has(participant.rosterPlayerId)) {
      issues.push(`Roster player ${participant.rosterPlayerId} occupies multiple place-kick slots`);
    }
    ids.add(participant.rosterPlayerId);
    rosterIdsByTeam.set(participant.team, ids);
  }
}

function validateBounds(layout: PlaceKickFormationLayout, issues: string[]): void {
  if (!layout.ballPlacement) {
    issues.push('Place-kick formation must include a ball placement');
  } else if (!isSpotInsideField(layout.ballPlacement)) {
    issues.push('Place-kick ball placement is outside field bounds');
  }

  for (const participant of layout.participants) {
    if (!isSpotInsideField(participant.position)) {
      issues.push(`${participant.visualId} is outside field bounds`);
    }
    if (layout.bounds && !boundsContainsSpot(layout.bounds, participant.position)) {
      issues.push(`${participant.visualId} is outside place-kick formation bounds`);
    }
  }
}

function validateClearance(
  participants: readonly PlaceKickFormationParticipantPlacement[],
  issues: string[],
): void {
  for (let index = 0; index < participants.length; index += 1) {
    const a = participants[index]!;
    for (let next = index + 1; next < participants.length; next += 1) {
      const b = participants[next]!;
      const distance = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
      if (distance < PLACE_KICK_FORMATION_CONFIG.minimumPlayerClearanceYards) {
        issues.push(`${a.visualId} overlaps ${b.visualId}`);
      }
    }
  }
}

function calculateBounds(
  participants: readonly PlaceKickFormationParticipantPlacement[],
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

function isSpotInsideField(spot: FootballSpot): boolean {
  return (
    spot.x >= FIELD_BOUNDS.minX &&
    spot.x <= FIELD_BOUNDS.maxX &&
    spot.z >= FIELD_BOUNDS.minZ &&
    spot.z <= FIELD_BOUNDS.maxZ
  );
}

function boundsContainsSpot(bounds: FieldBounds, spot: FootballSpot): boolean {
  return (
    spot.x >= bounds.minX &&
    spot.x <= bounds.maxX &&
    spot.z >= bounds.minZ &&
    spot.z <= bounds.maxZ
  );
}
