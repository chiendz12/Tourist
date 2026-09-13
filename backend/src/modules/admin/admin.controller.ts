import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModerationStatus, Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { SystemLockDto } from './dto/system-lock.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { ModerationKind, QueryModerationDto } from './dto/query-moderation.dto';
import { SystemSettingService } from './system-setting.service';

@ApiBearerAuth()
@ApiTags('admin')
@Roles(Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly settings: SystemSettingService,
  ) {}

  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  @Get('users')
  listUsers(@Query() query: QueryUserDto) {
    return this.adminService.listUsers(query);
  }

  /** "tạo tài khoản (SV, GV, leader)" — the only way to mint a non-MEMBER account. */
  @Post('users')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: Actor) {
    return this.adminService.createUser(dto, actor);
  }

  /** Role changes and "khóa/mở" a single account. */
  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: Actor) {
    return this.adminService.updateUser(id, dto, actor);
  }

  @Get('system/lock')
  getLock() {
    return this.settings.getLock();
  }

  /** "khóa/mở hệ thống" — freezes every write except the admin's own and sign-in. */
  @Patch('system/lock')
  setLock(@Body() dto: SystemLockDto, @CurrentUser() actor: Actor) {
    return this.settings.setLock(dto, actor);
  }

  @Get('reports')
  reports() {
    return this.adminService.reports();
  }

  @Get('audit')
  audit(@Query() query: QueryAuditDto) {
    return this.adminService.audit(query);
  }

  @Get('moderation')
  moderation(@Query() query: QueryModerationDto) {
    return this.adminService.moderation(query);
  }

  @Patch('moderation/:kind/:id')
  moderate(
    @Param('kind') kind: ModerationKind,
    @Param('id') id: string,
    @Body('status') status: ModerationStatus,
    @CurrentUser() actor: Actor,
  ) {
    return this.adminService.moderate(kind, id, status, actor);
  }
}
