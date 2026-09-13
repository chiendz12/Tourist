import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, ModerationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  findByDestination(destinationId: string) {
    return this.prisma.comment.findMany({
      where: { destinationId, parentId: null, moderationStatus: ModerationStatus.APPROVED, destination: { status: ApprovalStatus.PUBLISHED } },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        replies: { where: { moderationStatus: ModerationStatus.APPROVED }, include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateCommentDto, userId: string) {
    if (!dto.content.trim()) throw new BadRequestException('Comment cannot be empty');
    const destination = await this.prisma.destination.findUnique({
      where: { id: dto.destinationId },
      select: { id: true, status: true },
    });
    if (!destination || destination.status !== ApprovalStatus.PUBLISHED) {
      throw new NotFoundException('Published destination not found');
    }
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { destinationId: true, moderationStatus: true },
      });
      if (!parent || parent.destinationId !== dto.destinationId || parent.moderationStatus !== ModerationStatus.APPROVED) {
        throw new BadRequestException('Reply parent is not available');
      }
    }
    return this.prisma.comment.create({
      data: {
        userId,
        destinationId: dto.destinationId,
        content: dto.content,
        parentId: dto.parentId,
      },
    });
  }
}
