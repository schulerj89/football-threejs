import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import { MatchSetupHelmetPreviewRenderer } from './MatchSetupHelmetPreview';
import { TeamSelectionCard } from './TeamSelectionCard';
import { MatchupSummary } from './MatchupSummary';
import {
  cloneMatchSetupSelection,
  createAutoUniformCorrection,
  createMatchSetupSelection,
  updateMatchSetupTeam,
  updateMatchSetupUniform,
  validateMatchSetupSelection,
  type MatchSetupSelection,
} from './MatchSetupModel';

export interface MatchSetupScreenOptions {
  initialSettings: GameExperienceSettings;
  onBack: () => void;
  onConfirm: (settings: GameExperienceSettings) => void;
  onFirstGesture?: () => void;
}

export class MatchSetupScreen {
  readonly root = document.createElement('div');

  private readonly userCard: TeamSelectionCard;
  private readonly opponentCard: TeamSelectionCard;
  private readonly helmetPreview: MatchSetupHelmetPreviewRenderer;
  private readonly summary = new MatchupSummary();
  private readonly confirmButton = document.createElement('button');
  private readonly correctionButton = document.createElement('button');
  private settings: GameExperienceSettings;
  private selection: MatchSetupSelection;
  private firstGestureHandled = false;
  private visible = false;

  constructor(private readonly options: MatchSetupScreenOptions) {
    this.settings = options.initialSettings;
    this.selection = createMatchSetupSelection(options.initialSettings.teamProfiles);
    this.userCard = new TeamSelectionCard({
      onTeamChange: (teamId) => {
        this.selection = updateMatchSetupTeam(this.selection, 'user', teamId);
        this.sync();
      },
      onUniformChange: (uniform) => {
        this.selection = updateMatchSetupUniform(this.selection, 'user', uniform);
        this.sync();
      },
      settings: this.selection.teamProfiles,
      side: 'user',
      title: 'Your Team',
    });
    this.opponentCard = new TeamSelectionCard({
      onTeamChange: (teamId) => {
        this.selection = updateMatchSetupTeam(this.selection, 'opponent', teamId);
        this.sync();
      },
      onUniformChange: (uniform) => {
        this.selection = updateMatchSetupUniform(this.selection, 'opponent', uniform);
        this.sync();
      },
      settings: this.selection.teamProfiles,
      side: 'opponent',
      title: 'Opponent',
    });
    this.root.className = 'match-setup-screen';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'match-setup-heading');
    this.root.tabIndex = -1;
    this.root.append(this.createContent());
    this.helmetPreview = new MatchSetupHelmetPreviewRenderer(this.root);
    this.helmetPreview.registerPreview(
      'user',
      this.userCard.getHelmetPreviewHost(),
      this.userCard.getHelmetFallbackBadge(),
      this.userCard.getUniformPalette(),
    );
    this.helmetPreview.registerPreview(
      'opponent',
      this.opponentCard.getHelmetPreviewHost(),
      this.opponentCard.getHelmetFallbackBadge(),
      this.opponentCard.getUniformPalette(),
    );
    this.root.addEventListener('pointerdown', () => this.handleFirstGesture(), {
      capture: true,
    });
    this.root.addEventListener('keydown', (event) => {
      this.handleFirstGesture();
      if (event.key === 'Escape') {
        this.options.onBack();
        event.preventDefault();
      }
    });
    document.body.append(this.root);
    this.sync();
  }

  getSelection(): MatchSetupSelection {
    return cloneMatchSetupSelection(this.selection);
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settings = settings;
    this.selection = createMatchSetupSelection(settings.teamProfiles);
    this.sync();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.hidden = !visible;
    this.helmetPreview.setVisible(visible);
    if (visible) {
      this.root.focus({ preventScroll: true });
    }
  }

  isVisible(): boolean {
    return this.visible && !this.root.hidden;
  }

  dispose(): void {
    this.helmetPreview.dispose();
    this.root.remove();
  }

  private createContent(): HTMLElement {
    const panel = document.createElement('section');
    panel.className = 'match-setup-panel';

    const header = document.createElement('header');
    const heading = document.createElement('h2');
    heading.id = 'match-setup-heading';
    heading.textContent = 'Match Setup';
    const subheading = document.createElement('p');
    subheading.textContent = 'Choose the teams and uniforms for the broadcast intro.';
    header.append(heading, subheading);

    const grid = document.createElement('div');
    grid.className = 'match-setup-grid';
    grid.append(this.userCard.root, this.opponentCard.root, this.summary.root);

    const actions = document.createElement('footer');
    actions.className = 'match-setup-actions';
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'match-setup-secondary-button';
    backButton.textContent = 'Back';
    backButton.addEventListener('click', () => {
      this.handleFirstGesture();
      this.options.onBack();
    });
    this.correctionButton.type = 'button';
    this.correctionButton.className = 'match-setup-secondary-button';
    this.correctionButton.textContent = 'Auto Fix Uniforms';
    this.correctionButton.addEventListener('click', () => {
      this.selection = createAutoUniformCorrection(this.selection);
      this.sync();
    });
    this.confirmButton.type = 'button';
    this.confirmButton.className = 'match-setup-confirm-button';
    this.confirmButton.textContent = 'Play Game';
    this.confirmButton.addEventListener('click', () => {
      this.handleFirstGesture();
      if (!validateMatchSetupSelection(this.selection).canConfirm) {
        return;
      }
      this.options.onConfirm({
        ...this.settings,
        teamProfiles: cloneMatchSetupSelection(this.selection).teamProfiles,
      });
    });
    actions.append(backButton, this.correctionButton, this.confirmButton);

    panel.append(header, grid, actions);
    return panel;
  }

  private sync(): void {
    const validation = validateMatchSetupSelection(this.selection);
    this.userCard.sync(this.selection.teamProfiles);
    this.opponentCard.sync(this.selection.teamProfiles);
    this.helmetPreview.syncPreview('user', this.userCard.getUniformPalette());
    this.helmetPreview.syncPreview('opponent', this.opponentCard.getUniformPalette());
    this.summary.sync(this.selection.teamProfiles, validation);
    this.correctionButton.hidden = !validation.uniformConflict;
    this.confirmButton.disabled = !validation.canConfirm;
    this.root.dataset.valid = String(validation.canConfirm);
  }

  private handleFirstGesture(): void {
    if (this.firstGestureHandled) {
      return;
    }

    this.firstGestureHandled = true;
    this.options.onFirstGesture?.();
  }
}
