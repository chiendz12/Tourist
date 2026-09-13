import { Role } from '@prisma/client';

export const PUBLIC_ROLES = [Role.GUEST, Role.MEMBER] as const;
export const TRAINING_ROLES = [Role.STUDENT, Role.LEADER, Role.LECTURER] as const;
export const ADMIN_ROLES = [Role.SUPER_ADMIN] as const;

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.GUEST]: 0,
  [Role.MEMBER]: 1,
  [Role.STUDENT]: 2,
  [Role.LEADER]: 3,
  [Role.LECTURER]: 4,
  [Role.SUPER_ADMIN]: 5,
};
