import { describe, expect, it } from 'vitest';
import {
  createGameplayModel,
  selectPlay,
  snapshotGameplayModel,
} from '../src/playState';
import {
  ControlledPlayerLabelRenderer,
  resolveControlledPlayerLabelStates,
  resolveControlledPlayerLabelGroupVisibility,
} from '../src/presentation/ControlledPlayerLabel';
import {
  createGameplayRosterBinding,
  getRosterPlayerForGameplayId,
} from '../src/roster/GameplayRosterBinding';
import { resolveTeamPresentationTheme } from '../src/teams/TeamThemeApplier';
import { DEFAULT_TEAM_PROFILE_SETTINGS } from '../src/teams/TeamProfileStore';

const enabledSettings = {
  controlledPlayerLabelEnabled: true,
  selectedReceiverLabelEnabled: true,
};

describe('controlled player label state', () => {
  it('begins on the correct run-play carrier', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    const snapshot = snapshotGameplayModel(gameplay);
    const binding = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const [controlled] = resolveControlledPlayerLabelStates({
      activeShotName: null,
      appPhase: 'gameplay',
      binding,
      gameplay: snapshot,
      gameplayActive: true,
      settings: enabledSettings,
    });

    expect(snapshot.player.id).toBe('offense-rb');
    expect(controlled).toMatchObject({
      displayName: getRosterPlayerForGameplayId(binding, 'offense-rb')?.displayName,
      gameplayPlayerId: 'offense-rb',
      jerseyNumber: getRosterPlayerForGameplayId(binding, 'offense-rb')?.jerseyNumber,
      visible: true,
      visibilityReason: 'visible',
    });
  });

  it('transfers to the new controlled receiver after a catch snapshot', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    expect(selectPlay(gameplay, 'spread-quick-11')).toBe(true);
    const snapshot = snapshotGameplayModel(gameplay);
    const receiver = snapshot.players.find((player) => player.id === 'offense-wr-left');
    if (!receiver) {
      throw new Error('Missing receiver');
    }
    const caughtSnapshot = {
      ...snapshot,
      ball: {
        ...snapshot.ball,
        possession: { kind: 'player' as const, playerId: receiver.id },
        state: { kind: 'caught' as const, playerId: receiver.id },
      },
      player: {
        ...receiver,
        currentState: 'userControlled' as const,
      },
    };
    const binding = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const [controlled] = resolveControlledPlayerLabelStates({
      activeShotName: null,
      appPhase: 'gameplay',
      binding,
      gameplay: caughtSnapshot,
      gameplayActive: true,
      settings: enabledSettings,
    });

    expect(controlled.gameplayPlayerId).toBe('offense-wr-left');
    expect(controlled.rosterPlayerId).toBe(
      getRosterPlayerForGameplayId(binding, 'offense-wr-left')?.id,
    );
  });

  it('restores the correct controlled identity after reset snapshots', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    const binding = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const [controlled] = resolveControlledPlayerLabelStates({
      activeShotName: null,
      appPhase: 'gameplay',
      binding,
      gameplay: snapshotGameplayModel(gameplay),
      gameplayActive: true,
      settings: enabledSettings,
    });

    expect(controlled.gameplayPlayerId).toBe('offense-rb');
    expect(controlled.rosterPlayerId).toBe(
      getRosterPlayerForGameplayId(binding, 'offense-rb')?.id,
    );
  });

  it('hides labels when disabled or suppressed by menus and presentation shots', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    const binding = createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS);
    const snapshot = snapshotGameplayModel(gameplay);

    expect(resolveControlledPlayerLabelStates({
      activeShotName: null,
      appPhase: 'gameplay',
      binding,
      gameplay: snapshot,
      gameplayActive: true,
      settings: {
        controlledPlayerLabelEnabled: false,
        selectedReceiverLabelEnabled: false,
      },
    })[0]).toMatchObject({
      visible: false,
      visibilityReason: 'controlledLabelDisabled',
    });

    expect(resolveControlledPlayerLabelStates({
      activeShotName: null,
      appPhase: 'gameplay',
      binding,
      gameplay: snapshot,
      gameplayActive: false,
      settings: enabledSettings,
    })[0]).toMatchObject({
      visible: false,
      visibilityReason: 'menuOrPaused',
    });

    expect(resolveControlledPlayerLabelStates({
      activeShotName: 'touchdownOrbit360',
      appPhase: 'gameplay',
      binding,
      gameplay: snapshot,
      gameplayActive: true,
      settings: enabledSettings,
    })[0]).toMatchObject({
      visible: false,
      visibilityReason: 'presentationShot',
    });
  });

  it('restores the parent label group after presentation stages hide it', () => {
    const renderer = new ControlledPlayerLabelRenderer({
      binding: createGameplayRosterBinding('11v11', DEFAULT_TEAM_PROFILE_SETTINGS),
      settings: enabledSettings,
      teamTheme: resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS),
    });

    expect(resolveControlledPlayerLabelGroupVisibility('kickoff')).toBe(false);
    renderer.setApplicationPhase('kickoff');
    expect(renderer.group.visible).toBe(false);

    renderer.group.visible = false;
    renderer.setApplicationPhase('gameplay');

    expect(resolveControlledPlayerLabelGroupVisibility('gameplay')).toBe(true);
    expect(renderer.group.visible).toBe(true);
    renderer.dispose();
  });
});
