import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { ProvinceAccessService } from '../province/province-access.service';
import { AssignProvinceDto } from './dto/assign-province.dto';
import { UserService } from './user.service';

@ApiBearerAuth()
@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly provinceAccess: ProvinceAccessService,
  ) {}

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.userService.findMe(userId);
  }

  /** Which provinces the caller may enter data for (mục V). */
  @Get('me/provinces')
  myProvinces(@CurrentUser('id') userId: string) {
    return this.provinceAccess.listForUser(userId);
  }

  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Get(':id/provinces')
  provincesOf(@Param('id') id: string) {
    return this.provinceAccess.listForUser(id);
  }

  /** Giảng viên "phân vùng địa lý cho SV" — only for students in their own class. */
  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Post(':id/provinces')
  assignProvince(
    @Param('id') id: string,
    @Body() dto: AssignProvinceDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.provinceAccess.assign(id, dto.provinceId, actor);
  }

  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Delete(':id/provinces/:provinceId')
  unassignProvince(
    @Param('id') id: string,
    @Param('provinceId') provinceId: string,
    @CurrentUser() actor: Actor,
  ) {
    return this.provinceAccess.unassign(id, provinceId, actor);
  }
}
