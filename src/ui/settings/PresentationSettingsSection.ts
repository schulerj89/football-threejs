import type { CinematicsSetting } from '../../camera/PresentationCameraDirector';
import type {
  ExperienceCameraMode,
  ExperiencePreset,
} from '../../config/GameExperienceSettings';
import type { QualityMode } from '../../performance/QualityProfile';
import type { CrowdFullness } from '../../presentation/CrowdPresentationController';
import { createSelectSetting } from './SelectSetting';
import { createSettingsSection } from './SettingsSection';
import { createToggleSetting } from './ToggleSetting';
import type { SettingsSectionContext } from './SettingsTypes';
import {
  createAdvancedPresentationSettings,
  patchCrowdFullness,
} from './AdvancedPresentationSettings';

export function createPresentationSettingsSection(context: SettingsSectionContext): HTMLElement {
  const presetSummary = document.createElement('p');
  presetSummary.className = 'settings-preset-summary';
  presetSummary.textContent = getPresetSummary(context.settings.preset);
  const controls: HTMLElement[] = [
    createSelectSetting<ExperiencePreset>({
      description: 'Choose the overall presentation profile.',
      label: 'Presentation preset',
      onChange: context.onPresetChange,
      options: [
        { label: 'Broadcast', value: 'broadcast' },
        { label: 'Performance', value: 'performance' },
        { label: 'Custom', value: 'custom' },
      ],
      value: context.settings.preset,
    }),
    presetSummary,
    createSelectSetting<ExperienceCameraMode>({
      description: 'Choose the normal camera used during plays.',
      label: 'Gameplay camera',
      onChange: (value) => context.onPatch({ gameplayCamera: value }, true),
      options: [
        { label: 'Offense', value: 'offense' },
        { label: 'Tactical', value: 'tactical' },
        { label: 'Cinematic', value: 'cinematic' },
      ],
      value: context.settings.gameplayCamera,
    }),
    createSelectSetting<CinematicsSetting>({
      description: 'Control post-play and pregame camera language.',
      label: 'Cinematics',
      onChange: (value) => context.onPatch({ cinematics: value }, true),
      options: [
        { label: 'Off', value: 'off' },
        { label: 'Brief', value: 'brief' },
        { label: 'Full', value: 'full' },
      ],
      value: context.settings.cinematics,
    }),
    createSelectSetting<QualityMode>({
      description: 'Balance adaptive frame pacing and presentation detail.',
      label: 'Quality mode',
      onChange: (value) => context.onPatch({ qualityMode: value }),
      options: [
        { label: 'Adaptive 60 FPS', value: 'adaptive60' },
        { label: 'Broadcast Quality', value: 'lockedBroadcast' },
        { label: 'Performance Quality', value: 'lockedPerformance' },
      ],
      value: context.settings.qualityMode,
    }),
    createToggleSetting({
      checked: context.settings.stadiumEnabled,
      description: 'Show the stadium bowl around the field.',
      label: 'Stadium',
      onChange: (checked) => context.onPatch({ stadiumEnabled: checked }, true),
    }),
    createSelectSetting<CrowdFullness>({
      description: 'Visual attendance profile for the stadium.',
      label: 'Crowd fullness',
      onChange: (value) => context.onPatch(patchCrowdFullness(context.settings, value), true),
      options: [
        { label: 'Low Attendance', value: 'sparse' },
        { label: 'Standard Attendance', value: 'standard' },
        { label: 'Full Attendance', value: 'full' },
        { label: 'Adaptive', value: 'adaptive' },
      ],
      value: context.settings.crowdFullness,
    }),
  ];

  if (context.settings.preset === 'custom') {
    controls.push(createAdvancedPresentationSettings(context));
  } else {
    const wrapper = document.createElement('div');
    wrapper.className = 'settings-advanced-closed';
    wrapper.append(createAdvancedPresentationSettings(context));
    controls.push(wrapper);
  }

  return createSettingsSection('Presentation', 'Broadcast visuals, cameras, and stadium detail.', controls);
}

function getPresetSummary(preset: ExperiencePreset): string {
  if (preset === 'performance') {
    return 'Reduced presentation effects with gameplay clarity prioritized.';
  }
  if (preset === 'custom') {
    return 'Individual presentation controls are active.';
  }
  return 'Full stadium presentation, crowd, brief cinematics, and adaptive quality.';
}
