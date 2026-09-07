import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROVINCE_KEY, ProvinceScopeMeta } from '../decorators';
import { ProvinceAccessService } from '../../modules/province/province-access.service';
import { Actor } from '../utils/ownership.util';

@Injectable()
export class ProvinceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly provinceAccess: ProvinceAccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<ProvinceScopeMeta>(PROVINCE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!meta) return true;

    const req = ctx.switchToHttp().getRequest();
    const user: Actor | undefined = req.user;
    if (!user) throw new ForbiddenException('Unauthenticated');

    const provinceId =
      req.params?.[meta.param] ?? req.body?.[meta.param] ?? req.query?.[meta.param];

    // One rule, one implementation — the guard only resolves the id and delegates.
    await this.provinceAccess.assertCanWrite(user, provinceId, { required: meta.required });
    return true;
  }
}
