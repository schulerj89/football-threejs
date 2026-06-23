export const GAME_SETTINGS_SCHEMA_VERSION = 16;

export interface VersionedGameSettingsEnvelope {
  customSettings?: unknown;
  preset?: unknown;
  settings?: unknown;
  version: number;
}

export function migrateGameSettingsPayload(payload: unknown): VersionedGameSettingsEnvelope | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (payload.version === GAME_SETTINGS_SCHEMA_VERSION) {
    return {
      customSettings: payload.customSettings,
      preset: payload.preset,
      settings: payload.settings,
      version: GAME_SETTINGS_SCHEMA_VERSION,
    };
  }

  return {
    customSettings: migrateOfficialSettings(payload.customSettings),
    preset: payload.preset,
    settings: migrateOfficialSettings(payload.settings),
    version: GAME_SETTINGS_SCHEMA_VERSION,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function migrateOfficialSettings(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const preset = value.preset;
  if (preset === 'broadcast') {
    return {
      ...value,
      announcerVoice: normalizeAnnouncerVoice(value.announcerVoice),
      coachesEnabled: value.coachesEnabled ?? true,
      controlledPlayerLabelEnabled: value.controlledPlayerLabelEnabled ?? true,
      crowdDensity: value.crowdDensity ?? 'medium',
      crowdFullness: migrateCrowdFullness(value.crowdFullness, value.crowdDensity, 'standard'),
      gameMode: value.gameMode ?? 'exhibition',
      matchDifficulty: value.matchDifficulty ?? 'pro',
      menuPlaylistOrder: normalizeMenuPlaylistOrder(value.menuPlaylistOrder),
      musicEnabled: value.musicEnabled ?? true,
      musicVolume: value.musicVolume ?? 0.72,
      debugToolsEnabled: false,
      officialsDebugLabels: false,
      officialsEnabled: false,
      playerVisualMode: value.playerVisualMode === 'meshyRigged' ? 'meshyRigged' : 'procedural',
      quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
      selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
      sidelineDensity: value.sidelineDensity ?? 'medium',
      sidelinePlayersEnabled: value.sidelinePlayersEnabled ?? true,
      tunnelTableauEnabled: value.tunnelTableauEnabled ?? true,
    };
  }

  if (preset === 'performance') {
    return {
      ...value,
      announcerVoice: normalizeAnnouncerVoice(value.announcerVoice),
      coachesEnabled: value.coachesEnabled ?? false,
      controlledPlayerLabelEnabled: value.controlledPlayerLabelEnabled ?? true,
      crowdFullness: migrateCrowdFullness(value.crowdFullness, value.crowdDensity, 'sparse'),
      gameMode: value.gameMode ?? 'exhibition',
      matchDifficulty: value.matchDifficulty ?? 'pro',
      menuPlaylistOrder: normalizeMenuPlaylistOrder(value.menuPlaylistOrder),
      musicEnabled: value.musicEnabled ?? true,
      musicVolume: value.musicVolume ?? 0.72,
      debugToolsEnabled: false,
      officialsDebugLabels: false,
      officialsEnabled: false,
      playerVisualMode: value.playerVisualMode === 'meshyRigged' ? 'meshyRigged' : 'procedural',
      quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
      selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
      sidelineDensity: value.sidelineDensity ?? 'low',
      sidelinePlayersEnabled: value.sidelinePlayersEnabled ?? false,
      tunnelTableauEnabled: value.tunnelTableauEnabled ?? false,
    };
  }

  return {
    ...value,
    announcerVoice: normalizeAnnouncerVoice(value.announcerVoice),
    coachesEnabled: value.coachesEnabled ?? true,
    controlledPlayerLabelEnabled: value.controlledPlayerLabelEnabled ?? true,
    crowdFullness: migrateCrowdFullness(value.crowdFullness, value.crowdDensity, 'standard'),
    gameMode: value.gameMode ?? 'exhibition',
    matchDifficulty: value.matchDifficulty ?? 'pro',
    menuPlaylistOrder: normalizeMenuPlaylistOrder(value.menuPlaylistOrder),
    musicEnabled: value.musicEnabled ?? true,
    musicVolume: value.musicVolume ?? 0.72,
    debugToolsEnabled: false,
    officialsDebugLabels: false,
    officialsEnabled: false,
    playerVisualMode: value.playerVisualMode === 'meshyRigged' ? 'meshyRigged' : 'procedural',
    quarterLengthSeconds: value.quarterLengthSeconds ?? 180,
    selectedReceiverLabelEnabled: value.selectedReceiverLabelEnabled ?? false,
    sidelineDensity: value.sidelineDensity ?? 'medium',
    sidelinePlayersEnabled: value.sidelinePlayersEnabled ?? true,
    tunnelTableauEnabled: value.tunnelTableauEnabled ?? true,
  };
}

function normalizeAnnouncerVoice(value: unknown): 'announcer-a' | 'announcer-b' | 'auto' {
  return value === 'announcer-a' || value === 'announcer-b' ? value : 'auto';
}

function migrateCrowdDensityToFullness(value: unknown): 'full' | 'sparse' | 'standard' {
  if (value === 'high') {
    return 'full';
  }

  if (value === 'medium') {
    return 'standard';
  }

  return 'sparse';
}

function migrateCrowdFullness(
  fullness: unknown,
  density: unknown,
  fallback: 'full' | 'sparse' | 'standard',
): 'adaptive' | 'full' | 'sparse' | 'standard' {
  if (fullness === 'adaptive') {
    return 'adaptive';
  }

  if (fullness === 'full') {
    return fallback === 'standard' ? 'standard' : 'full';
  }

  if (fullness === 'sparse' || fullness === 'standard') {
    return fullness;
  }

  return migrateCrowdDensityToFullness(density) === 'full' ? fallback : migrateCrowdDensityToFullness(density);
}

function normalizeMenuPlaylistOrder(value: unknown): 'sequential' | 'shuffle' {
  return value === 'shuffle' ? 'shuffle' : 'sequential';
}
