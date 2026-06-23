import type { GameplaySnapshot } from '../playState';
import type { MatchPhase, MatchSnapshot } from '../match/MatchTypes';
import {
  formatPossessionFieldPosition,
  offenseSpotToPossessionFieldPosition,
  type PossessionFieldPosition,
} from '../match/FieldPositionModel';
import type { TeamProfile } from '../teams/TeamProfile';
import { formatYardsToGoForDisplay } from '../yardDisplay';

export interface BroadcastScorebugTeamViewModel {
  readonly abbreviation: string;
  readonly accentColor: string;
  readonly logoUrl: string;
  readonly name: string;
  readonly profile: TeamProfile;
  readonly score: number;
}

export interface BroadcastScorebugViewModel {
  readonly ariaLabel: string;
  readonly ballLocationText: string;
  readonly clockText: string;
  readonly contextMode: 'gameOver' | 'halftime' | 'kickoff' | 'normal' | 'opponent' | 'placeKick' | 'pregame';
  readonly downDistanceText: string;
  readonly liveAnnouncement: string | null;
  readonly opponent: BroadcastScorebugTeamViewModel;
  readonly phase: MatchPhase;
  readonly possession: 'opponent' | 'user';
  readonly possessionText: string;
  readonly quarterText: string;
  readonly user: BroadcastScorebugTeamViewModel;
}

export function createBroadcastScorebugViewModel(
  match: MatchSnapshot,
  gameplay: GameplaySnapshot,
): BroadcastScorebugViewModel {
  const ballLocationText = resolveBallLocationText(match, gameplay);
  const downDistanceText = resolveDownDistanceText(match, gameplay);
  const clockText = match.phase === 'gameOver' ? '0:00' : formatMatchClock(match.clock.remainingSeconds);
  const quarterText = resolveQuarterText(match);
  const possessionText = match.possession === 'user' ? 'USER BALL' : 'OPP BALL';
  const user = createTeamViewModel(match.userTeam, match.userScore);
  const opponent = createTeamViewModel(match.opponentTeam, match.opponentScore);

  return {
    ariaLabel: [
      `${user.name} ${user.score}`,
      `${opponent.name} ${opponent.score}`,
      quarterText,
      clockText,
      downDistanceText,
      ballLocationText,
    ].filter(Boolean).join(', '),
    ballLocationText,
    clockText,
    contextMode: resolveContextMode(match.phase),
    downDistanceText,
    liveAnnouncement: null,
    opponent,
    phase: match.phase,
    possession: match.possession,
    possessionText,
    quarterText,
    user,
  };
}

export function resolveDownDistanceText(
  match: MatchSnapshot,
  gameplay: GameplaySnapshot,
): string {
  if (match.phase === 'gameOver') {
    return 'FINAL';
  }
  if (match.phase === 'halftime') {
    return 'HALFTIME';
  }
  if (match.phase === 'kickoff') {
    return 'KICKOFF';
  }
  if (match.phase === 'extraPoint') {
    return resolvePlaceKickText(match);
  }
  if (match.phase === 'opponentDriveSimulation') {
    return 'SIM DRIVE';
  }
  if (match.phase === 'quarterBreak') {
    return `END Q${match.quarter}`;
  }
  if (match.phase === 'coinToss') {
    return 'COIN TOSS';
  }
  if (match.phase === 'pregame') {
    return 'PREGAME';
  }

  return `${formatDown(gameplay.drive.currentDown)} & ${formatDistance(gameplay.drive.yardsToFirstDown)}`;
}

export function resolveBallLocationText(
  match: MatchSnapshot,
  gameplay: GameplaySnapshot,
): string {
  if (match.phase === 'kickoff') {
    const kickoffPosition = match.kickoff.returnResult?.receivingStartPosition ??
      match.kickoff.result?.receivingStartPosition;
    return kickoffPosition ? formatScorebugFieldPosition(kickoffPosition) : 'KICKOFF';
  }

  if (match.phase === 'extraPoint') {
    return match.extraPoint.reason === 'fieldGoal' ? 'FIELD GOAL' : 'TRY';
  }

  if (match.phase === 'halftime') {
    return 'LOCKER ROOM';
  }

  if (match.phase === 'gameOver') {
    return 'FINAL';
  }

  if (match.phase === 'userPossession') {
    return formatScorebugFieldPosition(
      offenseSpotToPossessionFieldPosition(gameplay.drive.lineOfScrimmage),
    );
  }

  return formatScorebugFieldPosition(match.currentFieldPosition);
}

export function formatMatchClock(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(clamped / 60);
  const remainingSeconds = clamped % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatScorebugFieldPosition(position: PossessionFieldPosition): string {
  const formatted = formatPossessionFieldPosition(position);
  return formatted === 'MIDFIELD' ? '50' : formatted;
}

function createTeamViewModel(profile: TeamProfile, score: number): BroadcastScorebugTeamViewModel {
  return {
    abbreviation: profile.abbreviation,
    accentColor: profile.colors.primary,
    logoUrl: profile.logoUrl,
    name: profile.displayName,
    profile,
    score,
  };
}

function resolveContextMode(phase: MatchPhase): BroadcastScorebugViewModel['contextMode'] {
  if (phase === 'gameOver') {
    return 'gameOver';
  }
  if (phase === 'halftime') {
    return 'halftime';
  }
  if (phase === 'kickoff') {
    return 'kickoff';
  }
  if (phase === 'extraPoint') {
    return 'placeKick';
  }
  if (phase === 'opponentDriveSimulation' || phase === 'quarterBreak') {
    return 'opponent';
  }
  if (phase === 'coinToss' || phase === 'pregame') {
    return 'pregame';
  }
  return 'normal';
}

function resolveQuarterText(match: MatchSnapshot): string {
  if (match.phase === 'gameOver') {
    return 'FINAL';
  }
  if (match.phase === 'halftime') {
    return 'HALF';
  }
  return `Q${match.quarter}`;
}

function resolvePlaceKickText(match: MatchSnapshot): string {
  if (match.extraPoint.reason === 'fieldGoal') {
    return 'FIELD GOAL';
  }
  if (match.extraPoint.phase === 'result' || match.extraPoint.phase === 'completed') {
    return match.extraPoint.result?.good ? 'PAT GOOD' : 'PAT NO GOOD';
  }
  return 'PAT';
}

function formatDown(down: number): string {
  if (down === 1) {
    return '1ST';
  }
  if (down === 2) {
    return '2ND';
  }
  if (down === 3) {
    return '3RD';
  }
  return '4TH';
}

function formatDistance(distance: number): string {
  return formatYardsToGoForDisplay(distance);
}
