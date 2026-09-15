import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto, REGISTERABLE_ROLES } from './dto/register.dto';
import { JwtPayload, RefreshPayload } from './strategies/jwt.strategy';
import { EmailService } from '../notification/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  /**
   * Self-registration. Members are active immediately (original behavior);
   * students and lecturers start inactive AND unapproved — a lecturer
   * (students) or an admin must approve before first sign-in, so no tokens
   * are issued for them.
   */
  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (exists) throw new ConflictException('Email or username already used');
    const role = dto.role && (REGISTERABLE_ROLES as readonly Role[]).includes(dto.role)
      ? dto.role
      : Role.STUDENT;
    const passwordHash = await bcrypt.hash(dto.password, 10);
    if (role === Role.MEMBER) {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          role,
          isActive: true,
          isApproved: true,
        },
        select: { id: true, email: true, username: true, fullName: true, role: true },
      });
      return { user, ...(await this.issueTokens(user.id, user.email, user.role)) };
    }
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role,
        isActive: false,
        isApproved: false,
      },
      select: { id: true, email: true, username: true, fullName: true, role: true },
    });
    await this.notifyReviewers(user.id, user.fullName, role);
    return { user, pending: true as const };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    // Pending approval reads differently from a locked account.
    if (!user.isApproved) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đang chờ giảng viên hoặc quản trị viên duyệt. Vui lòng quay lại sau.',
      );
    }
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      );
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
      ...(await this.issueTokens(user.id, user.email, user.role)),
    };
  }

  /**
   * Rotating refresh: the presented token is looked up by its own id (`jti`), checked,
   * then revoked and replaced. Because each session is identified individually, signing
   * in on several devices no longer invalidates the earlier ones.
   */
  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      // This token was already rotated or logged out. Seeing it again means the value
      // leaked, so every session for this user is dropped rather than just this one.
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
      await this.revokeAllFor(stored.userId);
      throw new UnauthorizedException('Refresh token has already been used');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }
    if (!(await bcrypt.compare(refreshToken, stored.tokenHash))) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Re-read the user: the role may have changed and the account may have been locked
    // since the token was issued, and the old payload would happily carry the stale role.
    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, role: true, isActive: true, isApproved: true },
    });
    if (!user || !user.isActive || !user.isApproved) {
      throw new UnauthorizedException('Account is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user.id, user.email, user.role);
  }

  /**
   * With a refresh token: signs out that one device. Without: signs out everywhere.
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const payload = await this.verifyRefreshToken(refreshToken).catch(() => null);
      if (payload?.jti && payload.sub === userId) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { success: true, scope: 'session' as const };
      }
    }
    await this.revokeAllFor(userId);
    return { success: true, scope: 'all' as const };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      if (!payload?.jti || !payload.sub) throw new Error('missing jti');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private revokeAllFor(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Students are reviewed by lecturers and admins; lecturer registrations
   * go to admins only. Best-effort fan-out: in-app + email.
   */
  private async notifyReviewers(userId: string, fullName: string, role: Role) {
    const reviewerRoles =
      role === Role.LECTURER ? [Role.SUPER_ADMIN] : [Role.LECTURER, Role.SUPER_ADMIN];
    const reviewers = await this.prisma.user.findMany({
      where: { role: { in: reviewerRoles }, isActive: true, id: { not: userId } },
      select: { id: true },
    });
    if (!reviewers.length) return;
    const roleVi = role === Role.LECTURER ? 'giảng viên' : 'sinh viên';
    const title = `Tài khoản ${roleVi} mới chờ duyệt`;
    const body = `${fullName} vừa đăng ký tài khoản ${roleVi} và đang chờ bạn phê duyệt.`;
    await this.prisma.notification.createMany({
      data: reviewers.map((reviewer) => ({
        userId: reviewer.id,
        title,
        body,
        type: 'USER_APPROVAL',
        data: { userId, role },
      })),
    });
    await Promise.all(
      reviewers.map((reviewer) => this.email.sendToUser(reviewer.id, title, body).catch(() => undefined)),
    );
  }

  private async issueTokens(userId: string, email: string, role: Role) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role } satisfies JwtPayload,
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      },
    );

    // The row id is minted first so it can be embedded as `jti`, which is what makes
    // the token findable without comparing the hash against every row.
    const tokenId = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email, role, jti: tokenId } satisfies RefreshPayload,
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        // Taken from the signed token itself, so the row can never outlive the JWT.
        expiresAt: this.expiryOf(refreshToken),
      },
    });
    await this.pruneExpired(userId);
    return { accessToken, refreshToken };
  }

  private expiryOf(token: string): Date {
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    if (decoded?.exp) return new Date(decoded.exp * 1000);
    // Should not happen — every token is signed with expiresIn — but never store a
    // row without an expiry, or it would live forever.
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  /** Rotation adds a row per refresh; drop the dead ones so the table stays bounded. */
  private pruneExpired(userId: string) {
    return this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  }
}
