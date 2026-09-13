import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HocPhanCode, Role } from '@prisma/client';
import { CurrentUser, HocPhan, Public, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateTourDto } from './dto/create-tour.dto';
import { QueryTourDto } from './dto/query-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { PricingService } from './pricing.service';
import { TourService } from './tour.service';

const EDITOR_ROLES = [Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;

@ApiTags('tour')
@Controller('tour')
export class TourController {
  constructor(
    private readonly tourService: TourService,
    private readonly pricingService: PricingService,
  ) {}

  @Public()
  @Get()
  findPublic(@Query() query: QueryTourDto, @CurrentUser() actor?: Actor) {
    return this.tourService.findPublic(query, actor);
  }

  // Static segment must come before ':id'.
  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @Get('mine')
  @HocPhan(HocPhanCode.HP2, HocPhanCode.HP3)
  findMine(@Query() query: PaginationDto, @CurrentUser() actor: Actor) {
    return this.tourService.findMine(query, actor);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor?: Actor) {
    return this.tourService.findOne(id, actor);
  }

  /** HP3 — cost roll-up, margin, cost completeness and price competitiveness. */
  @Public()
  @Get(':id/pricing')
  pricing(@Param('id') id: string, @CurrentUser() actor?: Actor) {
    return this.pricingService.computeFor(id, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP2)
  @Post()
  create(@Body() dto: CreateTourDto, @CurrentUser() actor: Actor) {
    return this.tourService.create(dto, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP2, HocPhanCode.HP3)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTourDto, @CurrentUser() actor: Actor) {
    return this.tourService.update(id, dto, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP2)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.tourService.remove(id, actor);
  }
}
