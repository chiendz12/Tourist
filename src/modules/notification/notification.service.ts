import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../../types';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(
    userId: string,
    query: PaginationDto,
    unreadOnly: boolean,
  ): Promise<PaginatedResult<unknown> & { unread: number }> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) where.readAt = null;
    const skip = (query.page - 1) * query.limit;

    const [data, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      data,
      unread,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async markRead(id: string, userId: string) {
    // Scoped by userId so one user cannot mark another's notifications.
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Notification not found');
    }
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: updated.count };
  }
}
