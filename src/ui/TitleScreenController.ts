import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import { MatchSetupScreen } from './MatchSetupScreen';
import type { MatchSetupSelection } from './MatchSetupModel';
import { SettingsPanel } from './SettingsPanel';
import { TitleScreen, type TitleLoadingState } from './TitleScreen';

export interface TitleScreenControllerOptions {
  initialSettings: GameExperienceSettings;
  onFirstGesture?: () => void;
  onMatchSetupBack?: () => void;
  onMatchSetupOpen?: () => void;
  onSettingsChange: (settings: GameExperienceSettings) => void;
  onStart: () => void;
}

export class TitleScreenController {
  readonly matchSetupScreen: MatchSetupScreen;
  readonly settingsPanel: SettingsPanel;
  readonly titleScreen: TitleScreen;

  constructor(options: TitleScreenControllerOptions) {
    this.settingsPanel = new SettingsPanel({
      initialSettings: options.initialSettings,
      onSettingsChange: options.onSettingsChange,
      showRosterPreview: false,
      showGameMode: false,
      showTeamCustomization: true,
    });
    this.matchSetupScreen = new MatchSetupScreen({
      initialSettings: options.initialSettings,
      onBack: () => {
        this.settingsPanel.setSettings({
          ...this.settingsPanel.getSettings(),
          teamProfiles: this.matchSetupScreen.getSelection().teamProfiles,
        });
        this.matchSetupScreen.setVisible(false);
        this.titleScreen.setVisible(true);
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
    this.titleScreen = new TitleScreen({
      onFirstGesture: options.onFirstGesture,
      onStart: () => {
        options.onMatchSetupOpen?.();
        this.titleScreen.setVisible(false);
        this.matchSetupScreen.setSettings(this.settingsPanel.getSettings());
        this.matchSetupScreen.setVisible(true);
      },
      setupElement: this.settingsPanel.root,
    });
  }

  getSettings(): GameExperienceSettings {
    return this.settingsPanel.getSettings();
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settingsPanel.setSettings(settings);
    if (!this.matchSetupScreen.isVisible()) {
      this.matchSetupScreen.setSettings(settings);
    }
  }

  setVisible(visible: boolean): void {
    this.titleScreen.setVisible(visible);
    if (!visible) {
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
    this.matchSetupScreen.dispose();
  }
}
