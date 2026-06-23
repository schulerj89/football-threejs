import type { UniformPalette } from './UniformPalette';

export interface TeamProfile {
  abbreviation: string;
  awayUniform: UniformPalette;
  colors: {
    accent: string;
    primary: string;
    secondary: string;
  };
  crowdAccentColor: string;
  displayName: string;
  endZoneColor: string;
  homeUniform: UniformPalette;
  id: string;
  identity: string;
  logoAssetId: string;
  logoUrl: string;
  rosterId?: string;
  shortName: string;
  stadiumId?: string;
}

export type TeamSide = 'opponent' | 'user';

export type TeamVisualRole = 'defense' | 'offense';

export interface TeamColorOverrides {
  faceguard?: string;
  helmetShell?: string;
  pants?: string;
  primary?: string;
  secondary?: string;
}
