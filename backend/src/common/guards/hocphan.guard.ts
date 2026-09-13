import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HocPhanCode, Role } from '@prisma/client';
import { HOCPHAN_KEY } from '../decorators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HocPhanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<HocPhanCode[]>(HOCPHAN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Unauthenticated');
    if (user.role === Role.SUPER_ADMIN || user.role === Role.LECTURER) return true;

    const enrollments = await this.prisma.hocPhanEnrollment.findMany({
      where: { userId: user.id, hocPhan: { code: { in: required } } },
      select: { hocPhanId: true },
    });
    if (enrollments.length === 0) {
      throw new ForbiddenException(`User not enrolled in required học phần`);
    }
    return true;
  }
}
