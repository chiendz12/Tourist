import { ApprovalLevel, ApprovalStatus, Role } from '@prisma/client';

export const APPROVAL_LEVEL_ROLE: Record<ApprovalLevel, Role> = {
  [ApprovalLevel.LEADER]: Role.LEADER,
  [ApprovalLevel.LECTURER]: Role.LECTURER,
  [ApprovalLevel.ADMIN]: Role.SUPER_ADMIN,
};

export const APPROVAL_STATUS_BY_LEVEL: Record<ApprovalLevel, ApprovalStatus> = {
  [ApprovalLevel.LEADER]: ApprovalStatus.PENDING_LEADER,
  [ApprovalLevel.LECTURER]: ApprovalStatus.PENDING_LECTURER,
  [ApprovalLevel.ADMIN]: ApprovalStatus.PENDING_ADMIN,
};

export const NEXT_APPROVAL_LEVEL: Partial<Record<ApprovalLevel, ApprovalLevel>> = {
  [ApprovalLevel.LEADER]: ApprovalLevel.LECTURER,
  [ApprovalLevel.LECTURER]: ApprovalLevel.ADMIN,
};
