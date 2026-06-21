import type { PlayerTeam } from '../playerModel';
import {
  resolveCustomizedTeamProfile,
  type TeamProfileSettings,
} from './TeamProfileStore';
import type { TeamProfile } from './TeamProfile';
import {
  hexToNumber,
  serializeUniformPalette,
  type UniformPalette,
} from './UniformPalette';

export interface TeamUniformTheme {
  profile: TeamProfile;
  uniform: UniformPalette;
}

export interface TeamPresentationTheme {
  crowdAccentColors: readonly string[];
  defense: TeamUniformTheme;
  offense: TeamUniformTheme;
  similarityWarning: string | null;
  teamKey: string;
  uniforms: Record<PlayerTeam, UniformPalette>;
}

const SIMILARITY_WARNING_THRESHOLD = 92;

export function resolveTeamPresentationTheme(
  settings: TeamProfileSettings,
): TeamPresentationTheme {
  const offenseProfile = resolveCustomizedTeamProfile(settings.userTeamId, settings);
  const defenseProfile = resolveCustomizedTeamProfile(settings.opponentTeamId, settings);
  const offenseUniform = settings.userUniform === 'away'
    ? offenseProfile.awayUniform
    : offenseProfile.homeUniform;
  const defenseUniform = settings.opponentUniform === 'away'
    ? defenseProfile.awayUniform
    : defenseProfile.homeUniform;
  const teamKey = [
    offenseProfile.id,
    settings.userUniform,
    serializeUniformPalette(offenseUniform),
    defenseProfile.id,
    settings.opponentUniform,
    serializeUniformPalette(defenseUniform),
  ].join('::');

  return {
    crowdAccentColors: [
      offenseProfile.crowdAccentColor,
      defenseProfile.crowdAccentColor,
      offenseProfile.colors.secondary,
      defenseProfile.colors.secondary,
    ],
    defense: {
      profile: defenseProfile,
      uniform: defenseUniform,
    },
    offense: {
      profile: offenseProfile,
      uniform: offenseUniform,
    },
    similarityWarning: createTeamSimilarityWarning(
      offenseProfile.displayName,
      offenseUniform,
      defenseProfile.displayName,
      defenseUniform,
    ),
    teamKey,
    uniforms: {
      defense: defenseUniform,
      offense: offenseUniform,
    },
  };
}

export function createTeamSimilarityWarning(
  userTeamName: string,
  userUniform: UniformPalette,
  opponentTeamName: string,
  opponentUniform: UniformPalette,
): string | null {
  const jerseyDistance = calculateHexColorDistance(userUniform.jersey, opponentUniform.jersey);
  const helmetDistance = calculateHexColorDistance(
    userUniform.helmetShell,
    opponentUniform.helmetShell,
  );

  if ((jerseyDistance + helmetDistance) / 2 >= SIMILARITY_WARNING_THRESHOLD) {
    return null;
  }

  return `${userTeamName} and ${opponentTeamName} uniforms are visually similar.`;
}

export function calculateHexColorDistance(hexA: string, hexB: string): number {
  const a = decomposeHex(hexA);
  const b = decomposeHex(hexB);

  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

export function getReadableTextColor(backgroundHex: string): string {
  const background = decomposeHex(backgroundHex);
  const blackContrast = calculateContrastRatio(background, { r: 16, g: 21, b: 18 });
  const whiteContrast = calculateContrastRatio(background, { r: 247, g: 251, b: 248 });

  return whiteContrast >= blackContrast ? '#f7fbf8' : '#101512';
}

export function getUniformColorNumber(color: string): number {
  return hexToNumber(color);
}

function calculateContrastRatio(
  a: ReturnType<typeof decomposeHex>,
  b: ReturnType<typeof decomposeHex>,
): number {
  const l1 = calculateRelativeLuminance(a);
  const l2 = calculateRelativeLuminance(b);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (brighter + 0.05) / (darker + 0.05);
}

function calculateRelativeLuminance(color: ReturnType<typeof decomposeHex>): number {
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
