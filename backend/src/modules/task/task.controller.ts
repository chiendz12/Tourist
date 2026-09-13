import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskAssignmentDto } from './dto/update-task-assignment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

const USERS = [Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;
const MANAGERS = [Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN] as const;

@ApiBearerAuth()
@ApiTags('task')
@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Roles(...USERS)
  @Get()
  findAll(@Query() query: QueryTaskDto, @CurrentUser() actor: Actor) {
    return this.taskService.findAll(query, actor);
  }

  @Roles(...USERS)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.taskService.findOne(id, actor);
  }

  @Roles(...MANAGERS)
  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() actor: Actor) {
    return this.taskService.create(dto, actor);
  }

  @Roles(...MANAGERS)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() actor: Actor) {
    return this.taskService.update(id, dto, actor);
  }

  @Roles(...MANAGERS)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: Actor) {
    return this.taskService.remove(id, actor);
  }

  @Roles(...USERS)
  @Patch(':id/assignments/:assignmentId')
  updateAssignment(
    @Param('id') taskId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateTaskAssignmentDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.taskService.updateAssignment(taskId, assignmentId, dto, actor);
  }
}
