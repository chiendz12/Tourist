import { ApprovalAction, ApprovalLevel, ApprovalStatus } from '@prisma/client';
import { ApprovalService } from './approval.service';

describe('ApprovalService transitions', () => {
  const service = new ApprovalService({} as never, {} as never);
  const transition = (level: ApprovalLevel, action: ApprovalAction) =>
    (service as unknown as { resolveTransition: (level: ApprovalLevel, action: ApprovalAction) => { status: ApprovalStatus; level: ApprovalLevel } }).resolveTransition(level, action);

  it('moves approval through leader, lecturer, then admin', () => {
    expect(transition(ApprovalLevel.LEADER, ApprovalAction.APPROVE)).toEqual({ status: ApprovalStatus.PENDING_LECTURER, level: ApprovalLevel.LECTURER });
    expect(transition(ApprovalLevel.LECTURER, ApprovalAction.APPROVE)).toEqual({ status: ApprovalStatus.PENDING_ADMIN, level: ApprovalLevel.ADMIN });
    expect(transition(ApprovalLevel.ADMIN, ApprovalAction.APPROVE)).toEqual({ status: ApprovalStatus.PUBLISHED, level: ApprovalLevel.ADMIN });
  });

  it('distinguishes revise from terminal rejection', () => {
    expect(transition(ApprovalLevel.LEADER, ApprovalAction.REVISE)).toEqual({ status: ApprovalStatus.DRAFT, level: ApprovalLevel.LEADER });
    expect(transition(ApprovalLevel.LECTURER, ApprovalAction.REJECT)).toEqual({ status: ApprovalStatus.REJECTED, level: ApprovalLevel.LECTURER });
  });
});
