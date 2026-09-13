import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { Actor } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AddClassMemberDto } from './dto/add-class-member.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateStudentGroupDto } from './dto/create-student-group.dto';

/** Staff see contact details; classmates only see names. */
const STAFF_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const PEER_USER_SELECT = {
  id: true,
  fullName: true,
  avatarUrl: true,
  role: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class ClassService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Admin sees every class; a lecturer sees the classes they teach or belong to;
   * a student/leader only sees classes they are enrolled in.
   */
  findAll(actor: Actor) {
    return this.prisma.class.findMany({
      where: this.scopeFor(actor),
      include: {
        hocPhan: true,
        province: true,
        groups: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actor: Actor) {
    const isStaff = this.isStaff(actor);
    const found = await this.prisma.class.findUnique({
      where: { id },
      include: {
        hocPhan: true,
        province: true,
        members: {
          include: {
            user: { select: isStaff ? STAFF_USER_SELECT : PEER_USER_SELECT },
            group: true,
          },
        },
        groups: { include: { members: true } },
      },
    });
    if (!found) throw new NotFoundException('Class not found');

    const isMember = found.members.some((member) => member.userId === actor.id);
    const isOwnLecturer = found.lecturerId === actor.id;
    if (actor.role !== Role.SUPER_ADMIN && !isMember && !isOwnLecturer) {
      throw new ForbiddenException('You are not a member of this class');
    }
    return found;
  }

  create(dto: CreateClassDto, actor: Actor) {
    // A lecturer can only create classes for themselves; the admin can assign anyone.
    const lecturerId =
      actor.role === Role.SUPER_ADMIN ? dto.lecturerId : (dto.lecturerId ?? actor.id);
    if (actor.role === Role.LECTURER && lecturerId !== actor.id) {
      throw new ForbiddenException('A lecturer can only create classes they teach');
    }
    return this.prisma.class.create({
      data: {
        name: dto.name,
        code: dto.code,
        hocPhanId: dto.hocPhanId,
        lecturerId,
        provinceId: dto.provinceId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async addMember(classId: string, dto: AddClassMemberDto, actor: Actor) {
    await this.assertManages(classId, actor);
    return this.prisma.classMember.upsert({
      where: { classId_userId: { classId, userId: dto.userId } },
      create: {
        classId,
        userId: dto.userId,
        isLeader: dto.isLeader ?? false,
        groupId: dto.groupId,
      },
      update: { isLeader: dto.isLeader, groupId: dto.groupId },
    });
  }

  async createGroup(classId: string, dto: CreateStudentGroupDto, actor: Actor) {
    await this.assertManages(classId, actor);
    return this.prisma.studentGroup.create({ data: { classId, name: dto.name } });
  }

  private isStaff(actor: Actor) {
    return actor.role === Role.SUPER_ADMIN || actor.role === Role.LECTURER;
  }

  private scopeFor(actor: Actor): Prisma.ClassWhereInput {
    if (actor.role === Role.SUPER_ADMIN) return {};
    if (actor.role === Role.LECTURER) {
      return { OR: [{ lecturerId: actor.id }, { members: { some: { userId: actor.id } } }] };
    }
    return { members: { some: { userId: actor.id } } };
  }

  private async assertManages(classId: string, actor: Actor) {
    const found = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, lecturerId: true },
    });
    if (!found) throw new NotFoundException('Class not found');
    if (actor.role === Role.SUPER_ADMIN) return;
    if (found.lecturerId !== actor.id) {
      throw new ForbiddenException('You do not teach this class');
    }
  }
}
