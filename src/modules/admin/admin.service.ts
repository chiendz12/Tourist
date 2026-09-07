import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, ModerationStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Actor } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../../types';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { ModerationKind, QueryModerationDto } from './dto/query-moderation.dto';

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  phone: true,
  role: true,
  isActive: true,
  emailVerified: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [users, destinations, routes, tours, suppliers, pendingApprovals, publishedDestinations] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.destination.count(),
        this.prisma.route.count(),
        this.prisma.tour.count(),
        this.prisma.supplier.count(),
        this.prisma.approval.count({
          where: {
            status: {
              in: [
                ApprovalStatus.PENDING_LEADER,
                ApprovalStatus.PENDING_LECTURER,
                ApprovalStatus.PENDING_ADMIN,
              ],
            },
          },
        }),
        this.prisma.destination.count({ where: { status: ApprovalStatus.PUBLISHED } }),
      ]);

    const byRole = await this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
    return {
      users,
      usersByRole: Object.fromEntries(byRole.map((row) => [row.role, row._count._all])),
      destinations,
      publishedDestinations,
      routes,
      tours,
      suppliers,
      pendingApprovals,
    };
  }

  async listUsers(query: QueryUserDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.q) {
      where.OR = [
        { fullName: { contains: query.q, mode: 'insensitive' } },
        { email: { contains: query.q, mode: 'insensitive' } },
        { username: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async createUser(dto: CreateUserDto, actor: Actor) {
    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { id: true },
    });
    if (clash) throw new ConflictException('Email or username already used');
    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        // Created by an administrator, so treat the address as vouched for.
        emailVerified: true,
      },
      select: USER_SELECT,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'ADMIN_CREATE_USER',
        entity: 'User',
        entityId: created.id,
        metadata: { role: created.role, email: created.email },
      },
    });
    return created;
  }

  async updateUser(id: string, dto: UpdateUserDto, actor: Actor) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) throw new NotFoundException('User not found');
    // Locking yourself out of the only super-admin account is unrecoverable.
    if (id === actor.id && (dto.isActive === false || (dto.role && dto.role !== actor.role))) {
      throw new BadRequestException('You cannot lock or demote your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
    // A locked-out user must not keep working on an old refresh token.
    if (dto.isActive === false) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'ADMIN_UPDATE_USER',
        entity: 'User',
        entityId: id,
        metadata: { ...dto },
      },
    });
    return updated;
  }

  async reports() {
    const [approvalStatus, approvalEntity, destinationStatus, routeStatus, tourStatus, supplierStatus, costStatus] = await Promise.all([
      this.prisma.approval.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.approval.groupBy({ by: ['entityType'], _count: { _all: true } }),
      this.prisma.destination.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.route.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.tour.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.supplier.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.tourCost.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const mapRows = <T extends string>(rows: Array<{ status: T; _count: { _all: number } }>) =>
      Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
    return {
      approvalsByStatus: mapRows(approvalStatus),
      approvalsByEntity: Object.fromEntries(approvalEntity.map((row) => [row.entityType, row._count._all])),
      contentByStatus: {
        destinations: mapRows(destinationStatus),
        routes: mapRows(routeStatus),
        tours: mapRows(tourStatus),
        suppliers: mapRows(supplierStatus),
        tourCosts: mapRows(costStatus),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async audit(query: QueryAuditDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.entity) where.entity = { contains: query.entity, mode: 'insensitive' };
    if (query.q) {
      where.OR = [
        { action: { contains: query.q, mode: 'insensitive' } },
        { entity: { contains: query.q, mode: 'insensitive' } },
        { user: { fullName: { contains: query.q, mode: 'insensitive' } } },
      ];
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async moderation(query: QueryModerationDto) {
    const status = query.status ?? ModerationStatus.PENDING;
    const include = {
      user: { select: { id: true, fullName: true, email: true } },
      destination: { select: { id: true, name: true, slug: true } },
    };
    const ratings = query.kind === ModerationKind.COMMENT
      ? []
      : await this.prisma.rating.findMany({ where: { moderationStatus: status }, include, orderBy: { createdAt: 'desc' } });
    const comments = query.kind === ModerationKind.RATING
      ? []
      : await this.prisma.comment.findMany({ where: { moderationStatus: status }, include, orderBy: { createdAt: 'desc' } });
    return { status, ratings, comments, total: ratings.length + comments.length };
  }

  async moderate(kind: ModerationKind, id: string, status: ModerationStatus, actor: Actor) {
    if (kind === ModerationKind.RATING) {
      const result = await this.prisma.rating.updateMany({ where: { id }, data: { moderationStatus: status } });
      if (!result.count) throw new NotFoundException('Rating not found');
    } else {
      const result = await this.prisma.comment.updateMany({ where: { id }, data: { moderationStatus: status } });
      if (!result.count) throw new NotFoundException('Comment not found');
    }
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: `MODERATION_${status}`, entity: kind, entityId: id },
    });
    return { id, kind, moderationStatus: status };
  }
}
