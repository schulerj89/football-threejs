import {
  createGameplayRosterBinding,
  createRosterPreviewRows,
} from '../roster/GameplayRosterBinding';
import type { GameExperienceSettings } from '../config/GameExperienceSettings';
import type { RosterPlayer } from '../roster/RosterPlayer';
import type { TeamRoster } from '../roster/TeamRoster';

export class RosterPreviewPanel {
  readonly root = document.createElement('section');

  private settings: GameExperienceSettings;
  private readonly body = document.createElement('div');

  constructor(initialSettings: GameExperienceSettings) {
    this.settings = initialSettings;
    this.root.className = 'roster-preview-panel';

    const heading = document.createElement('header');
    const title = document.createElement('h3');
    title.textContent = 'Active Lineup';
    const note = document.createElement('p');
    note.textContent = 'Roster identities are fixed to lineup slots for the match.';
    heading.append(title, note);

    this.body.className = 'roster-preview-body';
    this.root.append(heading, this.body);
    this.render();
  }

  setSettings(settings: GameExperienceSettings): void {
    this.settings = settings;
    this.render();
  }

  private render(): void {
    const binding = createGameplayRosterBinding(
      this.settings.playbookId,
      this.settings.teamProfiles,
    );
    const rows = createRosterPreviewRows(binding);
    const userRows = rows.filter((row) => row.teamLabel === 'User');
    const opponentRows = rows.filter((row) => row.teamLabel === 'Opponent');

    this.body.replaceChildren(
      this.createRosterTable('User Offense', userRows),
      this.createRosterTable('User Specialists', createRosterRows(binding.userRoster, 'User', [
        binding.userRoster.kickerId,
        binding.userRoster.punterId,
        binding.userRoster.longSnapperId,
      ]), true),
      this.createRosterTable('User Reserves', createRosterRows(binding.userRoster, 'User', binding.userRoster.reserveIds), true),
      this.createRosterTable('Opponent Defense', opponentRows),
      this.createRosterTable('Opponent Specialists', createRosterRows(binding.opponentRoster, 'Opponent', [
        binding.opponentRoster.kickerId,
        binding.opponentRoster.punterId,
        binding.opponentRoster.longSnapperId,
      ]), true),
      this.createRosterTable(
        'Opponent Reserves',
        createRosterRows(binding.opponentRoster, 'Opponent', binding.opponentRoster.reserveIds),
        true,
      ),
    );
  }

  private createRosterTable(
    titleText: string,
    rows: ReturnType<typeof createRosterPreviewRows>,
    collapsible = false,
  ): HTMLElement {
    const section = collapsible ? document.createElement('details') : document.createElement('section');
    section.className = 'roster-preview-table';
    if (collapsible && section instanceof HTMLDetailsElement) {
      section.open = false;
    }

    const title = document.createElement(collapsible ? 'summary' : 'h4');
    title.textContent = titleText;

    const list = document.createElement('div');
    list.className = 'roster-preview-list';
    for (const row of rows) {
      const item = document.createElement('div');
      item.className = 'roster-preview-row';
      item.dataset.gameplayPlayerId = row.gameplayPlayerId;

      const number = document.createElement('span');
      number.className = 'roster-preview-number';
      number.textContent = `#${row.jerseyNumber.toString().padStart(2, '0')}`;

      const name = document.createElement('span');
      name.className = 'roster-preview-name';
      name.textContent = row.name;

      const position = document.createElement('span');
      position.className = 'roster-preview-position';
      position.textContent = row.footballPosition;

      item.append(number, name, position);
      list.append(item);
    }

    section.append(title, list);
    return section;
  }
}

function createRosterRows(
  roster: TeamRoster,
  teamLabel: 'Opponent' | 'User',
  playerIds: readonly string[],
): ReturnType<typeof createRosterPreviewRows> {
  return playerIds
    .map((id) => roster.players.find((player) => player.id === id) ?? null)
    .filter((player): player is RosterPlayer => Boolean(player))
    .map((player) => ({
      footballPosition: player.footballPosition,
      gameplayPlayerId: player.id,
      jerseyNumber: player.jerseyNumber,
      name: player.displayName,
      rosterPlayerId: player.id,
      teamLabel,
    }));
}
