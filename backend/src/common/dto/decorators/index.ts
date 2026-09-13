import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, HocPhanCode } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const HOCPHAN_KEY = 'hocPhan';
export const HocPhan = (...codes: HocPhanCode[]) => SetMetadata(HOCPHAN_KEY, codes);

export const PROVINCE_KEY = 'provinceScope';

export type ProvinceScopeMeta = {
  /** Where to look for the province id: route param, body field, or query param. */
  param: string;
  /**
   * `true` (default): a scoped caller must name a province — omitting it is a
   * refusal, not a bypass. `false`: only validate a province when one is supplied.
   */
  required: boolean;
};

/** Mark a route as scoped to a province (mục V — phân quyền theo không gian). */
export const ProvinceScope = (options: Partial<ProvinceScopeMeta> = {}) =>
  SetMetadata<string, ProvinceScopeMeta>(PROVINCE_KEY, {
    param: 'provinceId',
    required: true,
    ...options,
  });

export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const SKIP_SYSTEM_LOCK_KEY = 'skipSystemLock';
/**
 * Exempt a route from the admin's "khóa hệ thống" switch. Needed for sign-in:
 * the admin cannot unlock the system if they cannot log in first.
 */
export const SkipSystemLock = () => SetMetadata(SKIP_SYSTEM_LOCK_KEY, true);

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return data ? req.user?.[data] : req.user;
  },
);
