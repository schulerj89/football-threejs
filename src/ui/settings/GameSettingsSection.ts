import type {
  MatchDifficulty,
} from '../../match/MatchTypes';
import { createSelectSetting } from './SelectSetting';
import { createSettingsSection } from './SettingsSection';
import type { SettingsSectionContext } from './SettingsTypes';

export function createGameSettingsSection(context: SettingsSectionContext): HTMLElement {
  const activeMatchReason = context.context === 'activeMatch'
    ? 'Return to the hub before changing match structure.'
    : undefined;

  return createSettingsSection('Game', 'Core match setup that affects future games.', [
    createSelectSetting({
      description: 'Length of each regulation quarter.',
      disabledReason: activeMatchReason,
      label: 'Quarter length',
      onChange: (value) => context.onPatch({ quarterLengthSeconds: Number(value) }),
      options: [
        { label: '1 minute', value: '60' },
        { label: '3 minutes', value: '180' },
        { label: '5 minutes', value: '300' },
        { label: '10 minutes', value: '600' },
      ],
      value: getQuarterLengthOptionValue(context.settings.quarterLengthSeconds),
    }),
    createSelectSetting<MatchDifficulty>({
      description: 'Opponent simulation and kicking difficulty.',
      disabledReason: activeMatchReason,
      label: 'Difficulty',
      onChange: (value) => context.onPatch({ matchDifficulty: value }),
      options: [
        { label: 'Rookie', value: 'rookie' },
        { label: 'Pro', value: 'pro' },
        { label: 'All-Pro', value: 'allPro' },
      ],
      value: context.settings.matchDifficulty,
    }),
  ]);
}

function getQuarterLengthOptionValue(value: number): '180' | '300' | '60' | '600' {
  if (value === 60 || value === 180 || value === 300 || value === 600) {
    return String(value) as '180' | '300' | '60' | '600';
  }

  return '180';
}
