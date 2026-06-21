import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import { SettingsPanel } from './SettingsPanel';
import { TitleScreen, type TitleLoadingState } from './TitleScreen';

export interface TitleScreenControllerOptions {
  initialSettings: GameExperienceSettings;
  onFirstGesture?: () => void;
  onSettingsChange: (settings: GameExperienceSettings) => void;
  onStart: () => void;
}

export class TitleScreenController {
  readonly settingsPanel: SettingsPanel;
  readonly titleScreen: TitleScreen;

  constructor(options: TitleScreenControllerOptions) {
    this.settingsPanel = new SettingsPanel({
      initialSettings: options.initialSettings,
      onSettingsChange: options.onSettingsChange,
    });
    this.titleScreen = new TitleScreen({
      onFirstGesture: options.onFirstGesture,
      onStart: options.onStart,
      setupElement: this.settingsPanel.root,
    });
  }

  getSettings(): GameExperienceSettings {
    return this.settingsPanel.getSettings();
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settingsPanel.setSettings(settings);
  }

  setVisible(visible: boolean): void {
    this.titleScreen.setVisible(visible);
  }

  syncLoadingState(state: TitleLoadingState): void {
    this.titleScreen.syncLoadingState(state);
  }

  dispose(): void {
    this.titleScreen.root.remove();
  }
}
