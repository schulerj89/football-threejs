import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import type { PlayState } from '../playState';
import { GameSetupScreen } from '../ui/GameSetupScreen';
import { PauseSettingsPanel } from '../ui/PauseSettingsPanel';
import { TitleScreen, type TitleLoadingState } from '../ui/TitleScreen';

export type AppPhase = 'gameplay' | 'title';

export interface ApplicationLifecycleOptions {
  crowdPreviewEnabled: boolean;
  formationPreviewActive: boolean;
  initialSettings: GameExperienceSettings;
  searchParams: URLSearchParams;
  createTitleLoadingState: () => TitleLoadingState;
  onPauseSettingsChange: (settings: GameExperienceSettings) => void;
  onReturnToTitle: () => void;
  onStart: () => void;
  onTitleSettingsChange: (settings: GameExperienceSettings) => void;
  syncChrome: (phase: AppPhase) => void;
}

export class ApplicationLifecycle {
  private currentSettings: GameExperienceSettings;
  private phaseValue: AppPhase;
  private readonly pauseSettingsPanel: PauseSettingsPanel | null;
  private readonly pauseSetupScreen: GameSetupScreen | null;
  private readonly titleScreen: TitleScreen | null;
  private readonly titleSetupScreen: GameSetupScreen | null;

  constructor(private readonly options: ApplicationLifecycleOptions) {
    this.currentSettings = options.initialSettings;
    const normalLaunchShouldShowTitle =
      !options.crowdPreviewEnabled &&
      !options.formationPreviewActive &&
      options.searchParams.toString().length === 0;
    this.phaseValue = normalLaunchShouldShowTitle ? 'title' : 'gameplay';

    this.titleSetupScreen = !options.crowdPreviewEnabled && !options.formationPreviewActive
      ? new GameSetupScreen({
          initialSettings: options.initialSettings,
          onSettingsChange: options.onTitleSettingsChange,
        })
      : null;
    this.titleScreen = this.titleSetupScreen
      ? new TitleScreen({
          onStart: options.onStart,
          setupElement: this.titleSetupScreen.root,
        })
      : null;
    this.pauseSetupScreen = !options.crowdPreviewEnabled && !options.formationPreviewActive
      ? new GameSetupScreen({
          initialSettings: options.initialSettings,
          onSettingsChange: options.onPauseSettingsChange,
          showGameMode: false,
        })
      : null;
    this.pauseSettingsPanel = this.pauseSetupScreen
      ? new PauseSettingsPanel({
          onClose: () => this.setPauseSettingsVisible(false, false),
          onReturnToTitle: options.onReturnToTitle,
          setupElement: this.pauseSetupScreen.root,
        })
      : null;

    this.titleScreen?.setVisible(this.phaseValue === 'title');
    this.syncChrome();
    this.syncTitleLoadingState();
  }

  get phase(): AppPhase {
    return this.phaseValue;
  }

  getTitleSettings(fallback: GameExperienceSettings): GameExperienceSettings {
    return this.titleSetupScreen?.getSettings() ?? fallback;
  }

  isPauseSettingsVisible(): boolean {
    return this.pauseSettingsPanel?.isVisible() ?? false;
  }

  handlePauseSettingsShortcut(event: KeyboardEvent, playState: PlayState): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key !== 'Escape') {
      return;
    }

    if (this.pauseSettingsPanel?.isVisible()) {
      this.setPauseSettingsVisible(false, false);
      event.preventDefault();
      return;
    }

    if (this.phaseValue === 'gameplay' && canOpenPauseSettings(playState)) {
      this.setPauseSettingsVisible(true, true);
      event.preventDefault();
    }
  }

  returnToTitleScreen(): void {
    if (!this.titleScreen) {
      this.setPauseSettingsVisible(false, false);
      return;
    }

    this.phaseValue = 'title';
    this.setPauseSettingsVisible(false, false);
    this.titleSetupScreen?.setSettings(this.currentSettings);
    this.titleScreen.setVisible(true);
    this.syncChrome();
  }

  startGameplay(): void {
    this.phaseValue = 'gameplay';
    this.titleScreen?.setVisible(false);
    this.setPauseSettingsVisible(false, false);
    this.syncChrome();
  }

  setPauseSettingsVisible(visible: boolean, canOpen: boolean): void {
    if (!this.pauseSettingsPanel) {
      return;
    }

    const nextVisible = visible && canOpen;
    this.pauseSettingsPanel.setVisible(nextVisible);
    if (nextVisible) {
      this.pauseSetupScreen?.setSettings(this.currentSettings);
    }
    this.syncChrome();
  }

  setSettings(settings: GameExperienceSettings): void {
    this.currentSettings = settings;
    this.titleSetupScreen?.setSettings(settings);
    this.pauseSetupScreen?.setSettings(settings);
  }

  syncTitleLoadingState(): void {
    this.titleScreen?.syncLoadingState(this.options.createTitleLoadingState());
  }

  syncChrome(): void {
    this.options.syncChrome(this.phaseValue);
  }

  dispose(): void {
    this.titleScreen?.root.remove();
    this.pauseSettingsPanel?.root.remove();
  }
}

function canOpenPauseSettings(playState: PlayState): boolean {
  return playState === 'preSnap' || playState === 'dead';
}
