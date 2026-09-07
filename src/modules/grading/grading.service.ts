import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApprovalAction,
  ApprovalStatus,
  EntityType,
  HocPhanCode,
  Role,
} from '@prisma/client';
import { Actor } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingService } from '../tour/pricing.service';
import { RecordGradeDto } from './dto/record-grade.dto';

/**
 * Mục III — "📊 Chấm điểm" của từng học phần.
 *
 * Everything here is derived from live data; nothing is stored until a lecturer
 * records a final mark, and even then the indicators are only snapshotted.
 */
@Injectable()
export class GradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async metricsFor(studentId: string, hocPhan: HocPhanCode) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, fullName: true, email: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const indicators =
      hocPhan === HocPhanCode.HP1
        ? await this.hp1(studentId)
        : hocPhan === HocPhanCode.HP2
          ? await this.hp2(studentId)
          : await this.hp3(studentId);

    return { student, hocPhan, ...indicators };
  }

  /** Every student in a class, with their indicators for that class's học phần. */
  async metricsForClass(classId: string, actor: Actor) {
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        lecturerId: true,
        hocPhan: { select: { id: true, code: true, name: true } },
        members: {
          where: { isLeader: false },
          select: { user: { select: { id: true, fullName: true, email: true } } },
        },
      },
    });
    if (!klass) throw new NotFoundException('Class not found');
    if (actor.role !== Role.SUPER_ADMIN && klass.lecturerId !== actor.id) {
      throw new ForbiddenException('You do not teach this class');
    }

    const students = await Promise.all(
      klass.members.map((member) => this.metricsFor(member.user.id, klass.hocPhan.code)),
    );
    const grades = await this.prisma.grade.findMany({
      where: {
        classId: klass.id,
        hocPhanId: klass.hocPhan.id,
        studentId: { in: students.map((student) => student.student.id) },
      },
      select: { studentId: true, score: true, comment: true, updatedAt: true },
    });
    const gradeByStudent = new Map(grades.map((grade) => [grade.studentId, grade]));
    return {
      class: { id: klass.id, name: klass.name },
      hocPhan: klass.hocPhan,
      students: students.map((student) => ({ ...student, grade: gradeByStudent.get(student.student.id) ?? null })),
    };
  }

  /**
   * HP1 — "% được duyệt · % bị sửa · ⭐ rating từ user thật".
   */
  private async hp1(studentId: string) {
    const destinations = await this.prisma.destination.findMany({
      where: { createdById: studentId },
      select: { id: true, status: true },
    });
    const ids = destinations.map((destination) => destination.id);
    const publishedIds = destinations
      .filter((destination) => destination.status === ApprovalStatus.PUBLISHED)
      .map((destination) => destination.id);

    const [flow, ratings] = await Promise.all([
      this.flowStats([{ entityType: EntityType.DESTINATION, ids }]),
      publishedIds.length
        ? this.prisma.rating.aggregate({
            where: { destinationId: { in: publishedIds } },
            _avg: { score: true },
            _count: { _all: true },
          })
        : null,
    ]);

    return {
      created: destinations.length,
      ...flow,
      // "rating từ user thật" — only ratings on published records count.
      averageRating: ratings?._avg.score ?? null,
      ratingCount: ratings?._count._all ?? 0,
    };
  }

  /**
   * HP2 — "logic tuyến · tính hợp lý · ⭐ mức độ yêu thích của user".
   * Popularity is measured by how often visitors saved an itinerary built on their tours.
   */
  private async hp2(studentId: string) {
    const [routes, tours] = await Promise.all([
      this.prisma.route.findMany({
        where: { createdById: studentId },
        select: {
          id: true,
          status: true,
          distanceM: true,
          durationS: true,
          _count: { select: { waypoints: true } },
        },
      }),
      this.prisma.tour.findMany({
        where: { createdById: studentId },
        select: {
          id: true,
          status: true,
          days: true,
          targetAgeGroups: true,
          travelStyles: true,
          seasons: true,
        },
      }),
    ]);

    const flow = await this.flowStats([
      { entityType: EntityType.ROUTE, ids: routes.map((route) => route.id) },
      { entityType: EntityType.TOUR, ids: tours.map((tour) => tour.id) },
    ]);
    const savedCount = tours.length
      ? await this.prisma.itinerary.count({ where: { tourId: { in: tours.map((t) => t.id) } } })
      : 0;

    // A tour that names none of its design axes cannot be assessed for "tính hợp lý".
    const describedTours = tours.filter(
      (tour) =>
        tour.targetAgeGroups.length > 0 || tour.travelStyles.length > 0 || tour.seasons.length > 0,
    ).length;
    // A route needs at least two stops to be a route at all.
    const routableRoutes = routes.filter((route) => route._count.waypoints >= 2).length;
    const routed = routes.filter((route) => route.durationS !== null).length;

    return {
      routes: {
        created: routes.length,
        withAtLeastTwoStops: routableRoutes,
        averageStops: average(routes.map((route) => route._count.waypoints)),
        roadRouted: routed,
        totalDistanceM: routes.reduce((sum, route) => sum + (route.distanceM ?? 0), 0),
      },
      tours: {
        created: tours.length,
        withDesignAxes: describedTours,
        designCoverage: tours.length ? round(describedTours / tours.length) : null,
      },
      ...flow,
      savedByVisitors: savedCount,
    };
  }

  /**
   * HP3 — "đầy đủ chi phí · tính hợp lý giá · khả năng cạnh tranh".
   */
  private async hp3(studentId: string) {
    const tours = await this.prisma.tour.findMany({
      where: { createdById: studentId },
      select: {
        id: true,
        days: true,
        paxCount: true,
        basePrice: true,
        status: true,
        costs: {
          select: { category: true, unitPrice: true, quantity: true, isPerPerson: true },
        },
      },
    });

    const priced = tours.map((tour) => {
      const roll = this.pricing.rollUp(tour, tour.costs);
      return {
        tourId: tour.id,
        costLines: tour.costs.length,
        completenessRatio: roll.completenessRatio,
        missingCategories: roll.missing,
        marginPercent: roll.marginPercent,
        sellsBelowCost: roll.sellsBelowCost,
      };
    });

    const flow = await this.flowStats([
      { entityType: EntityType.TOUR, ids: tours.map((tour) => tour.id) },
    ]);
    const margins = priced
      .map((entry) => entry.marginPercent)
      .filter((value): value is number => value !== null);

    return {
      tours: tours.length,
      toursWithCosts: priced.filter((entry) => entry.costLines > 0).length,
      averageCostCompleteness: average(priced.map((entry) => entry.completenessRatio)),
      fullyCostedTours: priced.filter((entry) => entry.completenessRatio === 1).length,
      averageMarginPercent: average(margins),
      toursSellingBelowCost: priced.filter((entry) => entry.sellsBelowCost).length,
      ...flow,
      perTour: priced,
    };
  }

  /**
   * "% được duyệt" and "% bị sửa" across one or two entity types.
   * The denominator is what the student actually submitted — unsubmitted drafts
   * are neither approved nor rejected, so counting them would distort both rates.
   */
  private async flowStats(groups: { entityType: EntityType; ids: string[] }[]) {
    const filters = groups
      .filter((group) => group.ids.length > 0)
      .map((group) => ({ entityType: group.entityType, entityId: { in: group.ids } }));
    if (filters.length === 0) {
      return { submitted: 0, published: 0, rejected: 0, sentBack: 0, approvalRate: null, revisionRate: null };
    }

    const approvals = await this.prisma.approval.findMany({
      where: { OR: filters },
      select: { status: true, history: { select: { action: true } } },
    });
    const submitted = approvals.length;
    const published = approvals.filter((a) => a.status === ApprovalStatus.PUBLISHED).length;
    const rejected = approvals.filter((a) => a.status === ApprovalStatus.REJECTED).length;
    const sentBack = approvals.filter((a) =>
      a.history.some((entry) => entry.action === ApprovalAction.REVISE),
    ).length;

    return {
      submitted,
      published,
      rejected,
      sentBack,
      approvalRate: submitted ? round(published / submitted) : null,
      revisionRate: submitted ? round(sentBack / submitted) : null,
    };
  }

  // ── Recorded marks ────────────────────────────────────────────────

  async record(dto: RecordGradeDto, actor: Actor) {
    const hocPhan = await this.prisma.hocPhan.findUnique({
      where: { id: dto.hocPhanId },
      select: { id: true, code: true },
    });
    if (!hocPhan) throw new NotFoundException('Học phần not found');
    await this.assertGrades(dto.studentId, actor);

    // Snapshot the indicators the mark was based on, so a later data change
    // does not silently rewrite the justification for a grade already given.
    const metrics = await this.metricsFor(dto.studentId, hocPhan.code);

    return this.prisma.grade.upsert({
      where: { studentId_hocPhanId: { studentId: dto.studentId, hocPhanId: dto.hocPhanId } },
      create: {
        studentId: dto.studentId,
        hocPhanId: dto.hocPhanId,
        classId: dto.classId,
        score: dto.score,
        comment: dto.comment,
        metrics: metrics as object,
        gradedById: actor.id,
      },
      update: {
        classId: dto.classId,
        score: dto.score,
        comment: dto.comment,
        metrics: metrics as object,
        gradedById: actor.id,
      },
      include: { hocPhan: { select: { code: true, name: true } } },
    });
  }

  gradesOf(studentId: string) {
    return this.prisma.grade.findMany({
      where: { studentId },
      include: {
        hocPhan: { select: { code: true, name: true } },
        gradedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** A lecturer may only mark students in a class they teach. */
  async assertGrades(studentId: string, actor: Actor) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (actor.role !== Role.LECTURER) {
      throw new ForbiddenException('Only a lecturer or the admin can grade');
    }
    const inMyClass = await this.prisma.classMember.findFirst({
      where: { userId: studentId, class: { lecturerId: actor.id } },
      select: { userId: true },
    });
    if (!inMyClass) throw new ForbiddenException('This student is not in a class you teach');
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
