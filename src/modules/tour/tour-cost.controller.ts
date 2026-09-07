import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HocPhanCode, Role } from '@prisma/client';
import { CurrentUser, HocPhan, Public, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { CreateTourCostDto } from './dto/create-tour-cost.dto';
import { UpdateTourCostDto } from './dto/update-tour-cost.dto';
import { TourCostService } from './tour-cost.service';

const COSTING_ROLES = [Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;

// Học phần 3 — quản lý & điều hành tour.
@ApiTags('tour-cost')
@Controller('tour/:tourId/costs')
export class TourCostController {
  constructor(private readonly tourCostService: TourCostService) {}

  @Public()
  @Get()
  findAll(@Param('tourId') tourId: string, @CurrentUser() actor?: Actor) {
    return this.tourCostService.findAll(tourId, actor);
  }

  @ApiBearerAuth()
  @Roles(...COSTING_ROLES)
  @HocPhan(HocPhanCode.HP3)
  @Post()
  create(
    @Param('tourId') tourId: string,
    @Body() dto: CreateTourCostDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.tourCostService.create(tourId, dto, actor);
  }

  @ApiBearerAuth()
  @Roles(...COSTING_ROLES)
  @HocPhan(HocPhanCode.HP3)
  @Patch(':costId')
  update(
    @Param('tourId') tourId: string,
    @Param('costId') costId: string,
    @Body() dto: UpdateTourCostDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.tourCostService.update(tourId, costId, dto, actor);
  }

  @ApiBearerAuth()
  @Roles(...COSTING_ROLES)
  @HocPhan(HocPhanCode.HP3)
  @Delete(':costId')
  remove(
    @Param('tourId') tourId: string,
    @Param('costId') costId: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.tourCostService.remove(tourId, costId, actor);
  }
}
