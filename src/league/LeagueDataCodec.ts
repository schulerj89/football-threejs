import {
  PLAYER_ATTRIBUTE_KEYS,
  isPlayerAttributeKey,
  isPlayerRatingValue,
  type PlayerAttributeKey,
} from '../ratings/PlayerAttribute';
import { clonePlayerRatings, type PlayerRatings } from '../ratings/PlayerRatings';
import type { RosterPlayer } from '../roster/RosterPlayer';
import { cloneTeamProfile } from '../teams/TeamRegistry';
import type {
  AttributeOrder,
  CompactPlayerRecord,
  CompactTeamRosterRecord,
  EncodedLeagueData,
  LeagueData,
} from './LeagueTypes';

export const ATTRIBUTE_ORDER: AttributeOrder = [...PLAYER_ATTRIBUTE_KEYS];

export function encodeLeagueData(data: Omit<LeagueData, 'contentHash'> | LeagueData): EncodedLeagueData {
  const withoutHash = {
    generatorVersion: data.generatorVersion,
    schemaVersion: data.schemaVersion,
    seed: data.seed,
    teams: data.teams.map(cloneTeamProfile),
    rosters: data.rosters.map(encodeRoster),
  };
  return {
    ...withoutHash,
    contentHash: calculateLeagueContentHash(withoutHash),
  };
}

export function decodeLeagueData(encoded: EncodedLeagueData): LeagueData {
  const data: LeagueData = {
    contentHash: encoded.contentHash,
    generatorVersion: encoded.generatorVersion,
    schemaVersion: encoded.schemaVersion,
    seed: encoded.seed,
    teams: encoded.teams.map(cloneTeamProfile),
    rosters: encoded.rosters.map(decodeRoster),
  };
  return data;
}

export function calculateLeagueContentHash(
  encoded: Omit<EncodedLeagueData, 'contentHash'> | EncodedLeagueData,
): string {
  const { contentHash: _ignored, ...content } = encoded as EncodedLeagueData;
  return fnv1a32(stableStringify(content)).toString(16).padStart(8, '0');
}

export function estimateEncodedLeagueBytes(encoded: EncodedLeagueData): number {
  return new TextEncoder().encode(JSON.stringify(encoded)).byteLength;
}

export function estimateDecodedLeagueBytes(data: LeagueData): number {
  return new TextEncoder().encode(JSON.stringify(data)).byteLength;
}

function encodeRoster(roster: LeagueData['rosters'][number]): CompactTeamRosterRecord {
  return {
    defensiveStarterIds: [...roster.defensiveStarterIds],
    kickerId: roster.kickerId,
    longSnapperId: roster.longSnapperId,
    offensiveStarterIds: [...roster.offensiveStarterIds],
    players: roster.players.map(encodePlayer),
    punterId: roster.punterId,
    reserveIds: [...roster.reserveIds],
    teamId: roster.teamId,
  };
}

function decodeRoster(roster: CompactTeamRosterRecord): LeagueData['rosters'][number] {
  return {
    defensiveStarterIds: [...roster.defensiveStarterIds],
    kickerId: roster.kickerId,
    longSnapperId: roster.longSnapperId,
    offensiveStarterIds: [...roster.offensiveStarterIds],
    players: roster.players.map(decodePlayer),
    punterId: roster.punterId,
    reserveIds: [...roster.reserveIds],
    teamId: roster.teamId,
  };
}

function encodePlayer(player: RosterPlayer): CompactPlayerRecord {
  return {
    appearanceId: player.appearanceId,
    archetype: player.archetype,
    first: player.firstName,
    id: player.id,
    last: player.lastName,
    number: player.jerseyNumber,
    position: player.footballPosition,
    ratings: ATTRIBUTE_ORDER.map((key) => player.ratings[key] ?? -1),
    team: player.teamId,
  };
}

function decodePlayer(player: CompactPlayerRecord): RosterPlayer {
  const ratings: Partial<Record<PlayerAttributeKey, number>> = {};
  for (const [index, value] of player.ratings.entries()) {
    const key = ATTRIBUTE_ORDER[index];
    if (!key || value === -1) {
      continue;
    }
    if (!isPlayerRatingValue(value)) {
      throw new Error(`${player.id} has invalid compact ${key} rating ${value}`);
    }
    ratings[key] = value;
  }

  return {
    appearanceId: player.appearanceId,
    archetype: player.archetype,
    displayName: `${player.first} ${player.last}`,
    firstName: player.first,
    footballPosition: player.position,
    id: player.id,
    jerseyNumber: player.number,
    lastName: player.last,
    ratings: clonePlayerRatings(ratings),
    teamId: player.team,
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

function fnv1a32(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function validateAttributeOrder(values: readonly unknown[]): string[] {
  const issues: string[] = [];
  if (values.length !== ATTRIBUTE_ORDER.length) {
    issues.push(`rating array length ${values.length} does not match ATTRIBUTE_ORDER ${ATTRIBUTE_ORDER.length}`);
  }
  for (const key of ATTRIBUTE_ORDER) {
    if (!isPlayerAttributeKey(key)) {
      issues.push(`unknown ATTRIBUTE_ORDER key ${String(key)}`);
    }
  }
  return issues;
}
