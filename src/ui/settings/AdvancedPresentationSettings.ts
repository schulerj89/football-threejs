import type { GameExperienceSettings } from '../../config/GameExperienceSettings';
import type { SidelineDensity } from '../../presentation/teams/SidelineTeamTypes';
import { createSelectSetting } from './SelectSetting';
import { createToggleSetting } from './ToggleSetting';
import type { SettingsSectionContext } from './SettingsTypes';

export function createAdvancedPresentationSettings(context: SettingsSectionContext): HTMLElement {
  const details = document.createElement('details');
  details.className = 'settings-advanced-presentation';
  details.open = context.settings.preset === 'custom';
  const summary = document.createElement('summary');
  summary.textContent = 'Advanced Presentation';
  const content = document.createElement('div');
  content.className = 'settings-advanced-grid';

  content.append(
    createToggleSetting({
      checked: context.settings.crowdReactionsEnabled,
      description: 'Allow crowd visual reactions after results.',
      label: 'Crowd reactions',
      onChange: (checked) => context.onPatch({ crowdReactionsEnabled: checked }, true),
    }),
    createToggleSetting({
      checked: context.settings.sidelinePlayersEnabled,
      description: 'Show reserve players along the sidelines.',
      label: 'Sideline players',
      onChange: (checked) => context.onPatch({ sidelinePlayersEnabled: checked }, true),
    }),
    createToggleSetting({
      checked: context.settings.coachesEnabled,
      description: 'Show presentation-only head coaches.',
      label: 'Coaches',
      onChange: (checked) => context.onPatch({ coachesEnabled: checked }, true),
    }),
    createToggleSetting({
      checked: context.settings.tunnelTableauEnabled,
      description: 'Use tunnel tableau subjects during introductions.',
      label: 'Tunnel tableau',
      onChange: (checked) => context.onPatch({ tunnelTableauEnabled: checked }, true),
    }),
    createSelectSetting<SidelineDensity>({
      description: 'Reserve-player sideline population.',
      label: 'Sideline density',
      onChange: (value) => context.onPatch({ sidelineDensity: value }, true),
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
      ],
      value: context.settings.sidelineDensity,
    }),
    createToggleSetting({
      checked: context.settings.playerMotionEnabled,
      description: 'Enable procedural player presentation motion.',
      label: 'Player motion',
      onChange: (checked) => context.onPatch({ playerMotionEnabled: checked }, true),
    }),
    createToggleSetting({
      checked: context.settings.routeArtEnabled,
      description: 'Show pre-snap route and blocking art.',
      label: 'Route art',
      onChange: (checked) => context.onPatch({ routeArtEnabled: checked }, true),
    }),
    createToggleSetting({
      checked: context.settings.controlledPlayerLabelEnabled,
      description: 'Show the controlled player name and number marker.',
      label: 'Controlled-player label',
      onChange: (checked) => context.onPatch({ controlledPlayerLabelEnabled: checked }, true),
    }),
    createToggleSetting({
      checked: context.settings.selectedReceiverLabelEnabled,
      description: 'Show the selected receiver label before a throw.',
      label: 'Selected-receiver label',
      onChange: (checked) => context.onPatch({ selectedReceiverLabelEnabled: checked }, true),
    }),
  );

  details.append(summary, content);
  return details;
}

export function patchCrowdFullness(
  settings: GameExperienceSettings,
  crowdFullness: GameExperienceSettings['crowdFullness'],
): Partial<GameExperienceSettings> {
  return {
    crowdDensity: crowdFullness === 'full'
      ? 'high'
      : crowdFullness === 'standard' || crowdFullness === 'adaptive'
        ? 'medium'
        : 'low',
    crowdFullness,
  };
}
