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
