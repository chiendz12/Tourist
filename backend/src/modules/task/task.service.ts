import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, TaskPriority, TaskStatus } from '@prisma/client';
import { Actor } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../../types';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { UpdateTaskAssignmentDto } from './dto/update-task-assignment.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_INCLUDE = {
  hocPhan: { select: { id: true, code: true, name: true } },
  class: { select: { id: true, code: true, name: true, lecturerId: true } },
  group: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true, role: true } },
  assignments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      assignee: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      assignedBy: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.TaskInclude;

type Scope = {
  classIds: string[] | null;
  memberIds: string[];
  ledGroupIds: string[];
};

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryTaskDto, actor: Actor): Promise<PaginatedResult<unknown>> {
    const scope = await this.scopeFor(actor);
    const where = this.whereFor(actor, scope);
    if (query.classId) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { classId: query.classId }];
      delete where.classId;
    }
    if (query.status) {
      const existingAssignmentFilter = where.assignments;
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        ...(existingAssignmentFilter ? [{ assignments: existingAssignmentFilter }] : []),
        { assignments: { some: { status: query.status } } },
      ];
      delete where.assignments;
    }
    if (query.dueOnly === 'true') where.dueAt = { not: null };

    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data: rows.map((task) => this.present(task, actor, scope)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, actor: Actor) {
    const scope = await this.scopeFor(actor);
    const task = await this.prisma.task.findFirst({
      where: { id, ...this.whereFor(actor, scope) },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.present(task, actor, scope);
  }

  async create(dto: CreateTaskDto, actor: Actor) {
    if (
      actor.role !== Role.LECTURER &&
      actor.role !== Role.LEADER &&
      actor.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only a lecturer, leader, or admin can create tasks');
    }
    const klass = await this.loadClass(dto.classId);
    await this.assertCanManageClass(klass, actor, dto.groupId);
    if (klass.hocPhanId !== dto.hocPhanId) {
      throw new BadRequestException('The task học phần must match the selected class');
    }

    const members = await this.validateAssignees(klass.id, dto.assigneeIds, dto.groupId, actor);
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        hocPhanId: dto.hocPhanId,
        classId: dto.classId,
        groupId: dto.groupId,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        createdById: actor.id,
        assignments: {
          create: members.map((member) => ({
            assigneeId: member.userId,
            assignedById: actor.id,
          })),
        },
      },
      include: TASK_INCLUDE,
    });
    return this.present(task, actor, await this.scopeFor(actor));
  }

  async update(id: string, dto: UpdateTaskDto, actor: Actor) {
    const task = await this.loadTaskForManager(id, actor);
    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
      include: TASK_INCLUDE,
    });
    return this.present(updated, actor, await this.scopeFor(actor));
  }

  async remove(id: string, actor: Actor) {
    const task = await this.loadTaskForManager(id, actor);
    await this.prisma.task.delete({ where: { id: task.id } });
    return { id, deleted: true };
  }

  async updateAssignment(
    taskId: string,
    assignmentId: string,
    dto: UpdateTaskAssignmentDto,
    actor: Actor,
  ) {
    const assignment = await this.prisma.taskAssignment.findFirst({
      where: { id: assignmentId, taskId },
      include: {
        task: {
          select: {
            id: true,
            classId: true,
            groupId: true,
            createdById: true,
            class: { select: { lecturerId: true } },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Task assignment not found');

    const isAssignee = assignment.assigneeId === actor.id;
    if (!isAssignee) await this.assertCanManageTask(assignment.task, actor);

    const progress = dto.progress ?? assignment.progress;
    const status = dto.status ?? this.statusForProgress(progress, assignment.status);
    if (status === TaskStatus.COMPLETED && progress < 100) {
      throw new BadRequestException('A completed task must have 100% progress');
    }

    const updated = await this.prisma.taskAssignment.update({
      where: { id: assignment.id },
      data: {
        status,
        progress,
        note: dto.note,
        submittedAt: status === TaskStatus.SUBMITTED ? new Date() : undefined,
        completedAt: status === TaskStatus.COMPLETED ? new Date() : undefined,
      },
      include: {
        assignee: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        assignedBy: { select: { id: true, fullName: true } },
      },
    });
    return updated;
  }

  private async scopeFor(actor: Actor): Promise<Scope> {
    if (actor.role === Role.SUPER_ADMIN) return { classIds: null, memberIds: [], ledGroupIds: [] };
    if (actor.role === Role.LECTURER) {
      const classes = await this.prisma.class.findMany({
        where: { lecturerId: actor.id },
        select: { id: true },
      });
      return { classIds: classes.map((item) => item.id), memberIds: [], ledGroupIds: [] };
    }

    const memberships = await this.prisma.classMember.findMany({
      where: { userId: actor.id },
      select: { classId: true, groupId: true, isLeader: true },
    });
    const classIds = [...new Set(memberships.map((item) => item.classId))];
    if (actor.role !== Role.LEADER) {
      return { classIds, memberIds: [actor.id], ledGroupIds: [] };
    }

    const ledGroupIds = memberships
      .filter((item) => item.isLeader && item.groupId)
      .map((item) => item.groupId as string);
    const groupMembers = ledGroupIds.length
      ? await this.prisma.classMember.findMany({
          where: { groupId: { in: ledGroupIds } },
          select: { userId: true },
          distinct: ['userId'],
        })
      : [];
    return {
      classIds,
      memberIds: [actor.id, ...groupMembers.map((item) => item.userId)],
      ledGroupIds,
    };
  }

  private whereFor(actor: Actor, scope: Scope): Prisma.TaskWhereInput {
    if (actor.role === Role.SUPER_ADMIN) return {};
    const classScope = { classId: { in: scope.classIds ?? [] } };
    if (actor.role === Role.LECTURER) return classScope;
    if (actor.role === Role.LEADER) {
      return {
        ...classScope,
        OR: [
          { createdById: actor.id },
          ...(scope.ledGroupIds.length ? [{ groupId: { in: scope.ledGroupIds } }] : []),
          { assignments: { some: { assigneeId: { in: scope.memberIds } } } },
        ],
      };
    }
    return { ...classScope, assignments: { some: { assigneeId: actor.id } } };
  }

  private async loadClass(classId: string) {
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        hocPhanId: true,
        lecturerId: true,
        members: { select: { userId: true, groupId: true, isLeader: true } },
        groups: { select: { id: true, classId: true } },
      },
    });
    if (!klass) throw new NotFoundException('Class not found');
    return klass;
  }

  private async validateAssignees(
    classId: string,
    assigneeIds: string[],
    groupId: string | undefined,
    actor: Actor,
  ) {
    const klass = await this.loadClass(classId);
    if (groupId && !klass.groups.some((group) => group.id === groupId)) {
      throw new BadRequestException('The task group does not belong to this class');
    }
    const allowed = klass.members.filter((member) =>
      groupId ? member.groupId === groupId : true,
    );
    const uniqueIds = [...new Set(assigneeIds)];
    const allowedIds = new Set(allowed.map((member) => member.userId));
    if (uniqueIds.some((id) => !allowedIds.has(id))) {
      throw new ForbiddenException('Every assignee must be a member of the selected class/group');
    }
    if (actor.role === Role.LEADER) {
      if (!groupId) throw new ForbiddenException('A leader may only assign tasks to a group');
      const leadsGroup = klass.members.some(
        (member) => member.userId === actor.id && member.isLeader && member.groupId === groupId,
      );
      if (!leadsGroup) throw new ForbiddenException('You do not lead this group');
    }
    return allowed.filter((member) => uniqueIds.includes(member.userId));
  }

  private async assertCanManageClass(
    klass: Awaited<ReturnType<TaskService['loadClass']>>,
    actor: Actor,
    groupId?: string,
  ) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (actor.role === Role.LECTURER && klass.lecturerId === actor.id) return;
    if (actor.role === Role.LEADER) {
      const leadsGroup = klass.members.some(
        (member) => member.userId === actor.id && member.isLeader && member.groupId === groupId,
      );
      if (leadsGroup) return;
    }
    throw new ForbiddenException('You cannot create tasks for this class/group');
  }

  private async loadTaskForManager(id: string, actor: Actor) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        groupId: true,
        classId: true,
        class: { select: { lecturerId: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertCanManageTask(task, actor);
    return task;
  }

  private async assertCanManageTask(
    task: { createdById: string; groupId: string | null; classId: string; class: { lecturerId: string | null } },
    actor: Actor,
  ) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (actor.role === Role.LECTURER && task.class.lecturerId === actor.id) return;
    if (actor.role === Role.LEADER && task.createdById === actor.id && task.groupId) {
      const leadsGroup = await this.prisma.classMember.findFirst({
        where: { userId: actor.id, isLeader: true, groupId: task.groupId, classId: task.classId },
        select: { userId: true },
      });
      if (leadsGroup) return;
    }
    throw new ForbiddenException('You cannot manage this task');
  }

  private statusForProgress(progress: number, current: TaskStatus): TaskStatus {
    if (progress >= 100) return TaskStatus.COMPLETED;
    if (progress > 0 && current === TaskStatus.TODO) return TaskStatus.IN_PROGRESS;
    return current;
  }

  private present(task: any, actor: Actor, scope: Scope) {
    const assignments = (task.assignments ?? []).filter((assignment: any) => {
      if (actor.role === Role.STUDENT) return assignment.assigneeId === actor.id;
      if (actor.role === Role.LEADER) return scope.memberIds.includes(assignment.assigneeId);
      return true;
    });
    const byStatus = Object.fromEntries(
      Object.values(TaskStatus).map((status) => [
        status,
        assignments.filter((assignment: any) => assignment.status === status).length,
      ]),
    );
    const progress = assignments.length
      ? Math.round(assignments.reduce((sum: number, assignment: any) => sum + assignment.progress, 0) / assignments.length)
      : 0;
    return {
      ...task,
      assignments,
      progress,
      assignmentSummary: { total: assignments.length, byStatus },
      deadlineStatus: task.dueAt
        ? new Date(task.dueAt).getTime() < Date.now()
          ? 'OVERDUE'
          : 'OPEN'
        : 'NONE',
    };
  }
}
