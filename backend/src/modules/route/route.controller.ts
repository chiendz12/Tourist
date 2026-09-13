import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HocPhanCode, Role } from '@prisma/client';
import { CurrentUser, HocPhan, Public, Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Actor } from '../../common/utils/ownership.util';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteService } from './route.service';

const EDITOR_ROLES = [Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;

@ApiTags('route')
@Controller('route')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Public()
  @Get()
  findPublic(@Query() query: PaginationDto, @CurrentUser() actor?: Actor) {
    return this.routeService.findPublic(query, actor);
  }

  // Static segment must come before ':id'.
  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @Get('mine')
  @HocPhan(HocPhanCode.HP2)
  findMine(@Query() query: PaginationDto, @CurrentUser() actor: Actor) {
    return this.routeService.findMine(query, actor);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor?: Actor) {
    return this.routeService.findOne(id, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP2)
  @Post()
  create(@Body() dto: CreateRouteDto, @CurrentUser() actor: Actor) {
    return this.routeService.create(dto, actor);
  }

  /** Re-run Mapbox Directions for this route's stops. */
  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP2)
  @Post(':id/recalculate')
  recalculate(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.routeService.recalculate(id, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP2)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto, @CurrentUser() actor: Actor) {
    return this.routeService.update(id, dto, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP2)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.routeService.remove(id, actor);
  }
}
