import {
  ON_FIELD_STAGE_PRIMARY_GROUP,
  ON_FIELD_STAGE_VISIBILITY,
  type OnFieldParticipantGroupId,
  type OnFieldStageId,
  type OnFieldStageSnapshot,
  type OnFieldStageVisibility,
} from './OnFieldStageTypes';

export class OnFieldStageController {
  private stageId: OnFieldStageId = 'none';
  private transitionCount = 0;

  get currentStageId(): OnFieldStageId {
    return this.stageId;
  }

  get activePrimaryGroup(): OnFieldParticipantGroupId | null {
    return ON_FIELD_STAGE_PRIMARY_GROUP[this.stageId];
  }

  transitionTo(nextStageId: OnFieldStageId): void {
    if (this.stageId === nextStageId) {
      return;
    }
    this.stageId = nextStageId;
    this.transitionCount += 1;
  }

  getVisibility(): OnFieldStageVisibility {
    return { ...ON_FIELD_STAGE_VISIBILITY[this.stageId] };
  }

  isPrimaryGroupActive(groupId: OnFieldParticipantGroupId): boolean {
    return this.activePrimaryGroup === groupId;
  }

  getSnapshot(): OnFieldStageSnapshot {
    return {
      activePrimaryGroup: this.activePrimaryGroup,
      stageId: this.stageId,
      transitionCount: this.transitionCount,
      visibility: this.getVisibility(),
    };
  }
}
