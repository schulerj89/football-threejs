import type { GameExperienceSettings } from '../../config/GameExperienceSettings';

export type SettingsCategoryId = 'accessibility' | 'audio' | 'presentation';
export type SettingsPanelContext = 'activeMatch' | 'menu';
export type SettingsPanelVariant = 'full' | 'pause';

export interface SettingsOption<TValue extends string = string> {
  readonly label: string;
  readonly value: TValue;
}

export interface SettingsSectionContext {
  readonly context: SettingsPanelContext;
  readonly onPatch: (patch: Partial<GameExperienceSettings>, custom?: boolean) => void;
  readonly onPresetChange: (preset: GameExperienceSettings['preset']) => void;
  readonly settings: GameExperienceSettings;
}

export const SETTINGS_CATEGORY_LABELS: Readonly<Record<SettingsCategoryId, string>> = {
  accessibility: 'Accessibility',
  audio: 'Audio',
  presentation: 'Presentation',
} as const;

export const SETTINGS_CATEGORY_ORDER: readonly SettingsCategoryId[] = [
  'presentation',
  'audio',
  'accessibility',
] as const;
