import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HocPhanCode, Role } from '@prisma/client';
import { CurrentUser, HocPhan, ProvinceScope, Public, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { BboxQueryDto } from './dto/bbox-query.dto';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { QueryDestinationDto } from './dto/query-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { DestinationService } from './destination.service';

const EDITOR_ROLES = [Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;

@ApiTags('destination')
@Controller('destination')
export class DestinationController {
  constructor(private readonly destinationService: DestinationService) {}

  @Public()
  @Get()
  findPublic(@Query() query: QueryDestinationDto, @CurrentUser() actor?: Actor) {
    return this.destinationService.findPublic(query, actor);
  }

  // Static segments must be declared before ':id' or the param route swallows them.
  @Public()
  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto, @CurrentUser() actor?: Actor) {
    return this.destinationService.findNearby(query, actor);
  }

  @Public()
  @Get('bbox')
  findInBbox(@Query() query: BboxQueryDto, @CurrentUser() actor?: Actor) {
    return this.destinationService.findInBbox(query, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @Get('mine')
  @HocPhan(HocPhanCode.HP1)
  findMine(@Query() query: QueryDestinationDto, @CurrentUser() actor: Actor) {
    return this.destinationService.findMine(query, actor);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor?: Actor) {
    return this.destinationService.findOne(id, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP1)
  // Mục V — a student/leader may only file destinations for a province assigned to them,
  // and must name one. Lecturers and the admin are unscoped.
  @ProvinceScope()
  @Post()
  create(@Body() dto: CreateDestinationDto, @CurrentUser() actor: Actor) {
    return this.destinationService.create(dto, actor);
  }

  // Public so guest browsing also surfaces accurate images; throttled globally.
  @Public()
  @Post(':id/resolve-image')
  resolveImage(@Param('id') id: string) {
    return this.destinationService.resolveImage(id);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP1)
  @ProvinceScope({ required: false })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDestinationDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.destinationService.update(id, dto, actor);
  }

  @ApiBearerAuth()
  @Roles(...EDITOR_ROLES)
  @HocPhan(HocPhanCode.HP1)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.destinationService.remove(id, actor);
  }
}
