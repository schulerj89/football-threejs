import { GAME_BRAND } from '../config/GameBrand';
import { listTeamRosters } from '../roster/RosterRegistry';
import type { RosterPlayer } from '../roster/RosterPlayer';
import { getTeamProfile, listTeamProfiles } from '../teams/TeamRegistry';
import type { TeamProfile } from '../teams/TeamProfile';

export type PregameCommentaryCategory = 'matchup' | 'quarterback' | 'weather' | 'welcome';
export type PregameWeatherCondition = 'clear' | 'overcast' | 'rain' | 'snow' | 'windy';

export interface PregameCommentaryClip {
  readonly assetId: string;
  readonly awayTeamId?: string;
  readonly caption: string;
  readonly category: PregameCommentaryCategory;
  readonly durationSeconds: number;
  readonly homeTeamId?: string;
  readonly jerseyNumber?: number;
  readonly pronunciation?: string;
  readonly rosterPlayerId?: string;
  readonly script: string;
  readonly scriptId: string;
  readonly teamId?: string;
  readonly variant: number;
  readonly weatherCondition?: PregameWeatherCondition;
}

export interface PregameCommentarySelectionOptions {
  readonly availableAssetIds?: ReadonlySet<string> | readonly string[];
  readonly matchSeed?: number | string;
  readonly previousScriptId?: string | null;
}

export interface PregameMatchupSelectionOptions extends PregameCommentarySelectionOptions {
  readonly awayTeamId?: string | null;
  readonly homeTeamId?: string | null;
}

export interface PregameWeatherSelectionOptions extends PregameCommentarySelectionOptions {
  readonly condition?: PregameWeatherCondition | string | null;
}

export interface PregameQuarterbackSelectionOptions extends PregameCommentarySelectionOptions {
  readonly rosterPlayerId?: string | null;
  readonly teamId?: string | null;
}

export interface PregameCommentarySelection {
  readonly assetId: string | null;
  readonly available: boolean;
  readonly caption: string;
  readonly clip: PregameCommentaryClip | null;
  readonly fallbackReason: 'missingAssets' | 'missingContext' | 'unknownContext' | null;
  readonly script: string;
  readonly scriptId: string;
}

export interface PregameQuarterbackProfile {
  readonly jerseyNumber: number;
  readonly pronunciation?: string;
  readonly rosterPlayerId: string;
  readonly teamId: string;
  readonly player: RosterPlayer;
}

const WEATHER_CONDITIONS: readonly PregameWeatherCondition[] = [
  'clear',
  'overcast',
  'rain',
  'snow',
  'windy',
] as const;

const QUARTERBACK_PRONUNCIATION: Readonly<Record<string, string>> = {
  'bay-city-current-qb-6': 'DROO BAR-tun',
  'lakefront-lights-qb-8': 'REED HAR-per',
  'metro-meteors-qb-12': 'JAY-len CAR-ter',
  'summit-forge-qb-14': 'SY-rus WORD',
};

const FALLBACK_LINES: Readonly<Record<PregameCommentaryCategory, string>> = {
  matchup: "Two teams are ready, and we're almost underway.",
  quarterback: 'The starting quarterback has the offense set and ready.',
  weather: 'Clear conditions over the stadium, and the first snap is close.',
  welcome: `${GAME_BRAND.announcerName} welcomes you to ${GAME_BRAND.title}. The field is set for pregame energy.`,
};

export const PREGAME_COMMENTARY_CATALOG: readonly PregameCommentaryClip[] = [
  ...createWelcomeClips(),
  ...createMatchupClips(),
  ...createWeatherClips(),
  ...createQuarterbackClips(),
] as const;

export function resolvePregameWelcome(
  options: PregameCommentarySelectionOptions = {},
): PregameCommentarySelection {
  return selectFromCandidates({
    candidates: getPregameClipsByCategory('welcome'),
    category: 'welcome',
    options,
    seedParts: ['welcome'],
  });
}

export function resolveMatchupLine(
  options: PregameMatchupSelectionOptions,
): PregameCommentarySelection {
  const awayTeamId = options.awayTeamId ?? null;
  const homeTeamId = options.homeTeamId ?? null;

  if (!awayTeamId || !homeTeamId || awayTeamId === homeTeamId) {
    return createFallbackSelection('matchup', 'missingContext');
  }

  const awayTeam = getTeamProfile(awayTeamId);
  const homeTeam = getTeamProfile(homeTeamId);

  if (!awayTeam || !homeTeam) {
    return createFallbackSelection('matchup', 'unknownContext');
  }

  return selectFromCandidates({
    candidates: PREGAME_COMMENTARY_CATALOG.filter(
      (clip) =>
        clip.category === 'matchup' &&
        clip.awayTeamId === awayTeamId &&
        clip.homeTeamId === homeTeamId,
    ),
    category: 'matchup',
    options,
    seedParts: ['matchup', awayTeamId, homeTeamId],
  });
}

export function resolveWeatherLine(
  options: PregameWeatherSelectionOptions = {},
): PregameCommentarySelection {
  const condition = normalizeWeatherCondition(options.condition);

  return selectFromCandidates({
    candidates: PREGAME_COMMENTARY_CATALOG.filter(
      (clip) => clip.category === 'weather' && clip.weatherCondition === condition,
    ),
    category: 'weather',
    options,
    seedParts: ['weather', condition],
  });
}

export function resolveQuarterbackSpotlight(
  options: PregameQuarterbackSelectionOptions = {},
): PregameCommentarySelection {
  const rosterPlayerId = options.rosterPlayerId ?? resolveStartingQuarterbackId(options.teamId ?? null);

  if (!rosterPlayerId) {
    return createFallbackSelection('quarterback', 'missingContext');
  }

  return selectFromCandidates({
    candidates: PREGAME_COMMENTARY_CATALOG.filter(
      (clip) => clip.category === 'quarterback' && clip.rosterPlayerId === rosterPlayerId,
    ),
    category: 'quarterback',
    options,
    seedParts: ['quarterback', rosterPlayerId],
  });
}

export function getPregameClipsByCategory(
  category: PregameCommentaryCategory,
  catalog: readonly PregameCommentaryClip[] = PREGAME_COMMENTARY_CATALOG,
): readonly PregameCommentaryClip[] {
  return catalog.filter((clip) => clip.category === category);
}

export function listKnownStartingQuarterbacks(): readonly PregameQuarterbackProfile[] {
  const quarterbacks: PregameQuarterbackProfile[] = [];

  for (const roster of listTeamRosters()) {
    const player = roster.players.find((candidate) => candidate.footballPosition === 'QB');

    if (!player) {
      continue;
    }

    quarterbacks.push({
      jerseyNumber: player.jerseyNumber,
      player,
      pronunciation: QUARTERBACK_PRONUNCIATION[player.id],
      rosterPlayerId: player.id,
      teamId: roster.teamId,
    });
  }

  return quarterbacks;
}

export function validatePregameCommentaryCatalog(
  catalog: readonly PregameCommentaryClip[] = PREGAME_COMMENTARY_CATALOG,
): string[] {
  const errors: string[] = [];
  const scriptIds = new Set<string>();
  const assetIds = new Set<string>();
  const knownTeams = listTeamProfiles();
  const quarterbacks = listKnownStartingQuarterbacks();

  for (const clip of catalog) {
    if (scriptIds.has(clip.scriptId)) {
      errors.push(`${clip.scriptId}: duplicate script ID`);
    }
    scriptIds.add(clip.scriptId);

    if (assetIds.has(clip.assetId)) {
      errors.push(`${clip.assetId}: duplicate asset ID`);
    }
    assetIds.add(clip.assetId);

    if (clip.caption !== clip.script) {
      errors.push(`${clip.scriptId}: caption must exactly match script`);
    }
    if (clip.durationSeconds <= 0 || clip.durationSeconds > 5) {
      errors.push(`${clip.scriptId}: duration should stay near the 1-4 second target`);
    }
    if (containsForbiddenReference(clip.script)) {
      errors.push(`${clip.scriptId}: contains a forbidden real-person or catchphrase reference`);
    }
  }

  if (getPregameClipsByCategory('welcome', catalog).length < 3) {
    errors.push('welcome: expected at least 3 variants');
  }

  for (const awayTeam of knownTeams) {
    for (const homeTeam of knownTeams) {
      if (awayTeam.id === homeTeam.id) {
        continue;
      }
      const count = catalog.filter(
        (clip) =>
          clip.category === 'matchup' &&
          clip.awayTeamId === awayTeam.id &&
          clip.homeTeamId === homeTeam.id,
      ).length;
      if (count < 2) {
        errors.push(`matchup:${awayTeam.id}:${homeTeam.id}: expected at least 2 variants`);
      }
    }
  }

  for (const condition of WEATHER_CONDITIONS) {
    const count = catalog.filter(
      (clip) => clip.category === 'weather' && clip.weatherCondition === condition,
    ).length;
    if (count < 2) {
      errors.push(`weather:${condition}: expected at least 2 variants`);
    }
  }

  for (const quarterback of quarterbacks) {
    const count = catalog.filter(
      (clip) => clip.category === 'quarterback' && clip.rosterPlayerId === quarterback.rosterPlayerId,
    ).length;
    if (count < 3) {
      errors.push(`quarterback:${quarterback.rosterPlayerId}: expected at least 3 variants`);
    }
  }

  return errors;
}

function createWelcomeClips(): PregameCommentaryClip[] {
  return [
    line(
      'pregame_welcome_01',
      'welcome',
      1,
      `${GAME_BRAND.announcerName} welcomes you to ${GAME_BRAND.title}. The lights are up, and the opening possession is next.`,
      4,
    ),
    line(
      'pregame_welcome_02',
      'welcome',
      2,
      `This is ${GAME_BRAND.title}, with ${GAME_BRAND.announcerName} on the call. The offense is moments from the first snap.`,
      4.2,
    ),
    line(
      'pregame_welcome_03',
      'welcome',
      3,
      `${GAME_BRAND.announcerName} is set for pregame energy in ${GAME_BRAND.title}. The stadium is ready, and so are we.`,
      4.1,
    ),
  ];
}

function createMatchupClips(): PregameCommentaryClip[] {
  const clips: PregameCommentaryClip[] = [];
  const teams = listTeamProfiles();

  for (const awayTeam of teams) {
    for (const homeTeam of teams) {
      if (awayTeam.id === homeTeam.id) {
        continue;
      }

      clips.push(
        matchupLine(
          awayTeam,
          homeTeam,
          1,
          `${awayTeam.displayName} line up across from ${homeTeam.displayName}. The first possession should tell us plenty.`,
          4,
        ),
        matchupLine(
          awayTeam,
          homeTeam,
          2,
          `${awayTeam.shortName} against ${homeTeam.shortName}. Clean execution early could tilt this one fast.`,
          3.8,
        ),
      );
    }
  }

  return clips;
}

function createWeatherClips(): PregameCommentaryClip[] {
  return [
    weatherLine('clear', 1, 'Clear conditions over the stadium. The offense can use the full play sheet from the start.', 3.8),
    weatherLine('clear', 2, 'A clean clear-weather setup today. No excuses on the opening drive.', 3),
    weatherLine('overcast', 1, 'A heavy overcast sky sits over the field. Visibility is steady, but the air feels tight.', 3.7),
    weatherLine('overcast', 2, 'Cloud cover from end zone to end zone. This should be a clean, controlled start.', 3.4),
    weatherLine('rain', 1, 'Light rain in the air. Ball security and short throws matter right away.', 3.3),
    weatherLine('rain', 2, 'A slick football night is forming. The first clean handle will be important.', 3.4),
    weatherLine('snow', 1, 'Snow is drifting through the lights. Footing and patience take on extra value.', 3.4),
    weatherLine('snow', 2, 'Cold snow around the field. The team that stays balanced may settle in fastest.', 3.6),
    weatherLine('windy', 1, 'A firm wind is moving across the field. Timing and trajectory get tested early.', 3.5),
    weatherLine('windy', 2, 'Wind is part of the pregame picture. The offense will want quick, decisive snaps.', 3.6),
  ];
}

function createQuarterbackClips(): PregameCommentaryClip[] {
  return listKnownStartingQuarterbacks().flatMap((quarterback) => {
    const player = quarterback.player;
    const number = player.jerseyNumber;
    const name = player.displayName;

    return [
      quarterbackLine(
        quarterback,
        1,
        `${name}, number ${number}, leads this offense with the first snap coming.`,
        3,
      ),
      quarterbackLine(
        quarterback,
        2,
        `Keep an eye on ${name}, number ${number}. The read comes fast in this system.`,
        3.3,
      ),
      quarterbackLine(
        quarterback,
        3,
        `${name}, number ${number}, starts under center with a chance to set the tone.`,
        3.3,
      ),
    ];
  });
}

function matchupLine(
  awayTeam: TeamProfile,
  homeTeam: TeamProfile,
  variant: number,
  script: string,
  durationSeconds: number,
): PregameCommentaryClip {
  return {
    ...line(
      `pregame_matchup_${awayTeam.id}_${homeTeam.id}_${formatVariant(variant)}`,
      'matchup',
      variant,
      script,
      durationSeconds,
    ),
    awayTeamId: awayTeam.id,
    homeTeamId: homeTeam.id,
  };
}

function weatherLine(
  condition: PregameWeatherCondition,
  variant: number,
  script: string,
  durationSeconds: number,
): PregameCommentaryClip {
  return {
    ...line(
      `pregame_weather_${condition}_${formatVariant(variant)}`,
      'weather',
      variant,
      script,
      durationSeconds,
    ),
    weatherCondition: condition,
  };
}

function quarterbackLine(
  quarterback: PregameQuarterbackProfile,
  variant: number,
  script: string,
  durationSeconds: number,
): PregameCommentaryClip {
  return {
    ...line(
      `pregame_qb_${quarterback.rosterPlayerId}_${formatVariant(variant)}`,
      'quarterback',
      variant,
      script,
      durationSeconds,
    ),
    jerseyNumber: quarterback.jerseyNumber,
    pronunciation: quarterback.pronunciation,
    rosterPlayerId: quarterback.rosterPlayerId,
    teamId: quarterback.teamId,
  };
}

function line(
  scriptId: string,
  category: PregameCommentaryCategory,
  variant: number,
  script: string,
  durationSeconds: number,
): PregameCommentaryClip {
  return {
    assetId: scriptId,
    caption: script,
    category,
    durationSeconds,
    script,
    scriptId,
    variant,
  };
}

function selectFromCandidates(options: {
  candidates: readonly PregameCommentaryClip[];
  category: PregameCommentaryCategory;
  options: PregameCommentarySelectionOptions;
  seedParts: readonly string[];
}): PregameCommentarySelection {
  const availableAssetIds = normalizeAvailableAssetIds(options.options.availableAssetIds);
  const availableCandidates = availableAssetIds
    ? options.candidates.filter((clip) => availableAssetIds.has(clip.assetId))
    : options.candidates;

  if (options.candidates.length === 0) {
    return createFallbackSelection(options.category, 'unknownContext');
  }
  if (availableCandidates.length === 0) {
    return createFallbackSelection(options.category, 'missingAssets');
  }

  const seed = [
    options.options.matchSeed ?? 'pregame',
    ...options.seedParts,
  ].join(':');
  let index = stableHash(seed) % availableCandidates.length;
  let clip = availableCandidates[index];

  if (clip.scriptId === options.options.previousScriptId && availableCandidates.length > 1) {
    index = (index + 1) % availableCandidates.length;
    clip = availableCandidates[index];
  }

  return {
    assetId: clip.assetId,
    available: true,
    caption: clip.caption,
    clip,
    fallbackReason: null,
    script: clip.script,
    scriptId: clip.scriptId,
  };
}

function createFallbackSelection(
  category: PregameCommentaryCategory,
  fallbackReason: PregameCommentarySelection['fallbackReason'],
): PregameCommentarySelection {
  const script = FALLBACK_LINES[category];

  return {
    assetId: null,
    available: false,
    caption: script,
    clip: null,
    fallbackReason,
    script,
    scriptId: `pregame_${category}_fallback`,
  };
}

function normalizeAvailableAssetIds(
  value: PregameCommentarySelectionOptions['availableAssetIds'],
): ReadonlySet<string> | null {
  if (!value) {
    return null;
  }

  return value instanceof Set ? value : new Set(value);
}

function normalizeWeatherCondition(value: PregameWeatherSelectionOptions['condition']): PregameWeatherCondition {
  return WEATHER_CONDITIONS.includes(value as PregameWeatherCondition)
    ? value as PregameWeatherCondition
    : 'clear';
}

function resolveStartingQuarterbackId(teamId: string | null): string | null {
  const quarterbacks = listKnownStartingQuarterbacks();

  if (teamId) {
    return quarterbacks.find((quarterback) => quarterback.teamId === teamId)?.rosterPlayerId ?? null;
  }

  return quarterbacks[0]?.rosterPlayerId ?? null;
}

function formatVariant(variant: number): string {
  return String(variant).padStart(2, '0');
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function containsForbiddenReference(script: string): boolean {
  return [
    /\bAl Michaels\b/i,
    /\bJoe Buck\b/i,
    /\bJim Nantz\b/i,
    /\bTony Romo\b/i,
    /\bTroy Aikman\b/i,
    /\bMike Tirico\b/i,
    /\bKevin Harlan\b/i,
    /\bChris Berman\b/i,
    /\bPat Summerall\b/i,
    /\bCollinsworth\b/i,
    /\bBoomer\b/i,
    /\bdo you believe in miracles\b/i,
    /\bthe frozen tundra\b/i,
  ].some((pattern) => pattern.test(script));
}
