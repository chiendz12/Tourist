import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { CreateHocPhanDto } from './dto/create-hocphan.dto';
import { EnrollHocPhanDto } from './dto/enroll-hocphan.dto';
import { HocPhanService } from './hocphan.service';

@ApiTags('hocphan')
@Controller('hocphan')
export class HocPhanController {
  constructor(private readonly hocPhanService: HocPhanService) {}

  @Public()
  @Get()
  findAll() {
    return this.hocPhanService.findAll();
  }

  // Public, but the enrolled-student roster is only attached for staff.
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor?: Actor) {
    return this.hocPhanService.findOne(id, actor);
  }

  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Post()
  create(@Body() dto: CreateHocPhanDto, @CurrentUser() actor: Actor) {
    return this.hocPhanService.create(dto, actor);
  }

  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Post('enroll')
  enroll(@Body() dto: EnrollHocPhanDto, @CurrentUser() actor: Actor) {
    return this.hocPhanService.enroll(dto, actor);
  }
}
