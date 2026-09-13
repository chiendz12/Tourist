import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';

@Injectable()
export class ItineraryService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(userId: string) {
    return this.prisma.itinerary.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateItineraryDto, userId: string) {
    return this.prisma.itinerary.create({
      data: {
        userId,
        tourId: dto.tourId,
        name: dto.name,
        payload: dto.payload as object,
      },
    });
  }

  async update(id: string, dto: UpdateItineraryDto, userId: string) {
    const existing = await this.prisma.itinerary.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Itinerary not found');
    }

    return this.prisma.itinerary.update({
      where: { id },
      data: {
        name: dto.name,
        payload: dto.payload as object | undefined,
      },
    });
  }

  /** Single itinerary for its owner (powers builder edit mode). */
  async findOne(id: string, userId: string) {
    const trip = await this.prisma.itinerary.findUnique({ where: { id } });
    if (!trip || trip.userId !== userId) {
      throw new NotFoundException('Itinerary not found');
    }
    return trip;
  }

  /** Owner-only delete so members can remove their own junk drafts. */
  async remove(id: string, userId: string) {
    const existing = await this.prisma.itinerary.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Itinerary not found');
    }
    await this.prisma.itinerary.delete({ where: { id } });
    return { id, deleted: true };
  }
}
