import { createSettingsSection } from './SettingsSection';
import { createToggleSetting } from './ToggleSetting';
import type { SettingsSectionContext } from './SettingsTypes';

export function createAccessibilitySettingsSection(context: SettingsSectionContext): HTMLElement {
  return createSettingsSection('Accessibility', 'Readable overlays and optional on-field helpers.', [
    createToggleSetting({
      checked: context.settings.captionsEnabled,
      description: 'Show captions for announcer and presentation speech.',
      label: 'Captions',
      onChange: (checked) => context.onPatch({ captionsEnabled: checked }),
    }),
    createToggleSetting({
      checked: context.settings.controlledPlayerLabelEnabled,
      description: 'Show the controlled player name marker.',
      label: 'Controlled-player label',
      onChange: (checked) => context.onPatch({ controlledPlayerLabelEnabled: checked }, true),
    }),
    createToggleSetting({
      checked: context.settings.routeArtEnabled,
      description: 'Show route and blocking guides before the snap.',
      label: 'Route art',
      onChange: (checked) => context.onPatch({ routeArtEnabled: checked }, true),
    }),
  ]);
}
