import { FIELD_DIMENSIONS } from '../../fieldSpec';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import { getRosterPlayerForGameplayId } from '../../roster/GameplayRosterBinding';
import type { RosterPlayer } from '../../roster/RosterPlayer';
import type { TeamRoster } from '../../roster/TeamRoster';
import type { OfficialModel } from '../../officials/OfficialTypes';
import type { SidelinePlayerPlacement, SidelinePoseId } from '../teams/SidelineTeamTypes';
import type {
  CoinTossCaptainSubject,
  CoinTossPresentationLayout,
} from './CoinTossTypes';

const COIN_TOSS_LAYOUT_CONFIG = {
  captainGapX: 1.05,
  captainLineZ: 2.2,
  coinHeight: 1.55,
  coinZ: 0,
  officialZ: 0.15,
  playerScale: 1,
  sidelineClearance: 8,
} as const;

export function createCoinTossLayout(
  binding: GameplayRosterBinding,
): CoinTossPresentationLayout {
  const captains = resolveCoinTossCaptains(binding);
  const captainPlacements = captains.map((captain, index) =>
    createCaptainPlacement(captain, index));
  const officials = [createCoinTossOfficial()];

  return {
    captains,
    captainPlacements,
    coinPosition: {
      x: 0,
      y: COIN_TOSS_LAYOUT_CONFIG.coinHeight,
      z: COIN_TOSS_LAYOUT_CONFIG.coinZ,
    },
    noGameplayAuthority: true,
    officials,
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
    displayName: player?.displayName ?? (team === 'user' ? 'User Captain' : 'Opponent Captain'),
    footballPosition: player?.footballPosition ?? 'CAPT',
    gameplayPlayerId,
    rosterPlayerId: player?.id ?? `${team}-coin-toss-captain`,
    team,
  };
}

function createCaptainPlacement(
  captain: CoinTossCaptainSubject,
  index: number,
): SidelinePlayerPlacement {
  const userSide = captain.team === 'user';
  const sideIndex = userSide ? index : index - 2;
  const centeredIndex = sideIndex === 0 ? -0.5 : 0.5;
  const z = userSide
    ? -COIN_TOSS_LAYOUT_CONFIG.captainLineZ
    : COIN_TOSS_LAYOUT_CONFIG.captainLineZ;
  const pose: SidelinePoseId = sideIndex === 0 ? 'handsOnHips' : 'armsLow';

  return {
    appearanceId: captain.rosterPlayerId,
    facingRadians: userSide ? 0 : Math.PI,
    id: `coin-toss-captain-${captain.team}-${sideIndex + 1}`,
    position: {
      x: centeredIndex * COIN_TOSS_LAYOUT_CONFIG.captainGapX,
      y: 0,
      z,
    },
    pose,
    scale: COIN_TOSS_LAYOUT_CONFIG.playerScale,
    team: userSide ? 'offense' : 'defense',
    teamSide: captain.team,
    zoneId: userSide ? 'user-sideline' : 'opponent-sideline',
  };
}

function createCoinTossOfficial(): OfficialModel {
  const position = { x: 0, z: COIN_TOSS_LAYOUT_CONFIG.officialZ };

  return {
    distanceFromBall: Math.abs(COIN_TOSS_LAYOUT_CONFIG.officialZ),
    facingRadians: Math.PI,
    id: 'official-referee',
    poseIntent: 'neutral',
    position,
    role: 'referee',
    targetPosition: position,
    updateState: 'formation',
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
  if (layout.officials.length !== 1) {
    errors.push(`Expected one coin-toss official, received ${layout.officials.length}`);
  }
  for (const placement of layout.captainPlacements) {
    if (Math.abs(placement.position.x) > sidelineLimit) {
      errors.push(`${placement.id} is too close to the sideline`);
    }
  }

  return errors;
}
