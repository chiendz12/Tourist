import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, Prisma, Role } from '@prisma/client';
import {
  Actor,
  assertCanDelete,
  assertCanUpdate,
  canRead,
} from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../../types';
import { ProvinceAccessService } from '../province/province-access.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { QueryProviderDto } from './dto/query-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

@Injectable()
export class ProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provinceAccess: ProvinceAccessService,
  ) {}

  async findAll(query: QueryProviderDto, actor?: Actor): Promise<PaginatedResult<unknown>> {
    const where: Prisma.SupplierWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.provinceId) where.provinceId = query.provinceId;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (!actor || actor.role === Role.MEMBER || actor.role === Role.GUEST) {
      where.status = ApprovalStatus.PUBLISHED;
    } else if (actor.role === Role.STUDENT || actor.role === Role.LEADER) {
      const visibility = { OR: [{ status: ApprovalStatus.PUBLISHED }, { createdById: actor.id }] };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), visibility];
      delete where.OR;
    }
    if (actor && this.provinceAccess.requiresAssignment(actor.role)) {
      const assigned = await this.provinceAccess.assignedProvinceIds(actor);
      where.provinceId = query.provinceId
        ? assigned?.includes(query.provinceId)
          ? query.provinceId
          : '00000000-0000-0000-0000-000000000000'
        : { in: assigned ?? [] };
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.supplier.count({ where }),
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

  async findOne(id: string, actor?: Actor) {
    const found = await this.prisma.supplier.findUnique({
      where: { id },
      include: { costs: { include: { tour: { select: { id: true, name: true, code: true } } } } },
    });
    if (!found) throw new NotFoundException('Provider not found');
    if (!canRead({ createdById: found.createdById ?? '', status: found.status }, actor)) {
      throw new NotFoundException('Provider not found');
    }
    if (actor) await this.provinceAccess.assertCanAccessProvinces(actor, [found.provinceId]);
    return found;
  }

  /** HP3 "chọn nhà cung cấp" — students build the supplier list themselves. */
  async create(dto: CreateProviderDto, actor: Actor) {
    await this.provinceAccess.assertCanWrite(actor, dto.provinceId, {
      required: this.provinceAccess.requiresAssignment(actor.role),
    });
    return this.prisma.supplier.create({ data: { ...dto, createdById: actor.id } });
  }

  async update(id: string, dto: UpdateProviderDto, actor: Actor) {
    const existing = await this.loadForMutation(id);
    assertCanUpdate(existing, actor, 'provider');
    const provinceId = dto.provinceId !== undefined ? dto.provinceId : existing.provinceId;
    await this.provinceAccess.assertCanWrite(actor, provinceId, {
      required: this.provinceAccess.requiresAssignment(actor.role),
    });
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.loadForMutation(id);
    assertCanDelete(existing, actor, 'provider');
    if (existing._count.costs > 0) {
      throw new ConflictException(
        'This provider is referenced by tour cost lines; remove those first',
      );
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async loadForMutation(id: string) {
    const found = await this.prisma.supplier.findUnique({
      where: { id },
      select: {
        id: true,
        provinceId: true,
        createdById: true,
        status: true,
        _count: { select: { costs: true } },
      },
    });
    if (!found) throw new NotFoundException('Provider not found');
    return found;
  }
}
