import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import type { LeagueData } from '../league/LeagueTypes';
import {
  FootballHubScreen,
  shouldPersistFootballHubLaunchSettings,
  type FootballHubLaunchOptions,
} from './FootballHubScreen';
import { SettingsPanel } from './SettingsPanel';
import { TitleScreen, type TitleLoadingState } from './TitleScreen';

export interface TitleScreenControllerOptions {
  getLeagueData: () => LeagueData | null;
  initialSettings: GameExperienceSettings;
  onFootballHubBack?: () => void;
  onFootballHubOpen?: () => void;
  onFirstGesture?: () => void;
  onSettingsChange: (settings: GameExperienceSettings) => void;
  onStart: (settings: GameExperienceSettings, options: FootballHubLaunchOptions) => void;
}

export class TitleScreenController {
  readonly footballHubScreen: FootballHubScreen;
  readonly settingsPanel: SettingsPanel;
  readonly titleScreen: TitleScreen;

  constructor(options: TitleScreenControllerOptions) {
    this.settingsPanel = new SettingsPanel({
      initialSettings: options.initialSettings,
      onSettingsChange: options.onSettingsChange,
    });
    this.footballHubScreen = new FootballHubScreen({
      getLeagueData: options.getLeagueData,
      initialSettings: options.initialSettings,
      onBack: () => {
        this.footballHubScreen.setVisible(false);
        this.titleScreen.setVisible(true);
        options.onFootballHubBack?.();
      },
      onFirstGesture: options.onFirstGesture,
      onPlayGame: (settings, launchOptions) => {
        this.footballHubScreen.setVisible(false);
        if (shouldPersistFootballHubLaunchSettings(launchOptions)) {
          this.settingsPanel.setSettings(settings);
          options.onSettingsChange(settings);
        }
        options.onStart(settings, launchOptions);
      },
      onSettingsChange: (settings) => {
        this.settingsPanel.setSettings(settings);
        options.onSettingsChange(settings);
      },
    });
    this.titleScreen = new TitleScreen({
      onFirstGesture: options.onFirstGesture,
      onStart: () => {
        options.onFootballHubOpen?.();
        this.titleScreen.setVisible(false);
        this.footballHubScreen.setSettings(this.settingsPanel.getSettings());
        this.footballHubScreen.setVisible(true);
      },
    });
  }

  getSettings(): GameExperienceSettings {
    return this.settingsPanel.getSettings();
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settingsPanel.setSettings(settings);
    this.footballHubScreen.setSettings(settings);
  }

  setVisible(visible: boolean): void {
    this.titleScreen.setVisible(visible);
    if (!visible) {
      this.footballHubScreen.setVisible(false);
    }
  }

  isMatchSetupVisible(): boolean {
    return false;
  }

  syncLoadingState(state: TitleLoadingState): void {
    this.titleScreen.syncLoadingState(state);
  }

  dispose(): void {
    this.titleScreen.root.remove();
    this.footballHubScreen.dispose();
  }
}
