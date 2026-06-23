import { FIELD_DIMENSIONS } from '../../fieldSpec';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import { getRosterPlayerForGameplayId } from '../../roster/GameplayRosterBinding';
import type { RosterPlayer } from '../../roster/RosterPlayer';
import type { TeamRoster } from '../../roster/TeamRoster';
import type {
  CoinTossCaptainPlacement,
  CoinTossCaptainSubject,
  CoinTossPresentationLayout,
} from './CoinTossTypes';

const COIN_TOSS_LAYOUT_CONFIG = {
  captainGapX: 2.35,
  captainLineZ: 2.2,
  coinHeight: 1.55,
  coinZ: 0,
  minimumCaptainClearance: 1.6,
  playerScale: 1,
  sidelineClearance: 8,
} as const;

export function createCoinTossLayout(
  binding: GameplayRosterBinding,
): CoinTossPresentationLayout {
  const captains = resolveCoinTossCaptains(binding);
  const captainPlacements = captains.map((captain, index) =>
    createCaptainPlacement(captain, index));

  return {
    captains,
    captainPlacements,
    coinPosition: {
      x: 0,
      y: COIN_TOSS_LAYOUT_CONFIG.coinHeight,
      z: COIN_TOSS_LAYOUT_CONFIG.coinZ,
    },
    noGameplayAuthority: true,
  };
}

export function resolveCoinTossCaptains(
  binding: GameplayRosterBinding,
): readonly CoinTossCaptainSubject[] {
  const userQuarterback = resolveActiveRosterPlayer(binding, 'offense-qb');
  const userNonQuarterback = resolveFirstActivePlayer(
    binding,
    'offense',
    ['RB', 'WR', 'TE', 'SLOT'],
  );
  const opponentQuarterback = resolveRosterPosition(binding.opponentRoster, 'QB');
  const opponentNonQuarterback = resolveFirstActivePlayer(
    binding,
    'defense',
    ['FS', 'SS', 'ILB', 'OLB', 'CB', 'DL'],
  );

  return [
    createCaptainSubject('user', userQuarterback, 'offense-qb'),
    createCaptainSubject('user', userNonQuarterback, null),
    createCaptainSubject('opponent', opponentQuarterback, null),
    createCaptainSubject('opponent', opponentNonQuarterback, null),
  ];
}

function createCaptainSubject(
  team: CoinTossCaptainSubject['team'],
  player: RosterPlayer | null,
  gameplayPlayerId: string | null,
): CoinTossCaptainSubject {
  return {
    appearanceId: player?.appearanceId ?? player?.id ?? `${team}-coin-toss-captain`,
    displayName: player?.displayName ?? (team === 'user' ? 'User Captain' : 'Opponent Captain'),
    footballPosition: player?.footballPosition ?? 'CAPT',
    gameplayPlayerId,
    jerseyNumber: player?.jerseyNumber ?? null,
    rosterPlayerId: player?.id ?? `${team}-coin-toss-captain`,
    team,
  };
}

function createCaptainPlacement(
  captain: CoinTossCaptainSubject,
  index: number,
): CoinTossCaptainPlacement {
  const userSide = captain.team === 'user';
  const sideIndex = userSide ? index : index - 2;
  const centeredIndex = sideIndex === 0 ? -0.5 : 0.5;
  const z = userSide
    ? -COIN_TOSS_LAYOUT_CONFIG.captainLineZ
    : COIN_TOSS_LAYOUT_CONFIG.captainLineZ;

  return {
    appearanceId: captain.appearanceId,
    facingRadians: userSide ? 0 : Math.PI,
    footballPosition: normalizeFootballPosition(captain.footballPosition),
    gameplayPlayerId: captain.gameplayPlayerId,
    gameplayTeam: userSide ? 'offense' : 'defense',
    id: `coin-toss-captain-${captain.team}-${sideIndex + 1}`,
    jerseyNumber: captain.jerseyNumber,
    position: {
      x: centeredIndex * COIN_TOSS_LAYOUT_CONFIG.captainGapX,
      y: 0,
      z,
    },
    role: resolveCaptainRole(captain.footballPosition, userSide),
    rosterPlayerId: captain.rosterPlayerId,
    scale: COIN_TOSS_LAYOUT_CONFIG.playerScale,
    team: captain.team,
    visualId: `coin-toss-${captain.team}-${captain.rosterPlayerId}`,
  };
}

function resolveActiveRosterPlayer(
  binding: GameplayRosterBinding,
  gameplayPlayerId: string,
): RosterPlayer | null {
  return getRosterPlayerForGameplayId(binding, gameplayPlayerId);
}

function resolveFirstActivePlayer(
  binding: GameplayRosterBinding,
  team: 'defense' | 'offense',
  preferredPositions: readonly string[],
): RosterPlayer | null {
  for (const position of preferredPositions) {
    const lineupBinding = binding.activeLineup.bindings.find(
      (candidate) =>
        candidate.team === team &&
        candidate.footballPosition === position,
    );
    if (!lineupBinding) {
      continue;
    }
    const player = getRosterPlayerForGameplayId(binding, lineupBinding.gameplayPlayerId);
    if (player) {
      return player;
    }
  }

  const fallback = binding.activeLineup.bindings.find((candidate) => candidate.team === team);
  return fallback ? getRosterPlayerForGameplayId(binding, fallback.gameplayPlayerId) : null;
}

function resolveRosterPosition(roster: TeamRoster, position: string): RosterPlayer | null {
  return roster.players.find((player) => player.footballPosition === position) ?? null;
}

export function validateCoinTossLayout(layout: CoinTossPresentationLayout): string[] {
  const errors: string[] = [];
  const sidelineLimit = FIELD_DIMENSIONS.fieldWidth / 2 - COIN_TOSS_LAYOUT_CONFIG.sidelineClearance;

  if (layout.captains.length !== 4) {
    errors.push(`Expected four captains, received ${layout.captains.length}`);
  }
  if (layout.captainPlacements.length !== 4) {
    errors.push(`Expected four captain placements, received ${layout.captainPlacements.length}`);
  }

  const userCaptains = layout.captains.filter((captain) => captain.team === 'user').length;
  const opponentCaptains = layout.captains.filter((captain) => captain.team === 'opponent').length;
  if (userCaptains !== 2 || opponentCaptains !== 2) {
    errors.push(`Expected two captains per team, received user=${userCaptains} opponent=${opponentCaptains}`);
  }

  const rosterIds = new Set<string>();
  for (const captain of layout.captains) {
    if (rosterIds.has(captain.rosterPlayerId)) {
      errors.push(`Duplicate coin-toss captain roster ID ${captain.rosterPlayerId}`);
    }
    rosterIds.add(captain.rosterPlayerId);
  }

  for (const placement of layout.captainPlacements) {
    if (Math.abs(placement.position.x) > sidelineLimit) {
      errors.push(`${placement.id} is too close to the sideline`);
    }
    if (Math.abs(placement.position.z) > FIELD_DIMENSIONS.fieldLength / 2) {
      errors.push(`${placement.id} is outside the field length`);
    }
  }

  for (let i = 0; i < layout.captainPlacements.length; i += 1) {
    for (let j = i + 1; j < layout.captainPlacements.length; j += 1) {
      const a = layout.captainPlacements[i]!;
      const b = layout.captainPlacements[j]!;
      const distance = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
      if (distance < COIN_TOSS_LAYOUT_CONFIG.minimumCaptainClearance) {
        errors.push(`${a.id} overlaps ${b.id}`);
      }
    }
  }

  return errors;
}

function normalizeFootballPosition(position: string): CoinTossCaptainPlacement['footballPosition'] {
  const knownPositions = new Set([
    'QB',
    'RB',
    'C',
    'LG',
    'RG',
    'LT',
    'RT',
    'TE',
    'WR',
    'SLOT',
    'DL',
    'OLB',
    'ILB',
    'CB',
    'FS',
    'SS',
  ]);

  return knownPositions.has(position)
    ? position as CoinTossCaptainPlacement['footballPosition']
    : 'UNKNOWN';
}

function resolveCaptainRole(
  footballPosition: string,
  offense: boolean,
): CoinTossCaptainPlacement['role'] {
  if (!offense) {
    return footballPosition === 'CB' || footballPosition === 'FS' || footballPosition === 'SS'
      ? 'coverageDefender'
      : 'defender';
  }

  if (footballPosition === 'QB') {
    return 'quarterback';
  }
  if (footballPosition === 'RB') {
    return 'runner';
  }
  if (
    footballPosition === 'C' ||
    footballPosition === 'LG' ||
    footballPosition === 'RG' ||
    footballPosition === 'LT' ||
    footballPosition === 'RT'
  ) {
    return 'blocker';
  }

  return 'receiver';
}
