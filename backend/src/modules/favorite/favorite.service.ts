import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      select: { destinationId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(userId: string, destinationId: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id: destinationId },
      select: { id: true, status: true },
    });
    if (!destination || destination.status !== ApprovalStatus.PUBLISHED) {
      throw new NotFoundException('Published destination not found');
    }
    await this.prisma.favorite.upsert({
      where: { userId_destinationId: { userId, destinationId } },
      create: { userId, destinationId },
      update: {},
    });
    return { destinationId, favorited: true };
  }

  async remove(userId: string, destinationId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, destinationId } });
    return { destinationId, favorited: false };
  }
}
