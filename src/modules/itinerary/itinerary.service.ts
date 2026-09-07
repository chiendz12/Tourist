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
}
