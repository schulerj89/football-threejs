import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import { TeamCustomizationPanel } from './TeamCustomizationPanel';
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
  private readonly summary = new MatchupSummary();
  private readonly customizePanel: TeamCustomizationPanel;
  private readonly confirmButton = document.createElement('button');
  private readonly correctionButton = document.createElement('button');
  private settings: GameExperienceSettings;
  private selection: MatchSetupSelection;
  private firstGestureHandled = false;
  private visible = false;

  constructor(private readonly options: MatchSetupScreenOptions) {
    this.settings = options.initialSettings;
    this.selection = createMatchSetupSelection(options.initialSettings.teamProfiles);
    this.customizePanel = new TeamCustomizationPanel({
      initialSettings: this.selection.teamProfiles,
      onSettingsChange: (teamProfiles) => {
        this.selection = createMatchSetupSelection(teamProfiles);
        this.sync();
      },
    });
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
    if (visible) {
      this.root.focus({ preventScroll: true });
    }
  }

  isVisible(): boolean {
    return this.visible && !this.root.hidden;
  }

  dispose(): void {
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

    const customize = document.createElement('details');
    customize.className = 'match-setup-customize';
    const customizeSummary = document.createElement('summary');
    customizeSummary.textContent = 'Customize Team';
    customize.append(customizeSummary, this.customizePanel.root);

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
    this.confirmButton.textContent = 'Confirm Match';
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

    panel.append(header, grid, customize, actions);
    return panel;
  }

  private sync(): void {
    const validation = validateMatchSetupSelection(this.selection);
    this.userCard.sync(this.selection.teamProfiles);
    this.opponentCard.sync(this.selection.teamProfiles);
    this.customizePanel.setSettings(this.selection.teamProfiles);
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
