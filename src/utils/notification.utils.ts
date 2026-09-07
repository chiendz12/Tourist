import { ApprovalStatus, EntityType } from '@prisma/client';

const MESSAGES: Record<ApprovalStatus, string> = {
  [ApprovalStatus.DRAFT]: 'was sent back to you for revision',
  [ApprovalStatus.PENDING_LEADER]: 'is awaiting review by your group leader',
  [ApprovalStatus.PENDING_LECTURER]: 'passed the leader review and is now with your lecturer',
  [ApprovalStatus.PENDING_ADMIN]: 'passed the lecturer review and is now with the admin',
  [ApprovalStatus.PUBLISHED]: 'has been published and is now visible to the public',
  [ApprovalStatus.REJECTED]: 'was rejected',
};

export function buildApprovalNotification(
  entityType: EntityType,
  entityId: string,
  status: ApprovalStatus,
  comment?: string | null,
) {
  const subject = entityType.toLowerCase();
  return {
    title: `Your ${subject} ${status === ApprovalStatus.PUBLISHED ? 'was published' : 'changed status'}`,
    body: comment
      ? `Your ${subject} ${MESSAGES[status]}: ${comment}`
      : `Your ${subject} ${MESSAGES[status]}.`,
    type: 'APPROVAL',
    data: { entityType, entityId, status, comment: comment ?? null },
  };
}
