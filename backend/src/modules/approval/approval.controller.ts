import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { ApprovalService } from './approval.service';
import { QueryApprovalDto } from './dto/query-approval.dto';
import { ReviewApprovalDto } from './dto/review-approval.dto';
import { SubmitApprovalDto } from './dto/submit-approval.dto';

const SUBMITTER_ROLES = [Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;
const REVIEWER_ROLES = [Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;

@ApiBearerAuth()
@ApiTags('approval')
@Controller('approval')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  /** Review queue, already narrowed to the caller's group / class. */
  @Roles(...REVIEWER_ROLES)
  @Get()
  findAll(@Query() query: QueryApprovalDto, @CurrentUser() actor: Actor) {
    return this.approvalService.findAll(actor, query);
  }

  @Roles(...REVIEWER_ROLES)
  @Get('summary')
  summary(@Query() query: QueryApprovalDto, @CurrentUser() actor: Actor) {
    return this.approvalService.summary(actor, query);
  }

  // Static segment must come before ':id'.
  @Roles(...SUBMITTER_ROLES)
  @Get('mine')
  findMine(@Query() query: QueryApprovalDto, @CurrentUser() actor: Actor) {
    return this.approvalService.findMine(actor, query);
  }

  @Roles(...SUBMITTER_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.approvalService.findOne(id, actor);
  }

  @Roles(...SUBMITTER_ROLES)
  @Post('submit')
  submit(@Body() dto: SubmitApprovalDto, @CurrentUser() actor: Actor) {
    return this.approvalService.submit(dto, actor);
  }

  @Roles(...REVIEWER_ROLES)
  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewApprovalDto, @CurrentUser() actor: Actor) {
    return this.approvalService.review(id, dto, actor);
  }
}
