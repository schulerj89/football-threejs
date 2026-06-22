import { GAME_BRAND } from '../config/GameBrand';
import {
  createQuarterbackScoutingProfile,
  type QuarterbackArchetype,
} from '../roster/QuarterbackScoutingProfile';
import { listTeamRosters } from '../roster/RosterRegistry';
import type { RosterPlayer } from '../roster/RosterPlayer';
import { getTeamProfile, listTeamProfiles } from '../teams/TeamRegistry';
import type { TeamProfile } from '../teams/TeamProfile';

export type PregameCommentaryCategory =
  | 'coinTossResult'
  | 'coinTossSetup'
  | 'kickoffInFlight'
  | 'kickoffReady'
  | 'kickoffResult'
  | 'matchup'
  | 'quarterback'
  | 'quarterbackArchetype'
  | 'warmupTransition'
  | 'weather'
  | 'welcome';
export type PregameCoinTossOutcome = 'generic' | 'kick' | 'receive';
export type PregameKickoffResultType = 'deepKick' | 'returnedKick' | 'shortKick' | 'touchback';
export type PregameMatchPhaseEligibility = 'coinToss' | 'kickoff' | 'pregame' | 'warmup';
export type PregameWeatherCondition = 'clear' | 'overcast' | 'rain' | 'snow' | 'windy';

export interface PregameCommentaryClip {
  readonly assetId: string;
  readonly awayTeamId?: string;
  readonly caption: string;
  readonly category: PregameCommentaryCategory;
  readonly durationSeconds: number;
  readonly homeTeamId?: string;
  readonly jerseyNumber?: number;
  readonly coinTossOutcome?: PregameCoinTossOutcome;
  readonly kickoffResultType?: PregameKickoffResultType;
  readonly matchPhaseEligibility?: PregameMatchPhaseEligibility;
  readonly priority?: number;
  readonly pronunciation?: string;
  readonly qbArchetype?: QuarterbackArchetype;
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

export interface PregameCoinTossResultSelectionOptions extends PregameCommentarySelectionOptions {
  readonly outcome?: PregameCoinTossOutcome | string | null;
  readonly teamId?: string | null;
}

export interface PregameKickoffResultSelectionOptions extends PregameCommentarySelectionOptions {
  readonly resultType?: PregameKickoffResultType | string | null;
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

const COIN_TOSS_OUTCOMES: readonly PregameCoinTossOutcome[] = [
  'generic',
  'kick',
  'receive',
] as const;

const KICKOFF_RESULT_TYPES: readonly PregameKickoffResultType[] = [
  'deepKick',
  'returnedKick',
  'shortKick',
  'touchback',
] as const;

const QUARTERBACK_PRONUNCIATION: Readonly<Record<string, string>> = {
  'bay-city-current-qb-6': 'DROO BAR-tun',
  'lakefront-lights-qb-8': 'REED HAR-per',
  'metro-meteors-qb-12': 'JAY-len CAR-ter',
  'summit-forge-qb-14': 'SY-rus WORD',
};

const FALLBACK_LINES: Readonly<Record<PregameCommentaryCategory, string>> = {
  coinTossResult: 'The toss is settled, and the opening kickoff is next.',
  coinTossSetup: 'The captains are at midfield for the coin toss.',
  kickoffInFlight: "The kick is away.",
  kickoffReady: "We're just about ready for the opening kickoff.",
  kickoffResult: 'The opening kick is handled, and the offense is coming out.',
  matchup: "Two teams are ready, and we're almost underway.",
  quarterback: 'The starting quarterback has the offense set and ready.',
  quarterbackArchetype: 'The starting quarterback brings a balanced profile into this one.',
  warmupTransition: "Both teams are finishing warmups, and we're getting closer to kickoff.",
  weather: 'Clear conditions over the stadium, and the first snap is close.',
  welcome: `${GAME_BRAND.announcerName} welcomes you to ${GAME_BRAND.title}. The field is set for pregame energy.`,
};

export const PREGAME_COMMENTARY_CATALOG: readonly PregameCommentaryClip[] = [
  ...createWelcomeClips(),
  ...createWarmupTransitionClips(),
  ...createMatchupClips(),
  ...createWeatherClips(),
  ...createQuarterbackClips(),
  ...createQuarterbackArchetypeClips(),
  ...createCoinTossSetupClips(),
  ...createCoinTossResultClips(),
  ...createKickoffReadyClips(),
  ...createKickoffInFlightClips(),
  ...createKickoffResultClips(),
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

export function resolveWarmupTransition(
  options: PregameCommentarySelectionOptions = {},
): PregameCommentarySelection {
  return selectFromCandidates({
    candidates: getPregameClipsByCategory('warmupTransition'),
    category: 'warmupTransition',
    options,
    seedParts: ['warmupTransition'],
  });
}

export function resolveQuarterbackArchetypeLine(
  options: PregameQuarterbackSelectionOptions = {},
): PregameCommentarySelection {
  const rosterPlayerId = options.rosterPlayerId ?? resolveStartingQuarterbackId(options.teamId ?? null);

  if (!rosterPlayerId) {
    return createFallbackSelection('quarterbackArchetype', 'missingContext');
  }

  return selectFromCandidates({
    candidates: PREGAME_COMMENTARY_CATALOG.filter(
      (clip) => clip.category === 'quarterbackArchetype' && clip.rosterPlayerId === rosterPlayerId,
    ),
    category: 'quarterbackArchetype',
    options,
    seedParts: ['quarterbackArchetype', rosterPlayerId],
  });
}

export function resolveCoinTossSetup(
  options: PregameCommentarySelectionOptions = {},
): PregameCommentarySelection {
  return selectFromCandidates({
    candidates: getPregameClipsByCategory('coinTossSetup'),
    category: 'coinTossSetup',
    options,
    seedParts: ['coinTossSetup'],
  });
}

export function resolveCoinTossResult(
  options: PregameCoinTossResultSelectionOptions = {},
): PregameCommentarySelection {
  const outcome = normalizeCoinTossOutcome(options.outcome);
  const teamId = options.teamId ?? null;

  if (teamId) {
    const team = getTeamProfile(teamId);

    if (!team) {
      return createFallbackSelection('coinTossResult', 'unknownContext');
    }

    return selectFromCandidates({
      candidates: PREGAME_COMMENTARY_CATALOG.filter(
        (clip) =>
          clip.category === 'coinTossResult' &&
          clip.teamId === teamId &&
          clip.coinTossOutcome === outcome,
      ),
      category: 'coinTossResult',
      options,
      seedParts: ['coinTossResult', teamId, outcome],
    });
  }

  return selectFromCandidates({
    candidates: PREGAME_COMMENTARY_CATALOG.filter(
      (clip) => clip.category === 'coinTossResult' && clip.coinTossOutcome === 'generic',
    ),
    category: 'coinTossResult',
    options,
    seedParts: ['coinTossResult', outcome],
  });
}

export function resolveKickoffReady(
  options: PregameCommentarySelectionOptions = {},
): PregameCommentarySelection {
  return selectFromCandidates({
    candidates: getPregameClipsByCategory('kickoffReady'),
    category: 'kickoffReady',
    options,
    seedParts: ['kickoffReady'],
  });
}

export function resolveKickoffInFlight(
  options: PregameCommentarySelectionOptions = {},
): PregameCommentarySelection {
  return selectFromCandidates({
    candidates: getPregameClipsByCategory('kickoffInFlight'),
    category: 'kickoffInFlight',
    options,
    seedParts: ['kickoffInFlight'],
  });
}

export function resolveKickoffResult(
  options: PregameKickoffResultSelectionOptions = {},
): PregameCommentarySelection {
  const resultType = normalizeKickoffResultType(options.resultType);

  return selectFromCandidates({
    candidates: PREGAME_COMMENTARY_CATALOG.filter(
      (clip) => clip.category === 'kickoffResult' && clip.kickoffResultType === resultType,
    ),
    category: 'kickoffResult',
    options,
    seedParts: ['kickoffResult', resultType],
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
    if (clip.durationSeconds <= 0 || clip.durationSeconds > 8.5) {
      errors.push(`${clip.scriptId}: duration should stay short for pregame playback`);
    }
    if (containsForbiddenReference(clip.script)) {
      errors.push(`${clip.scriptId}: contains a forbidden real-person or catchphrase reference`);
    }
  }

  if (getPregameClipsByCategory('welcome', catalog).length < 3) {
    errors.push('welcome: expected at least 3 variants');
  }
  if (getPregameClipsByCategory('warmupTransition', catalog).length < 2) {
    errors.push('warmupTransition: expected at least 2 variants');
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

    const archetypeCount = catalog.filter(
      (clip) =>
        clip.category === 'quarterbackArchetype' &&
        clip.rosterPlayerId === quarterback.rosterPlayerId &&
        Boolean(clip.qbArchetype),
    ).length;
    if (archetypeCount < 2) {
      errors.push(`quarterbackArchetype:${quarterback.rosterPlayerId}: expected at least 2 variants`);
    }
  }

  if (getPregameClipsByCategory('coinTossSetup', catalog).length < 2) {
    errors.push('coinTossSetup: expected at least 2 variants');
  }

  const genericCoinTossResults = catalog.filter(
    (clip) => clip.category === 'coinTossResult' && clip.coinTossOutcome === 'generic',
  ).length;
  if (genericCoinTossResults < 2) {
    errors.push('coinTossResult:generic: expected at least 2 variants');
  }

  for (const team of knownTeams) {
    for (const outcome of ['kick', 'receive'] as const) {
      const count = catalog.filter(
        (clip) =>
          clip.category === 'coinTossResult' &&
          clip.teamId === team.id &&
          clip.coinTossOutcome === outcome,
      ).length;
      if (count < 1) {
        errors.push(`coinTossResult:${team.id}:${outcome}: expected at least 1 variant`);
      }
    }
  }

  if (getPregameClipsByCategory('kickoffReady', catalog).length < 3) {
    errors.push('kickoffReady: expected at least 3 variants');
  }
  if (getPregameClipsByCategory('kickoffInFlight', catalog).length < 2) {
    errors.push('kickoffInFlight: expected at least 2 variants');
  }
  for (const resultType of KICKOFF_RESULT_TYPES) {
    const count = catalog.filter(
      (clip) => clip.category === 'kickoffResult' && clip.kickoffResultType === resultType,
    ).length;
    if (count < 2) {
      errors.push(`kickoffResult:${resultType}: expected at least 2 variants`);
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
      5.7,
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
      5.9,
    ),
  ];
}

function createWarmupTransitionClips(): PregameCommentaryClip[] {
  return [
    {
      ...line(
        'pregame_warmup_transition_01',
        'warmupTransition',
        1,
        "Both teams are finishing their warmups, and we're getting closer to kickoff.",
        3.6,
      ),
      matchPhaseEligibility: 'warmup',
      priority: 18,
    },
    {
      ...line(
        'pregame_warmup_transition_02',
        'warmupTransition',
        2,
        'The players are on the field, making their final preparations.',
        3,
      ),
      matchPhaseEligibility: 'warmup',
      priority: 18,
    },
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
    weatherLine('clear', 2, 'A clean clear-weather setup today. No excuses on the opening drive.', 4.4),
    weatherLine('overcast', 1, 'A heavy overcast sky sits over the field. Visibility is steady, but the air feels tight.', 5.2),
    weatherLine('overcast', 2, 'Cloud cover from end zone to end zone. This should be a clean, controlled start.', 3.4),
    weatherLine('rain', 1, 'Light rain in the air. Ball security and short throws matter right away.', 3.3),
    weatherLine('rain', 2, 'A slick football night is forming. The first clean handle will be important.', 3.4),
    weatherLine('snow', 1, 'Snow is drifting through the lights. Footing and patience take on extra value.', 3.4),
    weatherLine('snow', 2, 'Cold snow around the field. The team that stays balanced may settle in fastest.', 3.6),
    weatherLine('windy', 1, 'A firm wind is moving across the field. Timing and trajectory get tested early.', 3.5),
    weatherLine('windy', 2, 'Wind is part of the pregame picture. The offense will want quick, decisive snaps.', 4.9),
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
        4.2,
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
        4.6,
      ),
    ];
  });
}

function createQuarterbackArchetypeClips(): PregameCommentaryClip[] {
  return listKnownStartingQuarterbacks().flatMap((quarterback) => {
    const profile = createQuarterbackScoutingProfile(quarterback.player);
    const scripts = createQuarterbackArchetypeScripts(
      quarterback.player.displayName,
      quarterback.jerseyNumber,
      profile.archetype,
    );

    return scripts.map((script, index) => ({
      ...line(
        `pregame_qb_archetype_${quarterback.rosterPlayerId}_${formatVariant(index + 1)}`,
        'quarterbackArchetype',
        index + 1,
        script.text,
        script.durationSeconds,
      ),
      jerseyNumber: quarterback.jerseyNumber,
      matchPhaseEligibility: 'warmup',
      priority: 32,
      pronunciation: quarterback.pronunciation,
      qbArchetype: profile.archetype,
      rosterPlayerId: quarterback.rosterPlayerId,
      teamId: quarterback.teamId,
    }));
  });
}

function createCoinTossSetupClips(): PregameCommentaryClip[] {
  return [
    {
      ...line(
        'pregame_coin_toss_setup_01',
        'coinTossSetup',
        1,
        'The captains are at midfield for the coin toss.',
        2.8,
      ),
      matchPhaseEligibility: 'coinToss',
      priority: 38,
    },
    {
      ...line(
        'pregame_coin_toss_setup_02',
        'coinTossSetup',
        2,
        "We're ready for the toss at midfield.",
        2.4,
      ),
      matchPhaseEligibility: 'coinToss',
      priority: 38,
    },
  ];
}

function createCoinTossResultClips(): PregameCommentaryClip[] {
  const teamClips = listTeamProfiles().flatMap((team) => [
    coinTossResultLine(
      `pregame_coin_toss_result_${team.id}_receive_01`,
      1,
      `${team.displayName} have won the toss and will receive.`,
      3,
      'receive',
      team.id,
    ),
    coinTossResultLine(
      `pregame_coin_toss_result_${team.id}_kick_01`,
      1,
      `${team.displayName} will kick to begin the game.`,
      2.8,
      'kick',
      team.id,
    ),
  ]);

  return [
    ...teamClips,
    coinTossResultLine(
      'pregame_coin_toss_result_generic_01',
      1,
      'The toss goes to the receiving team.',
      2.5,
      'generic',
    ),
    coinTossResultLine(
      'pregame_coin_toss_result_generic_02',
      2,
      'The kicking team will open this one by sending it away.',
      3.1,
      'generic',
    ),
  ];
}

function createKickoffReadyClips(): PregameCommentaryClip[] {
  return [
    kickoffLine(
      'pregame_kickoff_ready_01',
      'kickoffReady',
      1,
      'The teams are getting set for the opening kickoff.',
      2.8,
    ),
    kickoffLine(
      'pregame_kickoff_ready_02',
      'kickoffReady',
      2,
      "We're just about ready to kick this one off.",
      2.7,
    ),
    kickoffLine(
      'pregame_kickoff_ready_03',
      'kickoffReady',
      3,
      'The ball is on the tee, and the opening kick is moments away.',
      3.4,
    ),
  ];
}

function createKickoffInFlightClips(): PregameCommentaryClip[] {
  return [
    kickoffLine('pregame_kickoff_in_flight_01', 'kickoffInFlight', 1, 'The kick is away.', 1.5),
    kickoffLine('pregame_kickoff_in_flight_02', 'kickoffInFlight', 2, "And we're underway.", 1.6),
  ];
}

function createKickoffResultClips(): PregameCommentaryClip[] {
  return [
    kickoffResultLine(
      'pregame_kickoff_result_touchback_01',
      1,
      'This one carries into the end zone for a touchback.',
      2.9,
      'touchback',
    ),
    kickoffResultLine(
      'pregame_kickoff_result_touchback_02',
      2,
      'No return here. The offense will start after the touchback.',
      3.1,
      'touchback',
    ),
    kickoffResultLine(
      'pregame_kickoff_result_returned_kick_01',
      1,
      'The return sets the offense up with decent field position.',
      3,
      'returnedKick',
    ),
    kickoffResultLine(
      'pregame_kickoff_result_returned_kick_02',
      2,
      'The return is handled cleanly, and the offense is coming out.',
      3.2,
      'returnedKick',
    ),
    kickoffResultLine(
      'pregame_kickoff_result_short_kick_01',
      1,
      'A shorter kick gives the return team a chance to set up quickly.',
      3.4,
      'shortKick',
    ),
    kickoffResultLine(
      'pregame_kickoff_result_short_kick_02',
      2,
      'The kick comes down short, and the return coverage has to close fast.',
      3.5,
      'shortKick',
    ),
    kickoffResultLine(
      'pregame_kickoff_result_deep_kick_01',
      1,
      'A deep kick drives the returner back toward the goal line.',
      3,
      'deepKick',
    ),
    kickoffResultLine(
      'pregame_kickoff_result_deep_kick_02',
      2,
      'That kick has plenty of distance, and the coverage is moving downhill.',
      3.5,
      'deepKick',
    ),
  ];
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

function coinTossResultLine(
  scriptId: string,
  variant: number,
  script: string,
  durationSeconds: number,
  outcome: PregameCoinTossOutcome,
  teamId?: string,
): PregameCommentaryClip {
  return {
    ...line(scriptId, 'coinTossResult', variant, script, durationSeconds),
    coinTossOutcome: outcome,
    matchPhaseEligibility: 'coinToss',
    priority: 42,
    teamId,
  };
}

function kickoffLine(
  scriptId: string,
  category: Extract<PregameCommentaryCategory, 'kickoffInFlight' | 'kickoffReady'>,
  variant: number,
  script: string,
  durationSeconds: number,
): PregameCommentaryClip {
  return {
    ...line(scriptId, category, variant, script, durationSeconds),
    matchPhaseEligibility: 'kickoff',
    priority: category === 'kickoffInFlight' ? 46 : 44,
  };
}

function kickoffResultLine(
  scriptId: string,
  variant: number,
  script: string,
  durationSeconds: number,
  resultType: PregameKickoffResultType,
): PregameCommentaryClip {
  return {
    ...line(scriptId, 'kickoffResult', variant, script, durationSeconds),
    kickoffResultType: resultType,
    matchPhaseEligibility: 'kickoff',
    priority: 40,
  };
}

function createQuarterbackArchetypeScripts(
  displayName: string,
  jerseyNumber: number,
  archetype: QuarterbackArchetype,
): Array<{ durationSeconds: number; text: string }> {
  switch (archetype) {
    case 'Scrambler':
      return [
        {
          durationSeconds: 5.9,
          text: `${displayName}, number ${jerseyNumber}, can hurt a defense with his arm or his legs. Keeping him contained is the challenge.`,
        },
        {
          durationSeconds: 4.8,
          text: `When the play breaks down, ${displayName}, number ${jerseyNumber}, can create something on his own.`,
        },
      ];
    case 'Strong Arm':
      return [
        {
          durationSeconds: 5.9,
          text: `${displayName}, number ${jerseyNumber}, has the throw power to stretch the field. The defense has to respect that arm.`,
        },
        {
          durationSeconds: 6.8,
          text: `That throwing arm is the strength for ${displayName}, number ${jerseyNumber}. Expect this offense to test space downfield.`,
        },
      ];
    case 'Field General':
      return [
        {
          durationSeconds: 5.6,
          text: `${displayName}, number ${jerseyNumber}, does his best work reading the field and putting the football in the right place.`,
        },
        {
          durationSeconds: 8.2,
          text: `For ${displayName}, number ${jerseyNumber}, accuracy is the calling card. The ball needs to come out on schedule.`,
        },
      ];
    case 'Balanced':
      return [
        {
          durationSeconds: 5.7,
          text: `${displayName}, number ${jerseyNumber}, gives this offense several ways to win. They'll need that balance today.`,
        },
        {
          durationSeconds: 6.5,
          text: `With ${displayName}, number ${jerseyNumber}, the offense can lean on arm talent, accuracy, or movement when needed.`,
        },
      ];
  }
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

function normalizeCoinTossOutcome(value: PregameCoinTossResultSelectionOptions['outcome']): PregameCoinTossOutcome {
  return COIN_TOSS_OUTCOMES.includes(value as PregameCoinTossOutcome)
    ? value as PregameCoinTossOutcome
    : 'generic';
}

function normalizeKickoffResultType(
  value: PregameKickoffResultSelectionOptions['resultType'],
): PregameKickoffResultType {
  return KICKOFF_RESULT_TYPES.includes(value as PregameKickoffResultType)
    ? value as PregameKickoffResultType
    : 'returnedKick';
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
