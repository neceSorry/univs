import {
  Module, Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, Injectable, Request,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentServiceType } from '../entities/payment.entity';
import { Student } from '../entities/student.entity';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
  ) {}

  async findAll(studentId?: string, semester?: number, status?: string, groupId?: string, serviceType?: string) {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.student', 'student')
      .leftJoinAndSelect('student.group', 'grp');

    if (studentId) qb.andWhere('student.id = :studentId', { studentId });
    if (semester) qb.andWhere('p.semester = :semester', { semester: Number(semester) });
    if (status) qb.andWhere('p.status = :status', { status });
    if (groupId) qb.andWhere('grp.id = :groupId', { groupId });
    if (serviceType) qb.andWhere('p.service_type = :serviceType', { serviceType });

    qb.orderBy('p.paid_at', 'DESC', 'NULLS LAST').addOrderBy('student.last_name', 'ASC');

    return { data: await qb.getMany() };
  }

  async getStats() {
    const payments = await this.paymentRepo.find();
    let totalDue = 0, totalPaid = 0, paidCount = 0, unpaidCount = 0, overdueCount = 0;
    for (const p of payments) {
      totalDue += Number(p.amount_due) || 0;
      totalPaid += Number(p.amount_paid) || 0;
      if (p.status === PaymentStatus.PAID) paidCount++;
      if (p.status === PaymentStatus.OVERDUE) overdueCount++;
      if (p.status !== PaymentStatus.PAID) unpaidCount++;
    }
    return { data: { totalDue, totalPaid, paidCount, unpaidCount, overdueCount, totalInvoices: payments.length } };
  }

  async getStatsByGroup() {
    const payments = await this.paymentRepo.find({
      relations: ['student', 'student.group'],
    });
    const groupMap: Record<string, { group_name: string; paid: number; unpaid: number }> = {};
    for (const p of payments) {
      const groupName = p.student?.group?.name ?? 'Без группы';
      if (!groupMap[groupName]) {
        groupMap[groupName] = { group_name: groupName, paid: 0, unpaid: 0 };
      }
      if (p.status === PaymentStatus.PAID) {
        groupMap[groupName].paid += Number(p.amount_due);
      } else {
        groupMap[groupName].unpaid += Number(p.amount_due) - Number(p.amount_paid);
      }
    }
    return { data: Object.values(groupMap) };
  }

  async generate(dto: any) {
    let students: any[] = [];

    if (dto.student_id) {
      // Single student invoice
      const s = await this.studentRepo.findOne({ where: { id: dto.student_id } });
      if (s) students = [s];
    } else {
      // Whole group — only contract students
      students = await this.studentRepo.find({
        where: { group: { id: dto.group_id }, enrollment_type: 'contract' as any },
        relations: ['group'],
      });
    }

    const entities = students.map(s => this.paymentRepo.create({
      student: { id: s.id } as any,
      service_type: dto.service_type ?? PaymentServiceType.TUITION,
      semester: dto.semester,
      academic_year: dto.academic_year,
      amount_due: dto.amount,
      amount_paid: 0,
      status: PaymentStatus.PENDING,
      due_date: dto.due_date ?? null,
    }));
    await this.paymentRepo.save(entities);
    return { data: { success: true, count: entities.length } };
  }

  // Admin override — force-record payment
  async pay(id: string, dto: any) {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) return { data: null };
    payment.amount_paid = Number(payment.amount_paid || 0) + Number(dto.amount_paid);
    payment.receipt_number = dto.receipt_number ?? payment.receipt_number;
    payment.paid_at = new Date();
    payment.status = payment.amount_paid >= payment.amount_due ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
    await this.paymentRepo.save(payment);
    return { data: payment };
  }

  // Student self-service — submit payment without admin confirmation
  async submitPayment(id: string, studentUserId: string, dto: { amount_paid: number; receipt_number: string }) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['student', 'student.user'],
    });
    if (!payment) return { data: null };
    // Ensure the payment belongs to this student
    if (payment.student?.user?.id !== studentUserId) {
      return { data: null, message: 'Forbidden' };
    }
    payment.amount_paid = Number(payment.amount_paid || 0) + Number(dto.amount_paid);
    payment.receipt_number = dto.receipt_number;
    payment.paid_at = new Date();
    payment.status = payment.amount_paid >= payment.amount_due ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
    await this.paymentRepo.save(payment);
    return { data: payment };
  }

  async getMyPayments(userId: string) {
    const student = await this.studentRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!student) return { data: [] };
    const payments = await this.paymentRepo.find({
      where: { student: { id: student.id } },
      order: { semester: 'DESC', paid_at: 'DESC' },
    });
    return { data: payments };
  }

  async remove(id: string) {
    await this.paymentRepo.delete(id);
    return { data: { success: true } };
  }

  // Returns whether a student is allowed (has paid tuition for given semester)
  async checkAccess(studentId: string, semester: number) {
    const payment = await this.paymentRepo.findOne({
      where: {
        student: { id: studentId },
        service_type: PaymentServiceType.TUITION,
        semester: Number(semester),
      },
    });
    if (!payment) return { data: { allowed: true } }; // no invoice = no restriction
    const allowed = payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIAL;
    return { data: { allowed, payment } };
  }

  // Returns studentId -> allowed map for a group + semester (for teacher grade book)
  async checkAccessByGroup(groupId: string, semester: number) {
    const payments = await this.paymentRepo.find({
      where: {
        student: { group: { id: groupId } },
        service_type: PaymentServiceType.TUITION,
        semester: Number(semester),
      },
      relations: ['student'],
    });
    const result: Record<string, boolean> = {};
    for (const p of payments) {
      result[p.student.id] = p.status === PaymentStatus.PAID || p.status === PaymentStatus.PARTIAL;
    }
    return { data: result };
  }
}

@Controller('payments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get()
  findAll(
    @Query('studentId') st: string,
    @Query('semester') s: number,
    @Query('status') stts: string,
    @Query('groupId') groupId: string,
    @Query('serviceType') serviceType: string,
  ) {
    return this.service.findAll(st, s, stts, groupId, serviceType);
  }

  @Get('stats')
  getStats() { return this.service.getStats(); }

  @Get('stats/by-group')
  getStatsByGroup() { return this.service.getStatsByGroup(); }

  @Get('access/check')
  checkAccess(@Query('studentId') studentId: string, @Query('semester') semester: number) {
    return this.service.checkAccess(studentId, semester);
  }

  @Get('access/by-group')
  checkAccessByGroup(@Query('groupId') groupId: string, @Query('semester') semester: number) {
    return this.service.checkAccessByGroup(groupId, semester);
  }

  @Get('my')
  getMyPayments(@Request() req: any) {
    return this.service.getMyPayments(req.user.id);
  }

  @Post('generate')
  @Roles('admin')
  generate(@Body() dto: any) { return this.service.generate(dto); }

  @Put(':id/pay')
  @Roles('admin')
  pay(@Param('id') id: string, @Body() dto: any) { return this.service.pay(id, dto); }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @Put(':id/submit')
  submitPayment(
    @Param('id') id: string,
    @Body() dto: { amount_paid: number; receipt_number: string },
    @Request() req: any,
  ) {
    return this.service.submitPayment(id, req.user.id, dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Student])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
