import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { AdminService } from './admin.service';
import { QueryUserDto } from './dto/query-user.dto';

class ReviewUserDto {
  @IsIn(['APPROVE', 'REJECT'] as const)
  action!: 'APPROVE' | 'REJECT';
}

/**
 * Self-registration review queue. Lecturers approve STUDENT sign-ups;
 * LECTURER sign-ups are admin-only (enforced in the service).
 */
@ApiBearerAuth()
@ApiTags('admin')
@Roles(Role.LECTURER, Role.SUPER_ADMIN)
@Controller('admin/user-approvals')
export class UserApprovalController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  pending(@Query() query: QueryUserDto, @CurrentUser() actor: Actor) {
    return this.adminService.listPendingUsers(actor, query);
  }

  @Patch(':id')
  review(@Param('id') id: string, @Body() dto: ReviewUserDto, @CurrentUser() actor: Actor) {
    return dto.action === 'APPROVE'
      ? this.adminService.approveUser(id, actor)
      : this.adminService.rejectUser(id, actor);
  }
}
