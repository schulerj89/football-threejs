import { createRangeSetting } from './RangeSetting';
import { createSettingsSection } from './SettingsSection';
import { createToggleSetting } from './ToggleSetting';
import type { SettingsSectionContext } from './SettingsTypes';

export function createAudioSettingsSection(context: SettingsSectionContext): HTMLElement {
  return createSettingsSection('Audio', 'Mix game, music, crowd, and announcer playback.', [
    createRangeSetting({
      description: 'Overall game audio level.',
      label: 'Master volume',
      onChange: (value) => context.onPatch({ masterVolume: value }),
      value: context.settings.masterVolume,
    }),
    createRangeSetting({
      description: 'Menu and transition music level.',
      label: 'Music volume',
      onChange: (value) => context.onPatch({ musicVolume: value }),
      value: context.settings.musicVolume,
    }),
    createRangeSetting({
      description: 'Stadium ambience and chant level.',
      label: 'Crowd volume',
      onChange: (value) => context.onPatch({ crowdVolume: value }),
      value: context.settings.crowdVolume,
    }),
    createRangeSetting({
      description: 'Broadcast commentary level.',
      label: 'Announcer volume',
      onChange: (value) => context.onPatch({ announcerVolume: value }),
      value: context.settings.announcerVolume,
    }),
    createToggleSetting({
      checked: context.settings.announcerEnabled,
      description: 'Play broadcast commentary when available.',
      label: 'Announcer',
      onChange: (checked) => context.onPatch({ announcerEnabled: checked }),
    }),
    createToggleSetting({
      checked: context.settings.captionsEnabled,
      description: 'Show captions for spoken presentation audio.',
      label: 'Captions',
      onChange: (checked) => context.onPatch({ captionsEnabled: checked }),
    }),
  ]);
}
