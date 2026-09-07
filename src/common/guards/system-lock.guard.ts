import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { SKIP_SYSTEM_LOCK_KEY } from '../decorators';
import { SystemSettingService } from '../../modules/admin/system-setting.service';

/** Reads never change data, so they stay available while the system is locked. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class SystemLockGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settings: SystemSettingService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (SAFE_METHODS.has(req.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SYSTEM_LOCK_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const lock = await this.settings.getLock();
    if (!lock.locked) return true;
    // The admin has to stay able to unlock it.
    if (req.user?.role === Role.SUPER_ADMIN) return true;

    throw new ServiceUnavailableException(
      lock.message ?? 'The system is temporarily locked by the administrator',
    );
  }
}
