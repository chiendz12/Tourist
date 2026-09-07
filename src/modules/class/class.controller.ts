import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { ClassService } from './class.service';
import { AddClassMemberDto } from './dto/add-class-member.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { CreateStudentGroupDto } from './dto/create-student-group.dto';

// Class rosters carry student contact details — nothing here may be public.
@ApiBearerAuth()
@ApiTags('class')
@Controller('class')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Roles(Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Get()
  findAll(@CurrentUser() actor: Actor) {
    return this.classService.findAll(actor);
  }

  @Roles(Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.classService.findOne(id, actor);
  }

  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Post()
  create(@Body() dto: CreateClassDto, @CurrentUser() actor: Actor) {
    return this.classService.create(dto, actor);
  }

  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddClassMemberDto, @CurrentUser() actor: Actor) {
    return this.classService.addMember(id, dto, actor);
  }

  @Roles(Role.SUPER_ADMIN, Role.LECTURER)
  @Post(':id/groups')
  createGroup(
    @Param('id') id: string,
    @Body() dto: CreateStudentGroupDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.classService.createGroup(id, dto, actor);
  }
}
