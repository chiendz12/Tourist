import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProvinceService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.province.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.province.findUnique({ where: { id } });
  }
}
