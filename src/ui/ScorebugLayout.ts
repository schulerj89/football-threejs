export type ScorebugSafeZoneId =
  | 'ballLocation'
  | 'downDistance'
  | 'gameClock'
  | 'opponentAbbreviation'
  | 'opponentLogo'
  | 'opponentScore'
  | 'opponentTimeouts'
  | 'possession'
  | 'quarter'
  | 'userAbbreviation'
  | 'userLogo'
  | 'userScore'
  | 'userTimeouts';

export interface ScorebugSafeZone {
  readonly id: ScorebugSafeZoneId;
  readonly normalized: {
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  };
}

export interface ScorebugLayoutDefinition {
  readonly imageHeight: 512;
  readonly imageWidth: 1536;
  readonly shellUrl: string;
  readonly safeZones: readonly ScorebugSafeZone[];
}

export const BROADCAST_SCOREBUG_SHELL_URL = '/branding/scorebug/football-js-scorebug-shell.webp';

export const BROADCAST_SCOREBUG_LAYOUT: ScorebugLayoutDefinition = {
  imageHeight: 512,
  imageWidth: 1536,
  shellUrl: BROADCAST_SCOREBUG_SHELL_URL,
  safeZones: [
    safeZone('userLogo', 0.024, 0.119, 0.086, 0.547),
    safeZone('userAbbreviation', 0.135, 0.29, 0.080, 0.20),
    safeZone('userScore', 0.300, 0.10, 0.085, 0.45),
    safeZone('userTimeouts', 0.2825, 0.58, 0.120, 0.085),
    safeZone('opponentScore', 0.615, 0.10, 0.085, 0.45),
    safeZone('opponentTimeouts', 0.5975, 0.58, 0.120, 0.085),
    safeZone('opponentAbbreviation', 0.785, 0.29, 0.080, 0.20),
    safeZone('opponentLogo', 0.890, 0.119, 0.086, 0.547),
    safeZone('quarter', 0.470, 0.17, 0.060, 0.13),
    safeZone('gameClock', 0.450, 0.31, 0.100, 0.14),
    safeZone('possession', 0.209, 0.768, 0.120, 0.17),
    safeZone('downDistance', 0.395, 0.775, 0.180, 0.17),
    safeZone('ballLocation', 0.640, 0.765, 0.160, 0.17),
  ],
};

export function getScorebugSafeZone(id: ScorebugSafeZoneId): ScorebugSafeZone {
  const zone = BROADCAST_SCOREBUG_LAYOUT.safeZones.find((candidate) => candidate.id === id);

  if (!zone) {
    throw new Error(`Missing scorebug safe zone: ${id}`);
  }

  return zone;
}

export function applyScorebugSafeZone(element: HTMLElement, id: ScorebugSafeZoneId): void {
  const { height, width, x, y } = getScorebugSafeZone(id).normalized;
  element.style.left = `${x * 100}%`;
  element.style.top = `${y * 100}%`;
  element.style.width = `${width * 100}%`;
  element.style.height = `${height * 100}%`;
}

function safeZone(
  id: ScorebugSafeZoneId,
  x: number,
  y: number,
  width: number,
  height: number,
): ScorebugSafeZone {
  return {
    id,
    normalized: { height, width, x, y },
  };
}
