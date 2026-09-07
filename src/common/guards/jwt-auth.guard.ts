import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PUBLIC_KEY } from '../decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) return (await super.canActivate(context)) as boolean;

    // Public route: still attach `req.user` when a valid token is present, so
    // handlers can show the caller their own unpublished records. Never rejects.
    try {
      await super.canActivate(context);
    } catch {
      // anonymous visitor (Guest) — leave req.user undefined
    }
    return true;
  }
}
