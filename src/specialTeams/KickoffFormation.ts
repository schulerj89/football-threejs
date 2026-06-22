import { FIELD_BOUNDS } from '../fieldSpec';
import type { GameplayRosterBinding } from '../roster/GameplayRosterBinding';
import { getKickerRatings } from './KickerRatings';
import type { KickoffState } from './KickoffTypes';
import type { SidelinePlayerPlacement } from '../presentation/teams/SidelineTeamTypes';

export interface KickoffFormationLayout {
  noGameplayAuthority: true;
  placements: readonly SidelinePlayerPlacement[];
}

const KICKOFF_FORMATION_CONFIG = {
  kickingLineDepthFromOrigin: 6,
  lineSpacingX: 5.4,
  returnerDepthFromTarget: 3.2,
} as const;

export function createKickoffFormation(
  kickoff: KickoffState,
  binding: GameplayRosterBinding,
): KickoffFormationLayout {
  if (!kickoff.kickingTeam || !kickoff.receivingTeam || !kickoff.result) {
    return { noGameplayAuthority: true, placements: [] };
  }

  const kickingRoster = kickoff.kickingTeam === 'user' ? binding.userRoster : binding.opponentRoster;
  const receivingRoster = kickoff.receivingTeam === 'user' ? binding.userRoster : binding.opponentRoster;
  const kickingTeam = kickoff.kickingTeam === 'user' ? 'offense' : 'defense';
  const receivingTeam = kickoff.receivingTeam === 'user' ? 'offense' : 'defense';
  const kickingSide = kickoff.kickingTeam === 'user' ? 'user' : 'opponent';
  const receivingSide = kickoff.receivingTeam === 'user' ? 'user' : 'opponent';
  const placements: SidelinePlayerPlacement[] = [];
  const result = kickoff.result;
  const origin = result.origin;
  const direction = kickoff.direction;

  placements.push({
    appearanceId: kickingRoster.kickerId,
    facingRadians: direction > 0 ? 0 : Math.PI,
    id: `kickoff-${kickoff.sequenceIndex}-kicker`,
    position: { x: origin.x, y: 0, z: origin.z - direction * 1.8 },
    pose: 'slightLean',
    scale: 1,
    team: kickingTeam,
    teamSide: kickingSide,
    zoneId: kickingSide === 'user' ? 'user-sideline' : 'opponent-sideline',
  });

  const kickingLineIds = kickingRoster.defensiveStarterIds.slice(0, 6);
  kickingLineIds.forEach((playerId, index) => {
    const offset = index - (kickingLineIds.length - 1) / 2;
    placements.push({
      appearanceId: playerId,
      facingRadians: direction > 0 ? 0 : Math.PI,
      id: `kickoff-${kickoff.sequenceIndex}-coverage-${index}`,
      position: {
        x: clampX(offset * KICKOFF_FORMATION_CONFIG.lineSpacingX),
        y: 0,
        z: origin.z - direction * KICKOFF_FORMATION_CONFIG.kickingLineDepthFromOrigin,
      },
      pose: 'armsLow',
      scale: 0.96,
      team: kickingTeam,
      teamSide: kickingSide,
      zoneId: kickingSide === 'user' ? 'user-sideline' : 'opponent-sideline',
    });
  });

  const returnerIds = receivingRoster.offensiveStarterIds.slice(0, 2);
  returnerIds.forEach((playerId, index) => {
    const side = index === 0 ? -1 : 1;
    placements.push({
      appearanceId: playerId,
      facingRadians: direction > 0 ? Math.PI : 0,
      id: `kickoff-${kickoff.sequenceIndex}-returner-${index}`,
      position: {
        x: clampX(result.target.x + side * 4),
        y: 0,
        z: clampZ(result.target.z + direction * KICKOFF_FORMATION_CONFIG.returnerDepthFromTarget),
      },
      pose: 'neutral',
      scale: 1,
      team: receivingTeam,
      teamSide: receivingSide,
      zoneId: receivingSide === 'user' ? 'user-sideline' : 'opponent-sideline',
    });
  });

  return { noGameplayAuthority: true, placements };
}

export function validateKickoffFormation(layout: KickoffFormationLayout): string[] {
  const issues: string[] = [];
  if (layout.placements.length < 4) {
    issues.push('Kickoff formation must include kicker, coverage line, and returners');
  }
  for (const placement of layout.placements) {
    if (
      placement.position.x < FIELD_BOUNDS.minX ||
      placement.position.x > FIELD_BOUNDS.maxX ||
      placement.position.z < FIELD_BOUNDS.minZ ||
      placement.position.z > FIELD_BOUNDS.maxZ
    ) {
      issues.push(`${placement.id} is outside field presentation bounds`);
    }
  }
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

function clampX(value: number): number {
  return Math.max(FIELD_BOUNDS.minX + 2, Math.min(FIELD_BOUNDS.maxX - 2, value));
}

function clampZ(value: number): number {
  return Math.max(FIELD_BOUNDS.minZ + 1, Math.min(FIELD_BOUNDS.maxZ - 1, value));
}
