import { ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, Role } from '@prisma/client';
import { assertCanDelete, assertCanUpdate, canRead } from './ownership.util';

describe('ownership rules', () => {
  const draft = { createdById: 'student-1', status: ApprovalStatus.DRAFT };
  const published = { createdById: 'student-1', status: ApprovalStatus.PUBLISHED };

  it('allows an owner to update a draft', () => {
    expect(() => assertCanUpdate(draft, { id: 'student-1', role: Role.STUDENT })).not.toThrow();
  });

  it('rejects another student updating an owned draft', () => {
    expect(() => assertCanUpdate(draft, { id: 'student-2', role: Role.STUDENT })).toThrow(ForbiddenException);
  });

  it('locks an owner out of published records', () => {
    expect(() => assertCanUpdate(published, { id: 'student-1', role: Role.STUDENT })).toThrow(ForbiddenException);
    expect(() => assertCanDelete(published, { id: 'student-1', role: Role.STUDENT })).toThrow(ForbiddenException);
  });

  it('allows lecturers and admins to update for quality control', () => {
    expect(() => assertCanUpdate(published, { id: 'lecturer-1', role: Role.LECTURER })).not.toThrow();
    expect(() => assertCanUpdate(published, { id: 'admin-1', role: Role.SUPER_ADMIN })).not.toThrow();
  });

  it('only exposes unpublished records to their owner or reviewers', () => {
    expect(canRead(draft)).toBe(false);
    expect(canRead(draft, { id: 'student-1', role: Role.STUDENT })).toBe(true);
    expect(canRead(draft, { id: 'student-2', role: Role.STUDENT })).toBe(false);
    expect(canRead(draft, { id: 'leader-1', role: Role.LEADER })).toBe(true);
    expect(canRead(published)).toBe(true);
  });
});
