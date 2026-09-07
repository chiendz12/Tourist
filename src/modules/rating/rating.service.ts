import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, ModerationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingService {
  constructor(private readonly prisma: PrismaService) {}

  findByDestination(destinationId: string) {
    return this.prisma.rating.findMany({
      where: { destinationId, moderationStatus: ModerationStatus.APPROVED, destination: { status: ApprovalStatus.PUBLISHED } },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsert(dto: CreateRatingDto, userId: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id: dto.destinationId },
      select: { id: true, status: true },
    });
    if (!destination || destination.status !== ApprovalStatus.PUBLISHED) {
      throw new NotFoundException('Published destination not found');
    }
    return this.prisma.rating.upsert({
      where: { userId_destinationId: { userId, destinationId: dto.destinationId } },
      create: { userId, destinationId: dto.destinationId, score: dto.score, review: dto.review },
      update: { score: dto.score, review: dto.review, moderationStatus: ModerationStatus.PENDING },
    });
  }
}
