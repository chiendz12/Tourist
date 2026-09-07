import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor } from '../../common/utils/ownership.util';
import { SystemLockDto } from './dto/system-lock.dto';

const SYSTEM_LOCK_KEY = 'system.lock';
const CACHE_TTL_MS = 5_000;

export type SystemLock = {
  locked: boolean;
  message: string | null;
  lockedAt: string | null;
};

const UNLOCKED: SystemLock = { locked: false, message: null, lockedAt: null };

/** Admin "khóa/mở hệ thống" — freezes every write while an exam or review window runs. */
@Injectable()
export class SystemSettingService {
  private readonly logger = new Logger(SystemSettingService.name);
  private cache: { value: SystemLock; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getLock(): Promise<SystemLock> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;
    try {
      const row = await this.prisma.systemSetting.findUnique({ where: { key: SYSTEM_LOCK_KEY } });
      const value = (row?.value as SystemLock | undefined) ?? UNLOCKED;
      this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    } catch (error) {
      // Fail open. The lock is an operational convenience, not a security boundary;
      // a settings-table hiccup must not take the whole API down.
      this.logger.error(`Could not read the system lock: ${(error as Error).message}`);
      return UNLOCKED;
    }
  }

  async setLock(dto: SystemLockDto, actor?: Actor): Promise<SystemLock> {
    const value: SystemLock = {
      locked: dto.locked,
      message: dto.message ?? null,
      lockedAt: dto.locked ? new Date().toISOString() : null,
    };
    await this.prisma.systemSetting.upsert({
      where: { key: SYSTEM_LOCK_KEY },
      create: { key: SYSTEM_LOCK_KEY, value },
      update: { value },
    });
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    if (actor) {
      await this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: dto.locked ? 'ADMIN_SYSTEM_LOCK' : 'ADMIN_SYSTEM_UNLOCK',
          entity: 'SystemSetting',
          entityId: SYSTEM_LOCK_KEY,
          metadata: value,
        },
      });
    }
    return value;
  }
}
