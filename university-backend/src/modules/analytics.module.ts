import { Module, Controller, Get, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { Institute } from '../entities/institute.entity';
import { Payment } from '../entities/payment.entity';
import { GradeBookEntry } from '../entities/grade-book-entry.entity';
import { Grade, GradeType } from '../entities/grade.entity';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Institute) private instituteRepo: Repository<Institute>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(GradeBookEntry) private gradeBookRepo: Repository<GradeBookEntry>,
    @InjectRepository(Grade) private gradeRepo: Repository<Grade>,
  ) {}

  async getGpaRanking(scope: string, scopeId: string, semester: number, academicYear: string) {
    const students = await this.studentRepo.find({ relations: ['group', 'group.program', 'group.program.department', 'group.program.department.institute'] });

    let filtered = students;
    if (scope === 'group' && scopeId) filtered = filtered.filter(s => s.group?.id === scopeId);
    if (scope === 'program' && scopeId) filtered = filtered.filter(s => s.group?.program?.id === scopeId);
    if (scope === 'department' && scopeId) filtered = filtered.filter(s => s.group?.program?.department?.id === scopeId);
    if (scope === 'institute' && scopeId) filtered = filtered.filter(s => s.group?.program?.department?.institute?.id === scopeId);

    const studentIds = filtered.map(s => s.id);
    if (studentIds.length === 0) return { data: [] };

    const allEntries = await this.gradeBookRepo
      .createQueryBuilder('e')
      .where('e.student_id IN (:...ids)', { ids: studentIds })
      .getMany();

    // GPA: from grades table (0-100 score), type MANUAL = final grade set by admin
    const allGrades = await this.gradeRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.student', 'student')
      .where('student.id IN (:...ids)', { ids: studentIds })
      .andWhere('g.grade_type = :type', { type: GradeType.MANUAL })
      .getMany();

    // Total lesson dates per group
    const groupLessonDates = new Map<string, Set<string>>();
    for (const e of allEntries) {
      if (e.lesson_date === null) continue;
      const key = `${e.group_id}__${e.discipline_id}`;
      if (!groupLessonDates.has(key)) groupLessonDates.set(key, new Set());
      groupLessonDates.get(key)!.add(e.lesson_date);
    }

    const ranked = filtered.map(s => {
      const entries = allEntries.filter(e => e.student_id === s.id);
      const grades = allGrades.filter(g => g.student?.id === s.id);

      // GPA: average of final scores (0-100) converted to 5-point scale
      const scores = grades.map(g => Number(g.grade_value)).filter(v => !isNaN(v) && v > 0);
      const avgScore = scores.length > 0
        ? scores.reduce((sum, v) => sum + v, 0) / scores.length
        : null;
      const gpa = avgScore !== null
        ? Number((avgScore / 20).toFixed(2))  // 100→5, 80→4, 60→3
        : null;

      // Attendance: attended / total lessons for this student's group
      const dailyEntries = entries.filter(e => e.lesson_date !== null);
      const attendedCount = dailyEntries.filter(e => e.value === '+' || (e.value !== '' && !isNaN(Number(e.value)))).length;

      let totalLessons = 0;
      for (const [key, dates] of groupLessonDates.entries()) {
        if (key.startsWith(s.group?.id ?? '')) totalLessons += dates.size;
      }

      const attendance_rate = totalLessons > 0
        ? Math.round((attendedCount / totalLessons) * 100)
        : null;

      return {
        id: s.id,
        name: `${s.last_name} ${s.first_name}`,
        group: s.group?.name || 'N/A',
        gpa,
        attendance_rate,
        grades_count: scores.length,
      };
    });

    // Students with real grades first, then alphabetically; exclude those with no data
    ranked.sort((a, b) => {
      if (b.gpa !== null && a.gpa === null) return 1;
      if (a.gpa !== null && b.gpa === null) return -1;
      if (a.gpa !== null && b.gpa !== null && b.gpa !== a.gpa) return b.gpa - a.gpa;
      if (a.attendance_rate !== null && b.attendance_rate !== null) return b.attendance_rate - a.attendance_rate;
      return 0;
    });

    const data = ranked.map((s, idx) => ({ ...s, rank: idx + 1 }));
    return { data };
  }

  async getStudentsStats() {
    const students = await this.studentRepo.find({ relations: ['group', 'group.program', 'group.program.department', 'group.program.department.institute'] });
    const stats = {
      total: students.length,
      by_enrollment: { budget: 0, contract: 0 },
      by_study_form: { full_time: 0, part_time: 0 },
      by_course: { 1: 0, 2: 0, 3: 0, 4: 0 },
      by_institute: {} as Record<string, number>,
      by_status: { active: 0, expelled: 0, academic_leave: 0 },
    };

    students.forEach(s => {
      if (s.status === 'expelled') stats.by_status.expelled++;
      else if (s.status === 'academic_leave') stats.by_status.academic_leave++;
      else stats.by_status.active++;

      if (s.enrollment_type === 'contract') stats.by_enrollment.contract++;
      else if (s.enrollment_type === 'budget') stats.by_enrollment.budget++;

      if (s.study_form === 'part_time') stats.by_study_form.part_time++;
      else stats.by_study_form.full_time++;

      const now = new Date();
      const academicStartYear = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
      const course = s.group ? Math.min(4, Math.max(1, academicStartYear - s.group.year_of_entry + 1)) : 1;
      if (stats.by_course[course] !== undefined) stats.by_course[course]++;

      const instName = s.group?.program?.department?.institute?.name;
      if (instName) stats.by_institute[instName] = (stats.by_institute[instName] || 0) + 1;
    });

    return { data: {
      ...stats,
      by_institute: Object.keys(stats.by_institute).map(k => ({ institute_name: k, count: stats.by_institute[k] })),
    }};
  }

  async getAcademicPerformance(instituteId?: string, semester?: number) {
    return { data: [
      { group: 'ПИ-21-1', gpa: 3.5, passRate: 90, attendance: 85 },
      { group: 'ИС-21-2', gpa: 3.2, passRate: 85, attendance: 78 },
      { group: 'ВТ-22-1', gpa: 3.8, passRate: 95, attendance: 92 },
      { group: 'МАТ-20-1', gpa: 2.9, passRate: 70, attendance: 65 },
    ]};
  }

  async getPaymentsStats(semester: number, academicYear: string) {
    const where: any = {};
    if (semester) where.semester = semester;
    if (academicYear) where.academic_year = academicYear;
    const payments = await this.paymentRepo.find({ where, relations: ['student', 'student.group'] });
    let total_due = 0;
    let total_paid = 0;
    let overdue_count = 0;
    let paid_count = 0;

    const overdue_students: any[] = [];

    payments.forEach(p => {
      const due = Number(p.amount_due) || 0;
      const paid = Number(p.amount_paid) || 0;
      total_due += due;
      total_paid += paid;
      
      if (p.status === 'paid') {
        paid_count++;
      } else {
        overdue_count++;
        overdue_students.push({
          id: p.student.id,
          name: `${p.student.last_name} ${p.student.first_name}`,
          group: p.student.group?.name,
          debt: due - paid
        });
      }
    });

    const payment_rate_percent = total_due > 0 ? Math.round((total_paid / total_due) * 100) : 0;
    
    const group_stats = {};
    payments.forEach(p => {
      const gName = p.student.group?.name || 'Unknown';
      if (!group_stats[gName]) group_stats[gName] = { group: gName, paid: 0, unpaid: 0 };
      group_stats[gName].paid += Number(p.amount_paid) || 0;
      group_stats[gName].unpaid += (Number(p.amount_due) || 0) - (Number(p.amount_paid) || 0);
    });

    return { data: { 
      total_due, 
      total_paid, 
      payment_rate_percent, 
      overdue_count, 
      paid_count,
      overdue_students,
      group_stats: Object.values(group_stats)
    }};
  }
}

@Controller('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('gpa-ranking') getGpaRanking(@Query('scope') s: string, @Query('scopeId') sid: string, @Query('semester') sem: number, @Query('academicYear') y: string) { return this.service.getGpaRanking(s, sid, sem, y); }
  @Get('students-stats') getStudentsStats() { return this.service.getStudentsStats(); }
  @Get('academic-performance') getAcademicPerformance(@Query('instituteId') i: string, @Query('semester') s: number) { return this.service.getAcademicPerformance(i, s); }
  @Get('payments-stats') getPaymentsStats(@Query('semester') s: number, @Query('academicYear') y: string) { return this.service.getPaymentsStats(s, y); }
}

@Module({ imports: [TypeOrmModule.forFeature([Student, Institute, Payment, GradeBookEntry, Grade])], controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
