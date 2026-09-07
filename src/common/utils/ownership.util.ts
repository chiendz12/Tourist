import { ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, Role } from '@prisma/client';

export type Actor = { id: string; role: Role };

/** Any record that goes through the 4-level approval flow. */
export type OwnedEntity = { createdById: string | null; status: ApprovalStatus };

/**
 * Statuses in which the author may still change their own submission.
 * Once it is in review (PENDING_*) or live (PUBLISHED) the author is locked out —
 * a reviewer has to send it back first.
 */
export const EDITABLE_BY_OWNER: ApprovalStatus[] = [
  ApprovalStatus.DRAFT,
  ApprovalStatus.REJECTED,
];

/** Roles that may read a record regardless of its approval status. */
export const REVIEWER_ROLES: Role[] = [Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN];

/**
 * Update rule (mục III của mô tả hệ thống):
 * - SV/Leader: chỉ sửa dữ liệu của mình, và chỉ khi chưa gửi duyệt hoặc đã bị trả lại.
 * - GV/Admin: sửa được mọi dữ liệu (kiểm soát chất lượng, chỉ số "% bị sửa").
 */
export function assertCanUpdate(entity: OwnedEntity, actor: Actor, label = 'record'): void {
  if (actor.role === Role.SUPER_ADMIN || actor.role === Role.LECTURER) return;
  if (entity.createdById !== actor.id) {
    throw new ForbiddenException(`You may only edit your own ${label}`);
  }
  if (!EDITABLE_BY_OWNER.includes(entity.status)) {
    throw new ForbiddenException(
      `This ${label} is ${entity.status}; ask a reviewer to send it back before editing`,
    );
  }
}

/** Delete is stricter than update: only the author (while still editable) or the admin. */
export function assertCanDelete(entity: OwnedEntity, actor: Actor, label = 'record'): void {
  if (actor.role === Role.SUPER_ADMIN) return;
  if (entity.createdById !== actor.id) {
    throw new ForbiddenException(`You may only delete your own ${label}`);
  }
  if (!EDITABLE_BY_OWNER.includes(entity.status)) {
    throw new ForbiddenException(
      `This ${label} is ${entity.status} and can no longer be deleted`,
    );
  }
}

/**
 * Read rule for a single record: published records are open to everyone,
 * anything else is visible only to its author and to reviewers.
 */
export function canRead(entity: OwnedEntity, actor?: Actor): boolean {
  if (entity.status === ApprovalStatus.PUBLISHED) return true;
  if (!actor) return false;
  return REVIEWER_ROLES.includes(actor.role) || entity.createdById === actor.id;
}
