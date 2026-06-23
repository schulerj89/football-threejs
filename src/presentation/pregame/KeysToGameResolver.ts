import { formatRosterInitialName, type RosterPlayer } from '../../roster/RosterPlayer';
import type { GameplayRosterBinding } from '../../roster/GameplayRosterBinding';
import {
  createTeamStrengthProfile,
  getTopTeamStrengths,
  type TeamStrengthCategory,
  type TeamStrengthProfile,
  type TeamStrengthScore,
} from '../../teams/TeamStrengthProfile';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';

export interface KeyToGame {
  id: string;
  source: 'matchupPriority' | 'opponentThreat' | 'userStrength';
  supportedCategory: TeamStrengthCategory;
  supportedScore: number;
  text: string;
}

export interface KeysToGameContext {
  rosterBinding: GameplayRosterBinding;
  teamTheme: TeamPresentationTheme;
}

const USER_STRENGTH_CATEGORIES = [
  'passing',
  'rushing',
  'passProtection',
  'quarterbackMobility',
  'kicking',
  'returnAbility',
] as const satisfies readonly TeamStrengthCategory[];

const OPPONENT_THREAT_CATEGORIES = [
  'passRush',
  'coverage',
  'runDefense',
  'tackling',
] as const satisfies readonly TeamStrengthCategory[];

export function resolveKeysToGame(context: KeysToGameContext): readonly KeyToGame[] {
  const userProfile = createTeamStrengthProfile(context.rosterBinding.userRoster);
  const opponentProfile = createTeamStrengthProfile(context.rosterBinding.opponentRoster);
  const userStrength = getTopTeamStrengths(userProfile, USER_STRENGTH_CATEGORIES, 1)[0];
  const opponentThreat = getTopTeamStrengths(opponentProfile, OPPONENT_THREAT_CATEGORIES, 1)[0];
  const keys = [
    createUserStrengthKey(userStrength, context),
    createOpponentThreatKey(opponentThreat, context),
    createMatchupPriorityKey(userProfile, opponentProfile, context),
  ].filter((key): key is KeyToGame => Boolean(key));

  return ensureThreeKeys(keys, userProfile, opponentProfile, context);
}

function createUserStrengthKey(
  strength: TeamStrengthScore | undefined,
  context: KeysToGameContext,
): KeyToGame | null {
  if (!strength) {
    return null;
  }

  const quarterback = getStartingQuarterback(context.rosterBinding.userRoster.players);
  const qbName = quarterback ? formatRosterInitialName(quarterback) : 'the quarterback';
  const textByCategory: Readonly<Partial<Record<TeamStrengthCategory, string>>> = {
    kicking: 'Trust the kicking game if the drive stalls.',
    passProtection: `Give ${qbName} a clean pocket early.`,
    passing: `Use ${qbName}'s arm to challenge the secondary.`,
    quarterbackMobility: `Let ${qbName} extend plays when coverage holds.`,
    returnAbility: 'Set up field position with clean returns.',
    rushing: 'Stay ahead of the chains with the running game.',
  };

  return {
    id: `user-${strength.category}`,
    source: 'userStrength',
    supportedCategory: strength.category,
    supportedScore: strength.score,
    text: textByCategory[strength.category] ?? 'Lean on the strongest offensive edge.',
  };
}

function createOpponentThreatKey(
  threat: TeamStrengthScore | undefined,
  context: KeysToGameContext,
): KeyToGame | null {
  if (!threat) {
    return null;
  }

  const opponentName = context.teamTheme.defense.profile.shortName ||
    context.teamTheme.defense.profile.displayName;
  const textByCategory: Readonly<Partial<Record<TeamStrengthCategory, string>>> = {
    coverage: `Stay patient against ${opponentName}'s coverage.`,
    passRush: `Protect the pocket against ${opponentName}'s rush.`,
    runDefense: 'Use angles to soften a strong defensive front.',
    tackling: 'Finish runs before the defense rallies.',
  };

  return {
    id: `opponent-${threat.category}`,
    source: 'opponentThreat',
    supportedCategory: threat.category,
    supportedScore: threat.score,
    text: textByCategory[threat.category] ?? 'Account for the opponent threat.',
  };
}

function createMatchupPriorityKey(
  userProfile: TeamStrengthProfile,
  opponentProfile: TeamStrengthProfile,
  context: KeysToGameContext,
): KeyToGame {
  const matchups = [
    {
      category: 'passing' as const,
      score: userProfile.scores.passing.score - opponentProfile.scores.coverage.score,
      text: 'Attack through the air before coverage settles.',
    },
    {
      category: 'passProtection' as const,
      score: userProfile.scores.passProtection.score - opponentProfile.scores.passRush.score,
      text: 'Use quick throws to avoid long-yardage trouble.',
    },
    {
      category: 'rushing' as const,
      score: userProfile.scores.rushing.score - opponentProfile.scores.runDefense.score,
      text: 'Keep early downs manageable with steady runs.',
    },
  ].sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || a.category.localeCompare(b.category));
  const matchup = matchups[0];
  const fallbackTeam = context.teamTheme.offense.profile.shortName ||
    context.teamTheme.offense.profile.displayName;

  return {
    id: `matchup-${matchup.category}`,
    source: 'matchupPriority',
    supportedCategory: matchup.category,
    supportedScore: userProfile.scores[matchup.category].score,
    text: matchup.text || `${fallbackTeam} must avoid negative plays.`,
  };
}

function ensureThreeKeys(
  keys: readonly KeyToGame[],
  userProfile: TeamStrengthProfile,
  opponentProfile: TeamStrengthProfile,
  context: KeysToGameContext,
): readonly KeyToGame[] {
  const result: KeyToGame[] = [];
  const usedText = new Set<string>();
  for (const key of keys) {
    if (!usedText.has(key.text)) {
      result.push(key);
      usedText.add(key.text);
    }
  }

  const fallbacks: KeyToGame[] = [
    {
      id: 'fallback-rushing',
      source: 'userStrength',
      supportedCategory: 'rushing',
      supportedScore: userProfile.scores.rushing.score,
      text: 'Stay ahead of the chains with the running game.',
    },
    {
      id: 'fallback-coverage',
      source: 'opponentThreat',
      supportedCategory: 'coverage',
      supportedScore: opponentProfile.scores.coverage.score,
      text: `Respect ${context.teamTheme.defense.profile.shortName}'s secondary.`,
    },
    {
      id: 'fallback-game-management',
      source: 'matchupPriority',
      supportedCategory: 'passProtection',
      supportedScore: userProfile.scores.passProtection.score,
      text: 'Avoid negative plays before the first break.',
    },
  ];

  for (const fallback of fallbacks) {
    if (result.length >= 3) {
      break;
    }
    if (!usedText.has(fallback.text)) {
      result.push(fallback);
      usedText.add(fallback.text);
    }
  }

  return result.slice(0, 3);
}

function getStartingQuarterback(players: readonly RosterPlayer[]): RosterPlayer | null {
  return players.find((player) => player.footballPosition === 'QB') ?? null;
}
