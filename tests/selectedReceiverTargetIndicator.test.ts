import { describe, expect, it } from 'vitest';
import {
  attemptPass,
  createGameplayModel,
  cycleSelectedReceiver,
  selectPlay,
  snapshotGameplayModel,
  startPlay,
} from '../src/playState';
import {
  SelectedReceiverTargetIndicator,
  resolveSelectedReceiverTargetIndicatorState,
} from '../src/presentation/SelectedReceiverTargetIndicator';

describe('selected receiver target indicator', () => {
  it('stays hidden before the snap and appears under the selected live receiver', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    expect(selectPlay(gameplay, 'slant-flat')).toBe(true);
    const receiver = snapshotGameplayModel(gameplay).selectedReceiver;
    if (!receiver) {
      throw new Error('Expected selected receiver');
    }

    expect(resolveSelectedReceiverTargetIndicatorState(snapshotGameplayModel(gameplay))).toMatchObject({
      receiverId: receiver.id,
      visible: false,
      visibilityReason: 'notLive',
    });

    expect(startPlay(gameplay)).toBe(true);
    const liveSnapshot = snapshotGameplayModel(gameplay);
    const receiverPlayer = liveSnapshot.players.find((player) => player.id === receiver.id);
    const state = resolveSelectedReceiverTargetIndicatorState(liveSnapshot);

    expect(state).toMatchObject({
      receiverId: receiver.id,
      visible: true,
      visibilityReason: 'visible',
    });
    expect(state.position).toEqual(receiverPlayer?.position);
  });

  it('moves when cycling receivers after the snap', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    expect(selectPlay(gameplay, 'slant-flat')).toBe(true);
    expect(startPlay(gameplay)).toBe(true);
    const first = resolveSelectedReceiverTargetIndicatorState(snapshotGameplayModel(gameplay));

    expect(cycleSelectedReceiver(gameplay)).toBe(true);
    const secondSnapshot = snapshotGameplayModel(gameplay);
    const second = resolveSelectedReceiverTargetIndicatorState(secondSnapshot);
    const receiverPlayer = secondSnapshot.players.find((player) => player.id === second.receiverId);

    expect(second.visible).toBe(true);
    expect(second.receiverId).not.toBe(first.receiverId);
    expect(second.position).toEqual(receiverPlayer?.position);
  });

  it('hides after the selected pass is thrown', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    expect(selectPlay(gameplay, 'slant-flat')).toBe(true);
    expect(startPlay(gameplay)).toBe(true);
    expect(attemptPass(gameplay)).toBe(true);

    expect(resolveSelectedReceiverTargetIndicatorState(snapshotGameplayModel(gameplay))).toMatchObject({
      visible: false,
      visibilityReason: 'passAlreadyThrown',
    });
  });

  it('syncs the field-space ring visibility and receiver position', () => {
    const gameplay = createGameplayModel({ playbookId: '5v5' });
    expect(selectPlay(gameplay, 'slant-flat')).toBe(true);
    expect(startPlay(gameplay)).toBe(true);
    const renderer = new SelectedReceiverTargetIndicator();
    const snapshot = snapshotGameplayModel(gameplay);
    const receiverId = snapshot.selectedReceiver?.id;
    const receiver = snapshot.players.find((player) => player.id === receiverId);

    renderer.update(snapshot, 1 / 60);

    expect(renderer.group.visible).toBe(true);
    expect(renderer.getSnapshot()).toMatchObject({
      receiverId,
      visible: true,
      visibilityReason: 'visible',
    });
    expect(renderer.group.position.x).toBeCloseTo(receiver?.position.x ?? 0);
    expect(renderer.group.position.z).toBeCloseTo(receiver?.position.z ?? 0);

    renderer.dispose();
  });
});
