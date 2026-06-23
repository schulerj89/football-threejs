import { describe, expect, it } from 'vitest';
import { OnFieldStageController } from '../../../src/presentation/stage/OnFieldStageController';
import {
  ON_FIELD_STAGE_PRIMARY_GROUP,
  ON_FIELD_STAGE_VISIBILITY,
  type OnFieldStageId,
} from '../../../src/presentation/stage/OnFieldStageTypes';

const STAGES = Object.keys(ON_FIELD_STAGE_VISIBILITY) as OnFieldStageId[];

describe('OnFieldStageController', () => {
  it('starts with no active on-field stage', () => {
    const controller = new OnFieldStageController();

    expect(controller.getSnapshot()).toEqual({
      activePrimaryGroup: null,
      stageId: 'none',
      transitionCount: 0,
      visibility: ON_FIELD_STAGE_VISIBILITY.none,
    });
  });

  it('transitions deterministically without counting repeated same-stage requests', () => {
    const controller = new OnFieldStageController();

    controller.transitionTo('pregameWarmup');
    controller.transitionTo('pregameWarmup');
    controller.transitionTo('coinToss');

    expect(controller.getSnapshot().stageId).toBe('coinToss');
    expect(controller.getSnapshot().transitionCount).toBe(2);
    expect(controller.isPrimaryGroupActive('coinTossParticipants')).toBe(true);
  });

  it('declares exactly one primary participant group for every active stage', () => {
    for (const stage of STAGES) {
      const primaryGroup = ON_FIELD_STAGE_PRIMARY_GROUP[stage];
      if (stage === 'none') {
        expect(primaryGroup).toBeNull();
        continue;
      }

      expect(primaryGroup).not.toBeNull();
      expect(ON_FIELD_STAGE_VISIBILITY[stage][primaryGroup!]).toBe(true);
    }
  });

  it('keeps scrimmage gameplay players distinct from kickoff and field-goal participants', () => {
    const controller = new OnFieldStageController();

    controller.transitionTo('scrimmage');
    expect(controller.getSnapshot().visibility.gameplayPlayers).toBe(true);
    expect(controller.getSnapshot().visibility.kickoffParticipants).toBe(false);
    expect(controller.getSnapshot().visibility.fieldGoalParticipants).toBe(false);

    controller.transitionTo('kickoff');
    expect(controller.getSnapshot().visibility.gameplayPlayers).toBe(false);
    expect(controller.getSnapshot().visibility.kickoffParticipants).toBe(true);

    controller.transitionTo('fieldGoal');
    expect(controller.getSnapshot().visibility.kickoffParticipants).toBe(false);
    expect(controller.getSnapshot().visibility.fieldGoalParticipants).toBe(true);
  });
});
