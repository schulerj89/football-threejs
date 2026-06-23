export type UniformVariant = 'away' | 'home';

export interface UniformPalette {
  faceguard: string;
  helmetShell: string;
  jersey: string;
  number: string;
  pants: string;
  shoe: string;
  shoulder: string;
  socks: string;
  stripe: string;
}

export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value);
}

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback.toLowerCase();
  }

  const candidate = value.startsWith('#') ? value : `#${value}`;

  return HEX_COLOR_PATTERN.test(candidate)
    ? candidate.toLowerCase()
    : fallback.toLowerCase();
}

export function hexToNumber(value: string): number {
  return Number.parseInt(value.replace('#', ''), 16);
}

export function resolveDistinctHelmetFaceguardColor(
  helmetShell: string,
  requestedFaceguard: string,
): string {
  const shell = normalizeHexColor(helmetShell, '#2f66d8');
  const faceguard = normalizeHexColor(requestedFaceguard, '#f3f5f8');

  if (calculateHexDistance(shell, faceguard) >= 24) {
    return faceguard;
  }

  return calculateRelativeLuminance(shell) > 0.42 ? '#24282e' : '#f3f5f8';
}

export function normalizeUniformPalette(
  value: Partial<UniformPalette> | undefined,
  fallback: UniformPalette,
): UniformPalette {
  return {
    faceguard: normalizeHexColor(value?.faceguard, fallback.faceguard),
    helmetShell: normalizeHexColor(value?.helmetShell, fallback.helmetShell),
    jersey: normalizeHexColor(value?.jersey, fallback.jersey),
    number: normalizeHexColor(value?.number, fallback.number),
    pants: normalizeHexColor(value?.pants, fallback.pants),
    shoe: normalizeHexColor(value?.shoe, fallback.shoe),
    shoulder: normalizeHexColor(value?.shoulder, fallback.shoulder),
    socks: normalizeHexColor(value?.socks, fallback.socks),
    stripe: normalizeHexColor(value?.stripe, fallback.stripe),
  };
}

export function serializeUniformPalette(palette: UniformPalette): string {
  return [
    palette.jersey,
    palette.shoulder,
    palette.pants,
    palette.stripe,
    palette.helmetShell,
    palette.faceguard,
    palette.socks,
    palette.shoe,
    palette.number,
  ].join('|');
}

function calculateHexDistance(hexA: string, hexB: string): number {
  const a = decomposeHex(hexA);
  const b = decomposeHex(hexB);
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function calculateRelativeLuminance(hex: string): number {
  const color = decomposeHex(hex);
  return [color.r, color.g, color.b]
    .map((component) => {
      const normalized = component / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, component, index) => {
      const coefficients = [0.2126, 0.7152, 0.0722];
      return sum + component * (coefficients[index] ?? 0);
    }, 0);
}

function decomposeHex(hex: string): { b: number; g: number; r: number } {
  const value = hexToNumber(hex);
  return {
    b: value & 0xff,
    g: (value >> 8) & 0xff,
    r: (value >> 16) & 0xff,
  };
}
