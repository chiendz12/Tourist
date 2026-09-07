import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Actor } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Spatial permission model — mục V của mô tả hệ thống:
 *
 *   Sinh viên → chỉ tỉnh được giao
 *   Leader    → tỉnh nhóm phụ trách
 *   Giảng viên→ toàn bộ lớp
 *   Admin     → toàn quốc
 *
 * Lecturers and the admin oversee whole classes, which may span several provinces,
 * so they are not restricted to an assignment list. Students and leaders are.
 */
@Injectable()
export class ProvinceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isUnscoped(role: Role): boolean {
    return role === Role.SUPER_ADMIN || role === Role.LECTURER;
  }

  requiresAssignment(role: Role): boolean {
    return role === Role.STUDENT || role === Role.LEADER;
  }

  /**
   * Students and leaders may only work with records whose every province is in
   * their assignment set. A missing province is not a safe default for scoped
   * training users, so it is rejected as well.
   */
  async assertCanAccessProvinces(
    actor: Actor,
    provinceIds: Array<string | null | undefined>,
  ): Promise<void> {
    if (!this.requiresAssignment(actor.role)) return;
    if (provinceIds.some((id) => !id)) {
      throw new ForbiddenException('This record is missing a province assignment');
    }
    const uniqueProvinceIds = [...new Set(provinceIds as string[])];

    const assigned = await this.prisma.userProvince.count({
      where: { userId: actor.id, provinceId: { in: uniqueProvinceIds } },
    });
    if (assigned !== uniqueProvinceIds.length) {
      throw new ForbiddenException('You are not assigned to every province in this record');
    }
  }

  async assignedProvinceIds(actor: Actor): Promise<string[] | null> {
    if (!this.requiresAssignment(actor.role)) return null;
    const rows = await this.prisma.userProvince.findMany({
      where: { userId: actor.id },
      select: { provinceId: true },
    });
    return rows.map((row) => row.provinceId);
  }

  /**
   * Throws unless `actor` may write data belonging to `provinceId`.
   * `required: false` tolerates a missing province (e.g. a PATCH that touches
   * nothing spatial on a record created before provinces became mandatory).
   */
  async assertCanWrite(
    actor: Actor,
    provinceId: string | null | undefined,
    options: { required?: boolean } = {},
  ): Promise<void> {
    if (this.isUnscoped(actor.role)) return;
    if (!provinceId) {
      if (options.required === false) return;
      throw new ForbiddenException(
        'provinceId is required — you may only enter data for the province you were assigned',
      );
    }
    const assigned = await this.prisma.userProvince.findUnique({
      where: { userId_provinceId: { userId: actor.id, provinceId } },
      select: { provinceId: true },
    });
    if (!assigned) {
      throw new ForbiddenException('You are not assigned to this province');
    }
  }

  listForUser(userId: string) {
    return this.prisma.userProvince.findMany({
      where: { userId },
      include: { province: true },
      orderBy: { assignedAt: 'asc' },
    });
  }

  /** Giảng viên "phân vùng địa lý cho SV"; admin may assign anyone. */
  async assign(targetUserId: string, provinceId: string, actor: Actor) {
    await this.assertMayManage(targetUserId, actor);
    const [user, province] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } }),
      this.prisma.province.findUnique({ where: { id: provinceId }, select: { id: true } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!province) throw new NotFoundException('Province not found');

    return this.prisma.userProvince.upsert({
      where: { userId_provinceId: { userId: targetUserId, provinceId } },
      create: { userId: targetUserId, provinceId },
      update: {},
      include: { province: true },
    });
  }

  async unassign(targetUserId: string, provinceId: string, actor: Actor) {
    await this.assertMayManage(targetUserId, actor);
    const removed = await this.prisma.userProvince.deleteMany({
      where: { userId: targetUserId, provinceId },
    });
    if (removed.count === 0) throw new NotFoundException('This user is not assigned to that province');
    return { userId: targetUserId, provinceId, removed: true };
  }

  /** A lecturer may only re-zone students inside a class they actually teach. */
  private async assertMayManage(targetUserId: string, actor: Actor) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (actor.role !== Role.LECTURER) {
      throw new ForbiddenException('Only a lecturer or the admin can assign provinces');
    }
    const inMyClass = await this.prisma.classMember.findFirst({
      where: { userId: targetUserId, class: { lecturerId: actor.id } },
      select: { userId: true },
    });
    if (!inMyClass) {
      throw new ForbiddenException('This student is not in a class you teach');
    }
  }
}
