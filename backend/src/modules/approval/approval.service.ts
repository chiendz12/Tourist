import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalAction,
  ApprovalLevel,
  ApprovalStatus,
  EntityType,
  Prisma,
  Role,
} from '@prisma/client';
import {
  APPROVAL_LEVEL_ROLE,
  APPROVAL_STATUS_BY_LEVEL,
  NEXT_APPROVAL_LEVEL,
} from '../../constants/approval.constant';
import { Actor } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../../types';
import { buildApprovalNotification } from '../../utils/notification.utils';
import { EmailService } from '../notification/email.service';
import { QueryApprovalDto } from './dto/query-approval.dto';
import { ReviewApprovalDto } from './dto/review-approval.dto';
import { SubmitApprovalDto } from './dto/submit-approval.dto';

/** Only unsubmitted or bounced work can enter the queue. */
const SUBMITTABLE_STATUSES: ApprovalStatus[] = [ApprovalStatus.DRAFT, ApprovalStatus.REJECTED];

/** Statuses in which a reviewer may act. */
const PENDING_STATUSES: ApprovalStatus[] = [
  ApprovalStatus.PENDING_LEADER,
  ApprovalStatus.PENDING_LECTURER,
  ApprovalStatus.PENDING_ADMIN,
];

type Transition = {
  status: ApprovalStatus;
  level: ApprovalLevel;
};

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * Review queue, scoped to what the caller is actually responsible for:
   * Leader → their group, Lecturer → their classes, Admin → everything.
   */
  async findAll(actor: Actor, query: QueryApprovalDto): Promise<PaginatedResult<unknown>> {
    const where = await this.buildWhere(actor, query);
    return this.paginate(where, query);
  }

  /** Counts the same scoped data as the queue, without pagination. */
  async summary(actor: Actor, query: QueryApprovalDto) {
    const where = await this.buildWhere(actor, {
      ...query,
      status: undefined,
      pendingOnly: undefined,
    });
    const grouped = await this.prisma.approval.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      Object.values(ApprovalStatus).map((status) => [status, 0]),
    ) as Record<ApprovalStatus, number>;
    for (const row of grouped) byStatus[row.status] = row._count._all;

    return {
      total: grouped.reduce((sum, row) => sum + row._count._all, 0),
      pending: PENDING_STATUSES.reduce((sum, status) => sum + byStatus[status], 0),
      byStatus,
    };
  }

  /** A student's own submissions, so they can follow their work through the flow. */
  findMine(actor: Actor, query: QueryApprovalDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ApprovalWhereInput = { submittedById: actor.id };
    if (query.status) where.status = query.status;
    if (query.entityType) where.entityType = query.entityType;
    return this.paginate(where, query);
  }

  async findOne(id: string, actor: Actor) {
    const approval = await this.prisma.approval.findUnique({
      where: { id },
      include: { history: { orderBy: { createdAt: 'asc' } } },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.submittedById !== actor.id) {
      await this.assertReviewerScope(actor, approval.submittedById);
    }
    return {
      ...approval,
      entity: await this.entityDetails(approval.entityType, approval.entityId),
      submittedBy: await this.userSummary(approval.submittedById),
    };
  }

  /** Sinh viên gửi duyệt — only their own work, and only if it is not already in the queue. */
  async submit(dto: SubmitApprovalDto, actor: Actor) {
    const entity = await this.loadEntity(dto.entityType, dto.entityId);
    if (!entity) throw new NotFoundException(`${dto.entityType} not found`);
    if (actor.role !== Role.SUPER_ADMIN && (!entity.createdById || entity.createdById !== actor.id)) {
      throw new ForbiddenException('You may only submit your own work for approval');
    }
    if (!SUBMITTABLE_STATUSES.includes(entity.status)) {
      throw new ConflictException(
        `This ${dto.entityType.toLowerCase()} is ${entity.status} and cannot be submitted again`,
      );
    }

    const submitterId = entity.createdById ?? actor.id;
    const historyEntry = {
      actorId: actor.id,
      level: ApprovalLevel.LEADER,
      action: ApprovalAction.SUBMIT,
    };
    const approval = await this.prisma.$transaction(async (tx) => {
      await this.updateEntityStatus(tx, dto.entityType, dto.entityId, ApprovalStatus.PENDING_LEADER);
      return tx.approval.upsert({
        where: { entityType_entityId: { entityType: dto.entityType, entityId: dto.entityId } },
        create: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          // Keyed to the author, not the caller — reviewer scoping depends on it.
           submittedById: submitterId,
          currentLevel: ApprovalLevel.LEADER,
          status: ApprovalStatus.PENDING_LEADER,
          history: { create: historyEntry },
        },
        update: {
           submittedById: submitterId,
          currentLevel: ApprovalLevel.LEADER,
          status: ApprovalStatus.PENDING_LEADER,
          history: { create: historyEntry },
        },
        include: { history: { orderBy: { createdAt: 'asc' } } },
      });
    });
    const reviewers = await this.reviewerRecipients(submitterId, ApprovalLevel.LEADER);
    await this.notifyUsers(
      reviewers,
      `Hồ sơ ${dto.entityType} đang chờ Leader duyệt`,
      `Có hồ sơ ${dto.entityType.toLowerCase()} mới đang chờ bạn kiểm duyệt. Mã hồ sơ: ${dto.entityId}.`,
      { entityType: dto.entityType, entityId: dto.entityId, status: ApprovalStatus.PENDING_LEADER },
    );
    await this.email.sendToUser(
      submitterId,
      `Đã gửi ${dto.entityType.toLowerCase()} để duyệt`,
      `Hồ sơ của bạn đã được gửi vào quy trình duyệt cấp Leader. Mã hồ sơ: ${dto.entityId}.`,
    );
    return approval;
  }

  async review(id: string, dto: ReviewApprovalDto, actor: Actor) {
    const approval = await this.prisma.approval.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException('Approval not found');
    if (!PENDING_STATUSES.includes(approval.status)) {
      throw new ConflictException(`This submission is ${approval.status} and is not awaiting review`);
    }

    const requiredRole = APPROVAL_LEVEL_ROLE[approval.currentLevel];
    // Lecturer is the final gate: they may finalize anything at lecturer level
    // AND legacy rows already sitting at ADMIN (by level or by status, in case
    // older rows have the two out of sync), so they drain to PUBLISHED.
    const isLegacyAdminRow =
      approval.currentLevel === ApprovalLevel.ADMIN || approval.status === ApprovalStatus.PENDING_ADMIN;
    const canReview =
      actor.role === Role.SUPER_ADMIN ||
      actor.role === requiredRole ||
      (actor.role === Role.LECTURER && isLegacyAdminRow);
    if (!canReview) {
      throw new ForbiddenException(
        `This submission is waiting for ${requiredRole}, not ${actor.role}`,
      );
    }
    await this.assertReviewerScope(actor, approval.submittedById);

    const next = this.resolveTransition(approval.currentLevel, dto.action);
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.updateEntityStatus(tx, approval.entityType, approval.entityId, next.status);
      const updated = await tx.approval.update({
        where: { id },
        data: {
          status: next.status,
          currentLevel: next.level,
          history: {
            create: {
              actorId: actor.id,
              // The history records the level that acted, not the level it moves to.
              level: approval.currentLevel,
              action: dto.action,
              comment: dto.comment,
            },
          },
        },
        include: { history: { orderBy: { createdAt: 'asc' } } },
      });
      await tx.notification.create({
        data: {
          userId: approval.submittedById,
          ...buildApprovalNotification(
            approval.entityType,
            approval.entityId,
            next.status,
            dto.comment,
          ),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: `APPROVAL_${dto.action}`,
          entity: approval.entityType,
          entityId: approval.entityId,
          metadata: { status: next.status, comment: dto.comment ?? null },
        },
      });
      return updated;
    });
    const submitterNotification = buildApprovalNotification(
      approval.entityType,
      approval.entityId,
      next.status,
      dto.comment,
    );
    await this.email.sendToUser(
      approval.submittedById,
      submitterNotification.title,
      submitterNotification.body,
    );
    if (PENDING_STATUSES.includes(next.status)) {
      const reviewers = await this.reviewerRecipients(approval.submittedById, next.level);
      await this.notifyUsers(
        reviewers,
        `Hồ sơ ${approval.entityType} đang chờ ${next.level} duyệt`,
        `Hồ sơ ${approval.entityType.toLowerCase()} đã chuyển đến cấp ${next.level}. Mã hồ sơ: ${approval.entityId}.`,
        { entityType: approval.entityType, entityId: approval.entityId, status: next.status },
      );
    }
    return updated;
  }

  /**
   * REJECT is terminal; REVISE ("trả lại để chỉnh sửa") hands the record back to the
   * author as a draft so they can fix it and resubmit — the two are not the same thing.
   */
  private resolveTransition(currentLevel: ApprovalLevel, action: ApprovalAction): Transition {
    if (action === ApprovalAction.REJECT) {
      return { status: ApprovalStatus.REJECTED, level: currentLevel };
    }
    if (action === ApprovalAction.REVISE) {
      return { status: ApprovalStatus.DRAFT, level: ApprovalLevel.LEADER };
    }
    if (action !== ApprovalAction.APPROVE) {
      throw new BadRequestException('Invalid approval action');
    }
    const nextLevel = NEXT_APPROVAL_LEVEL[currentLevel];
    if (!nextLevel) {
      // Lecturer approval is the final gate — publish.
      // (ADMIN level has no next level either, for legacy rows.)
      return { status: ApprovalStatus.PUBLISHED, level: currentLevel };
    }
    return { status: APPROVAL_STATUS_BY_LEVEL[nextLevel], level: nextLevel };
  }

  /**
   * Reviewers only see their own people (mục II): a leader is responsible for their
   * group, a lecturer for the classes they teach. Nobody reviews their own submission.
   */
  private async assertReviewerScope(actor: Actor, submittedById: string) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (actor.id === submittedById) {
      throw new ForbiddenException('You cannot review your own submission');
    }
    const filter = await this.reviewableMemberFilter(actor);
    if (!filter) throw new ForbiddenException('You have no review scope');

    const inScope = await this.prisma.classMember.findFirst({
      where: { userId: submittedById, ...filter },
      select: { userId: true },
    });
    if (!inScope) {
      throw new ForbiddenException(
        actor.role === Role.LEADER
          ? 'This submission is not from your group'
          : 'This submission is not from a class you teach',
      );
    }
  }

  /** `null` = no scope at all; admins skip this path entirely. */
  private async reviewableMemberFilter(actor: Actor): Promise<Prisma.ClassMemberWhereInput | null> {
    if (actor.role === Role.LECTURER) {
      return { class: { lecturerId: actor.id } };
    }
    if (actor.role !== Role.LEADER) return null;

    const ledRows = await this.prisma.classMember.findMany({
      where: { userId: actor.id, isLeader: true },
      select: { classId: true, groupId: true },
    });
    if (ledRows.length === 0) return null;
    // A leader with a group covers that group; a class leader without one covers the class.
    return {
      OR: ledRows.map((row) =>
        row.groupId ? { groupId: row.groupId } : { classId: row.classId },
      ),
    };
  }

  /** List of user ids the caller may see submissions from; `null` = unrestricted. */
  private async submitterScope(actor: Actor): Promise<string[] | null> {
    if (actor.role === Role.SUPER_ADMIN) return null;
    const filter = await this.reviewableMemberFilter(actor);
    if (!filter) return [];
    const members = await this.prisma.classMember.findMany({
      where: filter,
      select: { userId: true },
      distinct: ['userId'],
    });
    return members.map((member) => member.userId);
  }

  private pendingStatusFor(role: Role): ApprovalStatus | undefined {
    if (role === Role.LEADER) return ApprovalStatus.PENDING_LEADER;
    if (role === Role.LECTURER) return ApprovalStatus.PENDING_LECTURER;
    if (role === Role.SUPER_ADMIN) return ApprovalStatus.PENDING_ADMIN;
    return undefined;
  }

  private async buildWhere(
    actor: Actor,
    query: QueryApprovalDto,
  ): Promise<Prisma.ApprovalWhereInput> {
    const where: Prisma.ApprovalWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.entityType) where.entityType = query.entityType;
    if (query.pendingOnly === 'true') {
      where.status = this.pendingStatusFor(actor.role) ?? { in: PENDING_STATUSES };
    }

    const scope = await this.submitterScope(actor);
    let submitterIds = scope?.filter((userId) => userId !== actor.id);
    if (query.hocPhan) {
      const enrolled = await this.prisma.user.findMany({
        where: { hocPhanEnrollments: { some: { hocPhan: { code: query.hocPhan } } } },
        select: { id: true },
      });
      const enrolledIds = new Set(enrolled.map((user) => user.id));
      submitterIds = submitterIds
        ? submitterIds.filter((userId) => enrolledIds.has(userId))
        : enrolled.map((user) => user.id).filter((userId) => userId !== actor.id);
    }
    // Keep the queue actionable: nobody may review their own work, so don't list it here.
    if (submitterIds) where.submittedById = { in: submitterIds };

    const matches = await this.matchingEntityFilters(query);
    if (matches) {
      // Approval stores a polymorphic entity id, so search results become explicit
      // (entity type, entity ids) pairs before the approval query runs.
      if (matches.length) where.OR = matches;
      else where.entityId = '00000000-0000-0000-0000-000000000000';
    }
    return where;
  }

  private async matchingEntityFilters(
    query: QueryApprovalDto,
  ): Promise<Prisma.ApprovalWhereInput[] | undefined> {
    const q = query.q?.trim();
    if (!q && !query.provinceId) return undefined;
    const text = q ? { contains: q, mode: 'insensitive' as const } : undefined;
    const types = query.entityType
      ? [query.entityType]
      : [EntityType.DESTINATION, EntityType.ROUTE, EntityType.TOUR, EntityType.SUPPLIER, EntityType.TOUR_COST];
    const filters: Prisma.ApprovalWhereInput[] = [];

    if (types.includes(EntityType.DESTINATION)) {
      const where: Prisma.DestinationWhereInput = {
        provinceId: query.provinceId,
        OR: text
          ? [
              { name: text },
              { slug: text },
              { address: text },
              { createdBy: { fullName: text } },
              { province: { name: text } },
            ]
          : undefined,
      };
      const rows = await this.prisma.destination.findMany({ where, select: { id: true } });
      if (rows.length) {
        filters.push({ entityType: EntityType.DESTINATION, entityId: { in: rows.map((row) => row.id) } });
      }
    }

    if (types.includes(EntityType.ROUTE)) {
      const where: Prisma.RouteWhereInput = {
        OR: text
          ? [
              { name: text },
              { description: text },
              { createdBy: { fullName: text } },
              { waypoints: { some: { destination: { name: text } } } },
              { waypoints: { some: { destination: { address: text } } } },
            ]
          : undefined,
        waypoints: query.provinceId
          ? { some: { destination: { provinceId: query.provinceId } } }
          : undefined,
      };
      const rows = await this.prisma.route.findMany({ where, select: { id: true } });
      if (rows.length) {
        filters.push({ entityType: EntityType.ROUTE, entityId: { in: rows.map((row) => row.id) } });
      }
    }

    if (types.includes(EntityType.TOUR)) {
      const where: Prisma.TourWhereInput = {
        OR: text
          ? [
              { name: text },
              { code: text },
              { description: text },
              { createdBy: { fullName: text } },
              { route: { waypoints: { some: { destination: { name: text } } } } },
              { route: { waypoints: { some: { destination: { address: text } } } } },
            ]
          : undefined,
        route: query.provinceId
          ? { waypoints: { some: { destination: { provinceId: query.provinceId } } } }
          : undefined,
      };
      const rows = await this.prisma.tour.findMany({ where, select: { id: true } });
      if (rows.length) {
        filters.push({ entityType: EntityType.TOUR, entityId: { in: rows.map((row) => row.id) } });
      }
    }

    if (types.includes(EntityType.SUPPLIER)) {
      const where: Prisma.SupplierWhereInput = {
        provinceId: query.provinceId,
        OR: text
          ? [
              { name: text },
              { address: text },
              { createdBy: { fullName: text } },
              { province: { name: text } },
            ]
          : undefined,
      };
      const rows = await this.prisma.supplier.findMany({ where, select: { id: true } });
      if (rows.length) {
        filters.push({ entityType: EntityType.SUPPLIER, entityId: { in: rows.map((row) => row.id) } });
      }
    }

    if (types.includes(EntityType.TOUR_COST)) {
      const where: Prisma.TourCostWhereInput = {
        OR: text
          ? [
              { notes: text },
              { supplier: { name: text } },
              { tour: { name: text } },
              { tour: { code: text } },
              { tour: { createdBy: { fullName: text } } },
            ]
          : undefined,
        tour: query.provinceId
          ? { route: { waypoints: { some: { destination: { provinceId: query.provinceId } } } } }
          : undefined,
      };
      const rows = await this.prisma.tourCost.findMany({ where, select: { id: true } });
      if (rows.length) {
        filters.push({ entityType: EntityType.TOUR_COST, entityId: { in: rows.map((row) => row.id) } });
      }
    }
    return filters;
  }

  private async paginate(
    where: Prisma.ApprovalWhereInput,
    query: QueryApprovalDto,
  ): Promise<PaginatedResult<unknown>> {
    const skip = (query.page - 1) * query.limit;
      const [data, total] = await this.prisma.$transaction([
      this.prisma.approval.findMany({
        where,
        include: { history: { orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.approval.count({ where }),
    ]);
    const enriched = await Promise.all(
      data.map(async (approval) => ({
        ...approval,
        entity: await this.entitySummary(approval.entityType, approval.entityId),
        submittedBy: await this.userSummary(approval.submittedById),
      })),
    );
    return {
      data: enriched,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private entitySummary(entityType: EntityType, entityId: string) {
    if (entityType === EntityType.DESTINATION) {
      return this.prisma.destination.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          name: true,
          address: true,
          images: true,
          category: true,
          status: true,
          province: { select: { id: true, name: true } },
          createdBy: { select: { fullName: true } },
        },
      });
    }
    if (entityType === EntityType.ROUTE) {
      return this.prisma.route.findUnique({
        where: { id: entityId },
        select: { id: true, name: true, description: true, status: true, createdBy: { select: { fullName: true } } },
      });
    }
    if (entityType === EntityType.TOUR) {
      return this.prisma.tour.findUnique({
      where: { id: entityId },
      select: { id: true, name: true, code: true, description: true, status: true, createdBy: { select: { fullName: true } } },
      });
    }
    if (entityType === EntityType.SUPPLIER) {
      return this.prisma.supplier.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          name: true,
          address: true,
          type: true,
          status: true,
          province: { select: { id: true, name: true } },
          createdBy: { select: { fullName: true } },
        },
      });
    }
    return this.prisma.tourCost.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        category: true,
        unitPrice: true,
        quantity: true,
        status: true,
        tour: { select: { name: true, code: true, createdBy: { select: { fullName: true } } } },
        supplier: { select: { name: true } },
      },
    });
  }

  private userSummary(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, username: true, avatarUrl: true },
    });
  }

  private entityDetails(entityType: EntityType, entityId: string) {
    if (entityType === EntityType.DESTINATION) {
      return this.prisma.destination.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          category: true,
          address: true,
          images: true,
          openingHours: true,
          ticketPrice: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          province: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      });
    }
    if (entityType === EntityType.ROUTE) {
      return this.prisma.route.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          name: true,
          description: true,
          distanceM: true,
          durationS: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          waypoints: {
            orderBy: { order: 'asc' },
            select: {
              order: true,
              stayMinutes: true,
              notes: true,
              destination: { select: { id: true, name: true, address: true, images: true } },
            },
          },
        },
      });
    }
    if (entityType === EntityType.TOUR) {
      return this.prisma.tour.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        days: true,
        basePrice: true,
        currency: true,
        paxCount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        route: {
          select: {
            id: true,
            name: true,
            waypoints: {
              orderBy: { order: 'asc' },
              select: { order: true, destination: { select: { id: true, name: true, address: true, images: true } } },
            },
          },
        },
        itinerary: {
          orderBy: [{ dayNumber: 'asc' }, { order: 'asc' }],
          select: { dayNumber: true, startTime: true, endTime: true, description: true, order: true },
        },
      },
      });
    }
    if (entityType === EntityType.SUPPLIER) {
      return this.prisma.supplier.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          name: true,
          type: true,
          contact: true,
          email: true,
          phone: true,
          address: true,
          province: { select: { id: true, name: true } },
          status: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        },
      });
    }
    return this.prisma.tourCost.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        category: true,
        unitPrice: true,
        quantity: true,
        isPerPerson: true,
        notes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        supplier: { select: { id: true, name: true, type: true, province: { select: { id: true, name: true } } } },
        tour: { select: { id: true, name: true, code: true, createdBy: { select: { id: true, fullName: true, username: true, avatarUrl: true } } } },
      },
    });
  }

  private async loadEntity(entityType: EntityType, entityId: string) {
    const select = { createdById: true, status: true };
    if (entityType === EntityType.DESTINATION) {
      return this.prisma.destination.findUnique({ where: { id: entityId }, select });
    }
    if (entityType === EntityType.ROUTE) {
      return this.prisma.route.findUnique({ where: { id: entityId }, select });
    }
    if (entityType === EntityType.TOUR) {
      return this.prisma.tour.findUnique({ where: { id: entityId }, select });
    }
    if (entityType === EntityType.SUPPLIER) {
      return this.prisma.supplier.findUnique({ where: { id: entityId }, select });
    }
    const cost = await this.prisma.tourCost.findUnique({
      where: { id: entityId },
      select: { status: true, tour: { select: { createdById: true } } },
    });
    return cost ? { createdById: cost.tour.createdById, status: cost.status } : null;
  }

  private updateEntityStatus(
    tx: Prisma.TransactionClient,
    entityType: EntityType,
    entityId: string,
    status: ApprovalStatus,
  ) {
    if (entityType === EntityType.DESTINATION) {
      return tx.destination.update({ where: { id: entityId }, data: { status } });
    }
    if (entityType === EntityType.ROUTE) {
      return tx.route.update({ where: { id: entityId }, data: { status } });
    }
    if (entityType === EntityType.TOUR) {
      return tx.tour.update({ where: { id: entityId }, data: { status } });
    }
    if (entityType === EntityType.SUPPLIER) {
      return tx.supplier.update({ where: { id: entityId }, data: { status } });
    }
    return tx.tourCost.update({ where: { id: entityId }, data: { status } });
  }

  private async reviewerRecipients(submitterId: string, level: ApprovalLevel): Promise<string[]> {
    if (level === ApprovalLevel.ADMIN) {
      const admins = await this.prisma.user.findMany({
        where: { role: Role.SUPER_ADMIN, isActive: true },
        select: { id: true },
      });
      return admins.map((admin) => admin.id);
    }
    if (level === ApprovalLevel.LECTURER) {
      const memberships = await this.prisma.classMember.findMany({
        where: { userId: submitterId, class: { lecturerId: { not: null } } },
        select: { class: { select: { lecturerId: true } } },
      });
      return [...new Set(memberships.map((item) => item.class.lecturerId).filter((id): id is string => !!id))];
    }

    const memberships = await this.prisma.classMember.findMany({
      where: { userId: submitterId },
      select: { classId: true, groupId: true },
    });
    if (!memberships.length) return [];
    const leaders = await this.prisma.classMember.findMany({
      where: {
        isLeader: true,
        OR: memberships.map((membership) => membership.groupId
          ? { classId: membership.classId, groupId: membership.groupId }
          : { classId: membership.classId }),
      },
      select: { userId: true },
    });
    return [...new Set(leaders.map((leader) => leader.userId).filter((id) => id !== submitterId))];
  }

  private async notifyUsers(
    userIds: string[],
    title: string,
    body: string,
    data: Prisma.InputJsonValue,
  ) {
    const recipients = [...new Set(userIds)];
    if (!recipients.length) return;
    await this.prisma.notification.createMany({
      data: recipients.map((userId) => ({ userId, title, body, type: 'APPROVAL', data })),
    });
    await Promise.all(recipients.map((userId) => this.email.sendToUser(userId, title, body)));
  }
}
