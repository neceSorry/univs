import { Module, Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request, Injectable, Query } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { Student } from '../entities/student.entity';
import { ScheduleSlot } from '../entities/schedule-slot.entity';
import { VersionStatus } from '../entities/schedule-version.entity';
import { Grade } from '../entities/grade.entity';
import { Attendance } from '../entities/attendance.entity';
import { Exam, ExamStatus } from '../entities/exam.entity';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Discipline } from '../entities/discipline.entity';
import { CurriculumItem } from '../entities/curriculum-item.entity';
import { GradeBookEntry } from '../entities/grade-book-entry.entity';

@Injectable()
export class StudentCabinetService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(ScheduleSlot) private slotRepo: Repository<ScheduleSlot>,
    @InjectRepository(Grade) private gradeRepo: Repository<Grade>,
    @InjectRepository(Attendance) private attRepo: Repository<Attendance>,
    @InjectRepository(Exam) private examRepo: Repository<Exam>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(CurriculumItem) private curriculumItemRepo: Repository<CurriculumItem>,
    @InjectRepository(GradeBookEntry) private gradeBookRepo: Repository<GradeBookEntry>,
  ) {}

  async getStudentByUserId(userId: string) {
    return this.studentRepo.findOne({ where: { user: { id: userId } }, relations: ['group', 'group.program'] });
  }

  async getMyInfo(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return { data: null };
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const course = student.group ? currentYear - student.group.year_of_entry + (currentMonth >= 9 ? 1 : 0) : null;
    return {
      data: {
        first_name: student.first_name,
        last_name: student.last_name,
        middle_name: student.middle_name,
        group_name: student.group?.name ?? null,
        program_name: student.group?.program?.name ?? null,
        year_of_entry: student.group?.year_of_entry ?? null,
        course,
        enrollment_type: student.enrollment_type,
        gender: student.gender,
        status: student.status,
      },
    };
  }

  async getMySchedule(userId: string, period?: string, academicYear?: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student || !student.group) return { data: [], published: false };
    const qb = this.slotRepo.createQueryBuilder('slot')
      .leftJoinAndSelect('slot.discipline', 'discipline')
      .leftJoinAndSelect('slot.teacher', 'teacher')
      .leftJoin('slot.version', 'version')
      .where('slot.group_id = :groupId', { groupId: student.group.id })
      .andWhere('version.status = :status', { status: VersionStatus.PUBLISHED });
    if (period) qb.andWhere('version.period = :period', { period });
    if (academicYear) qb.andWhere('version.academic_year = :academicYear', { academicYear });
    const slots = await qb.getMany();
    return { data: slots, published: slots.length > 0 };
  }

  async getMyGrades(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return { data: [] };
    const grades = await this.gradeRepo.find({ where: { student: { id: student.id } }, relations: ['discipline', 'slot', 'slot.discipline', 'slot.version'], order: { graded_at: 'DESC' } });
    return { data: grades };
  }

  async getMyAttendance(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return { data: [] };
    const att = await this.attRepo.find({ where: { student: { id: student.id } }, relations: ['slot', 'slot.discipline'] });
    return { data: att };
  }

  async getMyExams(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student || !student.group) return { data: [] };
    const exams = await this.examRepo.find({
      where: { group: { id: student.group.id }, status: ExamStatus.APPROVED },
      relations: ['discipline', 'teacher', 'classroom'],
    });
    return { data: exams };
  }

  async getMyPayment(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return { data: null };
    const payment = await this.paymentRepo.findOne({ where: { student: { id: student.id } }, order: { semester: 'DESC' } });
    return { data: payment };
  }

  async getMyPayments(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return { data: [] };
    const payments = await this.paymentRepo.find({
      where: { student: { id: student.id } },
      order: { semester: 'DESC' },
    });
    return { data: payments };
  }

  async submitMyPayment(userId: string, paymentId: string, dto: { amount_paid: number; receipt_number: string }) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return { data: null };
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, student: { id: student.id } },
    });
    if (!payment) return { data: null };
    payment.amount_paid = Number(payment.amount_paid || 0) + Number(dto.amount_paid);
    payment.receipt_number = dto.receipt_number;
    payment.paid_at = new Date();
    payment.status = payment.amount_paid >= payment.amount_due ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
    await this.paymentRepo.save(payment);
    return { data: payment };
  }

  async getMyGpa(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return { data: null };
    const grades = await this.gradeRepo.find({ where: { student: { id: student.id } } });
    if (grades.length === 0) return { data: null };
    const avg = grades.reduce((sum, g) => sum + Number(g.grade_value), 0) / grades.length;
    return { data: { currentGpa: Math.round(avg * 100) / 100, history: [], rankGroup: null, rankCourse: null, rankInstitute: null } };
  }

  async getMyOrders(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student || !student.group) return { data: [] };
    const entryYear = student.group.year_of_entry;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const completedCourses = Math.min(
      currentYear - entryYear - (currentMonth < 9 ? 1 : 0),
      3, // максимум 3 перевода (с 1 на 2, 2 на 3, 3 на 4 курс)
    );
    const orders: any[] = [
      { id: '1', type: 'Зачисление', date: `${entryYear}-09-01`, number: `ЗЧ-${entryYear}-001` },
    ];
    for (let i = 1; i <= completedCourses; i++) {
      orders.push({
        id: `${i + 1}`,
        type: `Перевод на ${i + 1} курс`,
        date: `${entryYear + i}-06-30`,
        number: `ПР-${entryYear + i}-${String(i).padStart(3, '0')}`,
      });
    }
    return { data: orders };
  }

  async getAvailableDisciplines(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student?.group?.program) return { data: [] };

    // All curriculum disciplines for student's program
    const items = await this.curriculumItemRepo.find({
      where: { plan: { program: { id: student.group.program.id } } },
      relations: ['discipline', 'discipline.department', 'plan', 'plan.program'],
    });

    // Disciplines already graded for this student
    const grades = await this.gradeRepo.find({
      where: { student: { id: student.id } },
      relations: ['discipline'],
    });
    const gradedIds = new Set(grades.map(g => g.discipline?.id).filter(Boolean));

    // Unique disciplines from curriculum not yet closed by a grade
    const seen = new Set<string>();
    const result: any[] = [];
    for (const item of items) {
      const d = item.discipline;
      if (!d || seen.has(d.id) || gradedIds.has(d.id)) continue;
      seen.add(d.id);
      result.push({
        id: d.id,
        name: d.name,
        hours_lecture: item.hours_lecture,
        hours_practice: item.hours_practice,
        hours_lab: item.hours_lab,
        credits: item.credits,
      });
    }
    return { data: result };
  }

  async getMyCurriculumDisciplines(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student?.group?.program) return { data: [] };

    const items = await this.curriculumItemRepo.find({
      where: { plan: { program: { id: student.group.program.id } } },
      relations: ['discipline', 'plan', 'plan.program'],
    });

    const seen = new Set<string>();
    const result: any[] = [];
    for (const item of items) {
      const d = item.discipline;
      if (!d || seen.has(d.id)) continue;
      seen.add(d.id);
      result.push({ id: d.id, name: d.name, semester: item.plan?.semester ?? null, credits: item.credits });
    }
    return { data: result };
  }

  async getMyJournal(userId: string) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return { data: [] };
    const entries = await this.gradeBookRepo.find({
      where: { student_id: student.id },
      order: { lesson_date: 'ASC' },
    });
    // Group by discipline_id
    const map: Record<string, { discipline_id: string; entries: any[] }> = {};
    for (const e of entries) {
      if (!map[e.discipline_id]) map[e.discipline_id] = { discipline_id: e.discipline_id, entries: [] };
      map[e.discipline_id].entries.push({ lesson_date: e.lesson_date, value: e.value });
    }
    return { data: Object.values(map) };
  }

  async registerDiscipline(userId: string, dto: any) {
    return { success: true };
  }

  async cancelDiscipline(userId: string, id: string) {
    return { success: true };
  }
}

@Controller('student')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('student')
export class StudentCabinetController {
  constructor(private readonly service: StudentCabinetService) {}

  @Get('my-info') getMyInfo(@Request() req) { return this.service.getMyInfo(req.user.id); }
  @Get('my-schedule') getMySchedule(@Request() req, @Query('period') period?: string, @Query('academicYear') academicYear?: string) { return this.service.getMySchedule(req.user.id, period, academicYear); }
  @Get('my-grades') getMyGrades(@Request() req) { return this.service.getMyGrades(req.user.id); }
  @Get('my-attendance') getMyAttendance(@Request() req) { return this.service.getMyAttendance(req.user.id); }
  @Get('my-journal') getMyJournal(@Request() req) { return this.service.getMyJournal(req.user.id); }
  @Get('my-exams') getMyExams(@Request() req) { return this.service.getMyExams(req.user.id); }
  @Get('my-payment') getMyPayment(@Request() req) { return this.service.getMyPayment(req.user.id); }
  @Get('my-payments') getMyPayments(@Request() req) { return this.service.getMyPayments(req.user.id); }
  @Put('payments/:id/submit') submitMyPayment(@Request() req, @Param('id') id: string, @Body() dto: any) { return this.service.submitMyPayment(req.user.id, id, dto); }
  @Get('my-gpa') getMyGpa(@Request() req) { return this.service.getMyGpa(req.user.id); }
  @Get('my-orders') getMyOrders(@Request() req) { return this.service.getMyOrders(req.user.id); }
  @Get('my-curriculum') getMyCurriculumDisciplines(@Request() req) { return this.service.getMyCurriculumDisciplines(req.user.id); }
  @Get('available-disciplines') getAvailableDisciplines(@Request() req) { return this.service.getAvailableDisciplines(req.user.id); }
  @Post('register-discipline') registerDiscipline(@Request() req, @Body() dto: any) { return this.service.registerDiscipline(req.user.id, dto); }
  @Delete('register-discipline/:id') cancelDiscipline(@Request() req, @Param('id') id: string) { return this.service.cancelDiscipline(req.user.id, id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Student, ScheduleSlot, Grade, Attendance, Exam, Payment, CurriculumItem, GradeBookEntry])],
  controllers: [StudentCabinetController],
  providers: [StudentCabinetService],
})
export class StudentCabinetModule {}
