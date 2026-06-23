export type ScorebugSafeZoneId =
  | 'ballLocation'
  | 'downDistance'
  | 'gameClock'
  | 'opponentAbbreviation'
  | 'opponentLogo'
  | 'opponentScore'
  | 'possession'
  | 'quarter'
  | 'userAbbreviation'
  | 'userLogo'
  | 'userScore';

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
    safeZone('userLogo', 0.035, 0.18, 0.075, 0.30),
    safeZone('userAbbreviation', 0.12, 0.23, 0.11, 0.22),
    safeZone('userScore', 0.24, 0.17, 0.10, 0.35),
    safeZone('opponentScore', 0.60, 0.17, 0.10, 0.35),
    safeZone('opponentLogo', 0.70, 0.18, 0.075, 0.30),
    safeZone('opponentAbbreviation', 0.785, 0.23, 0.12, 0.22),
    safeZone('quarter', 0.435, 0.18, 0.06, 0.18),
    safeZone('gameClock', 0.505, 0.18, 0.08, 0.18),
    safeZone('possession', 0.045, 0.67, 0.08, 0.18),
    safeZone('downDistance', 0.15, 0.65, 0.20, 0.20),
    safeZone('ballLocation', 0.37, 0.65, 0.18, 0.20),
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
