import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import type { LeagueData } from '../league/LeagueTypes';
import { FootballHubScreen } from './FootballHubScreen';
import { MatchSetupHelmetPreviewRenderer } from './MatchSetupHelmetPreview';
import { MatchSetupScreen } from './MatchSetupScreen';
import type { MatchSetupSelection } from './MatchSetupModel';
import { SettingsPanel } from './SettingsPanel';
import { TitleScreen, type TitleLoadingState } from './TitleScreen';

export interface TitleScreenControllerOptions {
  getLeagueData: () => LeagueData | null;
  initialSettings: GameExperienceSettings;
  onFootballHubBack?: () => void;
  onFootballHubOpen?: () => void;
  onFirstGesture?: () => void;
  onMatchSetupBack?: () => void;
  onMatchSetupOpen?: () => void;
  onSettingsChange: (settings: GameExperienceSettings) => void;
  onStart: () => void;
}

export class TitleScreenController {
  readonly footballHubScreen: FootballHubScreen;
  readonly helmetPreview: MatchSetupHelmetPreviewRenderer;
  readonly matchSetupScreen: MatchSetupScreen;
  readonly settingsPanel: SettingsPanel;
  readonly titleScreen: TitleScreen;

  constructor(options: TitleScreenControllerOptions) {
    this.helmetPreview = new MatchSetupHelmetPreviewRenderer(document.body);
    this.settingsPanel = new SettingsPanel({
      initialSettings: options.initialSettings,
      onSettingsChange: options.onSettingsChange,
    });
    this.matchSetupScreen = new MatchSetupScreen({
      helmetPreview: this.helmetPreview,
      initialSettings: options.initialSettings,
      onBack: () => {
        this.settingsPanel.setSettings({
          ...this.settingsPanel.getSettings(),
          teamProfiles: this.matchSetupScreen.getSelection().teamProfiles,
        });
        this.matchSetupScreen.setVisible(false);
        this.footballHubScreen.setSettings(this.settingsPanel.getSettings());
        this.footballHubScreen.setVisible(true);
        options.onMatchSetupBack?.();
      },
      onConfirm: (settings) => {
        this.settingsPanel.setSettings(settings);
        options.onSettingsChange(settings);
        this.matchSetupScreen.setVisible(false);
        options.onStart();
      },
      onFirstGesture: options.onFirstGesture,
    });
    this.footballHubScreen = new FootballHubScreen({
      getLeagueData: options.getLeagueData,
      helmetPreview: this.helmetPreview,
      initialSettings: options.initialSettings,
      onBack: () => {
        this.footballHubScreen.setVisible(false);
        this.titleScreen.setVisible(true);
        options.onFootballHubBack?.();
      },
      onFirstGesture: options.onFirstGesture,
      onPlayGame: (settings) => {
        this.settingsPanel.setSettings(settings);
        this.matchSetupScreen.setSettings(settings);
        this.footballHubScreen.setVisible(false);
        this.matchSetupScreen.setVisible(true);
        options.onMatchSetupOpen?.();
      },
      onSettingsChange: (settings) => {
        this.settingsPanel.setSettings(settings);
        this.matchSetupScreen.setSettings(settings);
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
    if (!this.matchSetupScreen.isVisible()) {
      this.matchSetupScreen.setSettings(settings);
    }
  }

  setVisible(visible: boolean): void {
    this.titleScreen.setVisible(visible);
    if (!visible) {
      this.footballHubScreen.setVisible(false);
      this.matchSetupScreen.setVisible(false);
    }
  }

  isMatchSetupVisible(): boolean {
    return this.matchSetupScreen.isVisible();
  }

  getMatchSetupSelection(): MatchSetupSelection {
    return this.matchSetupScreen.getSelection();
  }

  syncLoadingState(state: TitleLoadingState): void {
    this.titleScreen.syncLoadingState(state);
  }

  dispose(): void {
    this.titleScreen.root.remove();
    this.footballHubScreen.dispose();
    this.matchSetupScreen.dispose();
    this.helmetPreview.dispose();
  }
}
