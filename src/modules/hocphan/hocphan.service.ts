import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Actor } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHocPhanDto } from './dto/create-hocphan.dto';
import { EnrollHocPhanDto } from './dto/enroll-hocphan.dto';

@Injectable()
export class HocPhanService {
  constructor(private readonly prisma: PrismaService) {}

  /** The catalogue of học phần is reference data — safe to expose, but without any roster. */
  findAll() {
    return this.prisma.hocPhan.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        _count: { select: { classes: true, enrollments: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  /** Only staff get the enrolled-student list; everyone else gets the catalogue entry. */
  async findOne(id: string, actor?: Actor) {
    const isStaff = actor?.role === Role.SUPER_ADMIN || actor?.role === Role.LECTURER;
    const found = await this.prisma.hocPhan.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        classes: isStaff
          ? { include: { province: true } }
          : { select: { id: true, name: true, code: true, provinceId: true } },
        enrollments: isStaff
          ? {
              include: {
                user: { select: { id: true, fullName: true, email: true, role: true } },
              },
            }
          : false,
      },
    });
    if (!found) throw new NotFoundException('Học phần not found');
    return found;
  }

  async create(dto: CreateHocPhanDto, actor: Actor) {
    const created = await this.prisma.hocPhan.create({ data: dto });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'ADMIN_CREATE_HOCPHAN', entity: 'HocPhan', entityId: created.id, metadata: { code: created.code } },
    });
    return created;
  }

  async enroll(dto: EnrollHocPhanDto, actor: Actor) {
    const enrollment = await this.prisma.hocPhanEnrollment.upsert({
      where: { userId_hocPhanId: { userId: dto.userId, hocPhanId: dto.hocPhanId } },
      create: { userId: dto.userId, hocPhanId: dto.hocPhanId },
      update: {},
    });
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action: 'ADMIN_ENROLL_HOCPHAN', entity: 'HocPhanEnrollment', entityId: `${dto.userId}:${dto.hocPhanId}` },
    });
    return enrollment;
  }
}
