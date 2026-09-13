import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HocPhanCode, Role } from '@prisma/client';
import { CurrentUser, HocPhan, Public, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { CreateProviderDto } from './dto/create-provider.dto';
import { QueryProviderDto } from './dto/query-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ProviderService } from './provider.service';

// Học phần 3 — "chọn nhà cung cấp" is a student task, not an admin-only one.
const SUPPLIER_ROLES = [Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;

@ApiTags('provider')
@Controller('provider')
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryProviderDto, @CurrentUser() actor?: Actor) {
    return this.providerService.findAll(query, actor);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor?: Actor) {
    return this.providerService.findOne(id, actor);
  }

  @ApiBearerAuth()
  @Roles(...SUPPLIER_ROLES)
  @HocPhan(HocPhanCode.HP3)
  @Post()
  create(@Body() dto: CreateProviderDto, @CurrentUser() actor: Actor) {
    return this.providerService.create(dto, actor);
  }

  @ApiBearerAuth()
  @Roles(...SUPPLIER_ROLES)
  @HocPhan(HocPhanCode.HP3)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto, @CurrentUser() actor: Actor) {
    return this.providerService.update(id, dto, actor);
  }

  @ApiBearerAuth()
  @Roles(...SUPPLIER_ROLES)
  @HocPhan(HocPhanCode.HP3)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.providerService.remove(id, actor);
  }
}
