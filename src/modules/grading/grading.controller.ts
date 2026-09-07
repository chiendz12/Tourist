import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { Actor } from '../../common/utils/ownership.util';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { RecordGradeDto } from './dto/record-grade.dto';
import { GradingService } from './grading.service';

@ApiBearerAuth()
@ApiTags('grading')
@Controller('grading')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  /** A student can always see how they are tracking. */
  @Roles(Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Get('me')
  myMetrics(@Query() query: MetricsQueryDto, @CurrentUser() actor: Actor) {
    return this.gradingService.metricsFor(actor.id, query.hocPhan);
  }

  @Roles(Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Get('grades/me')
  myGrades(@CurrentUser() actor: Actor) {
    return this.gradingService.gradesOf(actor.id);
  }

  @Roles(Role.LECTURER, Role.SUPER_ADMIN)
  @Get('student/:studentId')
  async studentMetrics(
    @Param('studentId') studentId: string,
    @Query() query: MetricsQueryDto,
    @CurrentUser() actor: Actor,
  ) {
    await this.gradingService.assertGrades(studentId, actor);
    return this.gradingService.metricsFor(studentId, query.hocPhan);
  }

  @Roles(Role.LECTURER, Role.SUPER_ADMIN)
  @Get('student/:studentId/grades')
  async studentGrades(@Param('studentId') studentId: string, @CurrentUser() actor: Actor) {
    await this.gradingService.assertGrades(studentId, actor);
    return this.gradingService.gradesOf(studentId);
  }

  /** Whole-class board for the class's own học phần. */
  @Roles(Role.LECTURER, Role.SUPER_ADMIN)
  @Get('class/:classId')
  classMetrics(@Param('classId') classId: string, @CurrentUser() actor: Actor) {
    return this.gradingService.metricsForClass(classId, actor);
  }

  /** Giảng viên "chấm điểm tổng" — the final mark, with the indicators snapshotted. */
  @Roles(Role.LECTURER, Role.SUPER_ADMIN)
  @Post()
  record(@Body() dto: RecordGradeDto, @CurrentUser() actor: Actor) {
    return this.gradingService.record(dto, actor);
  }
}
