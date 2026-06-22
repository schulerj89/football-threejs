import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import type { PlayState } from '../playState';
import { PauseSettingsPanel } from '../ui/PauseSettingsPanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import type { TitleLoadingState } from '../ui/TitleScreen';
import { TitleScreenController } from '../ui/TitleScreenController';

export type AppPhase = 'gameplay' | 'pregamePresentation' | 'title';

export interface ApplicationLifecycleOptions {
  crowdPreviewEnabled: boolean;
  formationPreviewActive: boolean;
  initialSettings: GameExperienceSettings;
  searchParams: URLSearchParams;
  createTitleLoadingState: () => TitleLoadingState;
  onPauseSettingsChange: (settings: GameExperienceSettings) => void;
  onReturnToTitle: () => void;
  onTitleFirstGesture: () => void;
  onStart: () => void;
  onTitleSettingsChange: (settings: GameExperienceSettings) => void;
  syncChrome: (phase: AppPhase) => void;
}

export class ApplicationLifecycle {
  private currentSettings: GameExperienceSettings;
  private phaseValue: AppPhase;
  private readonly pauseSettingsPanel: PauseSettingsPanel | null;
  private readonly pauseSetupScreen: SettingsPanel | null;
  private readonly titleController: TitleScreenController | null;

  constructor(private readonly options: ApplicationLifecycleOptions) {
    this.currentSettings = options.initialSettings;
    const normalLaunchShouldShowTitle =
      !options.crowdPreviewEnabled &&
      !options.formationPreviewActive &&
      options.searchParams.toString().length === 0;
    this.phaseValue = normalLaunchShouldShowTitle ? 'title' : 'gameplay';

    this.titleController = !options.crowdPreviewEnabled && !options.formationPreviewActive
      ? new TitleScreenController({
          initialSettings: options.initialSettings,
          onFirstGesture: options.onTitleFirstGesture,
          onStart: options.onStart,
          onSettingsChange: options.onTitleSettingsChange,
        })
      : null;
    this.pauseSetupScreen = !options.crowdPreviewEnabled && !options.formationPreviewActive
      ? new SettingsPanel({
          initialSettings: options.initialSettings,
          onSettingsChange: options.onPauseSettingsChange,
          showGameMode: false,
          showTeamCustomization: false,
        })
      : null;
    this.pauseSettingsPanel = this.pauseSetupScreen
      ? new PauseSettingsPanel({
          onClose: () => this.setPauseSettingsVisible(false, false),
          onReturnToTitle: options.onReturnToTitle,
          setupElement: this.pauseSetupScreen.root,
        })
      : null;

    this.titleController?.setVisible(this.phaseValue === 'title');
    this.syncChrome();
    this.syncTitleLoadingState();
  }

  get phase(): AppPhase {
    return this.phaseValue;
  }

  getTitleSettings(fallback: GameExperienceSettings): GameExperienceSettings {
    return this.titleController?.getSettings() ?? fallback;
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
    if (!this.titleController) {
      this.setPauseSettingsVisible(false, false);
      return;
    }

    this.phaseValue = 'title';
    this.setPauseSettingsVisible(false, false);
    this.titleController.setSettings(this.currentSettings);
    this.titleController.setVisible(true);
    this.syncChrome();
  }

  startGameplay(): void {
    this.phaseValue = 'gameplay';
    this.titleController?.setVisible(false);
    this.setPauseSettingsVisible(false, false);
    this.syncChrome();
  }

  startPregamePresentation(): void {
    this.phaseValue = 'pregamePresentation';
    this.titleController?.setVisible(false);
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
    this.titleController?.setSettings(settings);
    this.pauseSetupScreen?.setSettings(settings);
  }

  syncTitleLoadingState(): void {
    this.titleController?.syncLoadingState(this.options.createTitleLoadingState());
  }

  syncChrome(): void {
    this.options.syncChrome(this.phaseValue);
  }

  dispose(): void {
    this.titleController?.dispose();
    this.pauseSettingsPanel?.root.remove();
  }
}

function canOpenPauseSettings(playState: PlayState): boolean {
  return playState === 'preSnap' || playState === 'dead';
}
