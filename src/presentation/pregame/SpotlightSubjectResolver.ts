import type { GameplaySnapshot } from '../../playState';
import type { PlayerSnapshot } from '../../playerModel';
import type { MatchSnapshot } from '../../match/MatchTypes';
import {
  formatRosterInitialName,
  type FootballPosition,
  type RosterPlayer,
} from '../../roster/RosterPlayer';
import type {
  ActiveLineupBinding,
} from '../../roster/ActiveLineup';
import type {
  GameplayRosterBinding,
} from '../../roster/GameplayRosterBinding';
import type { TeamProfile } from '../../teams/TeamProfile';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';
import type { PregameWarmupSnapshot } from './PregameWarmupTypes';

export interface QuarterbackSpotlightSubject {
  appearanceId: string;
  fallbackReason:
    | 'missingGameplayPlayer'
    | 'missingLineup'
    | 'missingRosterPlayer'
    | 'missingWarmupSubject'
    | null;
  footballPosition: FootballPosition;
  formattedName: string;
  fullName: string;
  gameplayPlayerId: string;
  jerseyNumber: number;
  playerPosition: { x: number; z: number };
  rosterPlayerId: string;
  teamAbbreviation: string;
  teamAccentColor: string;
  teamId: string;
  teamName: string;
}

export interface QuarterbackSpotlightResolutionContext {
  gameplaySnapshot: GameplaySnapshot;
  matchSnapshot: MatchSnapshot | null;
  rosterBinding: GameplayRosterBinding;
  teamTheme: TeamPresentationTheme;
  warmupSnapshot: PregameWarmupSnapshot;
}

const FALLBACK_QB_NUMBER = 0;
const FALLBACK_QB_NAME = 'STARTING QB';
const FALLBACK_GAMEPLAY_QB_ID = 'offense-qb';

export function resolveQuarterbackSpotlightSubject(
  context: QuarterbackSpotlightResolutionContext,
): QuarterbackSpotlightSubject {
  const teamProfile = context.matchSnapshot?.userTeam ?? context.teamTheme.offense.profile;
  const lineupBinding = resolveStartingQuarterbackLineupBinding(context.rosterBinding);
  const rosterPlayer = resolveStartingQuarterbackRosterPlayer(context.rosterBinding, lineupBinding);
  const gameplayPlayer = resolveGameplayQuarterback(context.gameplaySnapshot, lineupBinding);
  const warmupQuarterback = context.warmupSnapshot.quarterback;
  const fallbackReason = resolveFallbackReason(
    lineupBinding,
    rosterPlayer,
    gameplayPlayer,
    warmupQuarterback,
  );
  const position = warmupQuarterback?.bounds.center ??
    gameplayPlayer?.position ??
    context.gameplaySnapshot.nextSnapSpot ??
    context.gameplaySnapshot.currentBallSpot;

  return {
    appearanceId: rosterPlayer?.appearanceId ?? lineupBinding?.rosterPlayerId ?? FALLBACK_GAMEPLAY_QB_ID,
    fallbackReason,
    footballPosition: rosterPlayer?.footballPosition ?? 'QB',
    formattedName: rosterPlayer ? formatRosterInitialName(rosterPlayer) : FALLBACK_QB_NAME,
    fullName: rosterPlayer?.displayName ?? FALLBACK_QB_NAME,
    gameplayPlayerId: lineupBinding?.gameplayPlayerId ?? gameplayPlayer?.id ?? FALLBACK_GAMEPLAY_QB_ID,
    jerseyNumber: rosterPlayer?.jerseyNumber ?? FALLBACK_QB_NUMBER,
    playerPosition: { x: position.x, z: position.z },
    rosterPlayerId: rosterPlayer?.id ?? lineupBinding?.rosterPlayerId ?? 'unknown-starting-qb',
    teamAbbreviation: teamProfile.abbreviation,
    teamAccentColor: resolveTeamAccent(teamProfile, context),
    teamId: rosterPlayer?.teamId ?? context.rosterBinding.userRoster.teamId,
    teamName: teamProfile.displayName,
  };
}

export function createQuarterbackSpotlightMatchKey(
  context: QuarterbackSpotlightResolutionContext,
  subject: QuarterbackSpotlightSubject,
): string {
  return [
    context.matchSnapshot?.deterministicSeed ?? 'pregame',
    context.matchSnapshot?.driveNumber ?? 0,
    subject.teamId,
    subject.rosterPlayerId,
  ].join(':');
}

function resolveStartingQuarterbackLineupBinding(
  binding: GameplayRosterBinding,
): ActiveLineupBinding | null {
  return binding.activeLineup.bindings.find(
    (candidate) => candidate.team === 'offense' && candidate.footballPosition === 'QB',
  ) ?? null;
}

function resolveStartingQuarterbackRosterPlayer(
  binding: GameplayRosterBinding,
  lineupBinding: ActiveLineupBinding | null,
): RosterPlayer | null {
  if (lineupBinding) {
    const player = binding.userRoster.players.find(
      (candidate) => candidate.id === lineupBinding.rosterPlayerId,
    );
    if (player) {
      return player;
    }
  }

  return binding.userRoster.players.find((candidate) => candidate.footballPosition === 'QB') ?? null;
}

function resolveGameplayQuarterback(
  gameplaySnapshot: GameplaySnapshot,
  lineupBinding: ActiveLineupBinding | null,
): PlayerSnapshot | null {
  if (lineupBinding) {
    const lineupPlayer = gameplaySnapshot.players.find(
      (candidate) => candidate.id === lineupBinding.gameplayPlayerId,
    );
    if (lineupPlayer) {
      return lineupPlayer;
    }
  }

  return gameplaySnapshot.players.find(
    (candidate) => candidate.team === 'offense' && candidate.role === 'quarterback',
  ) ?? null;
}

function resolveFallbackReason(
  lineupBinding: ActiveLineupBinding | null,
  rosterPlayer: RosterPlayer | null,
  gameplayPlayer: PlayerSnapshot | null,
  warmupQuarterback: QuarterbackSpotlightResolutionContext['warmupSnapshot']['quarterback'],
): QuarterbackSpotlightSubject['fallbackReason'] {
  if (!lineupBinding) {
    return 'missingLineup';
  }
  if (!rosterPlayer) {
    return 'missingRosterPlayer';
  }
  if (!warmupQuarterback) {
    return 'missingWarmupSubject';
  }
  if (!gameplayPlayer) {
    return 'missingGameplayPlayer';
  }
  return null;
}

function resolveTeamAccent(
  teamProfile: TeamProfile,
  context: QuarterbackSpotlightResolutionContext,
): string {
  return teamProfile.colors.accent ||
    context.teamTheme.offense.uniform.stripe ||
    context.teamTheme.offense.uniform.jersey;
}
