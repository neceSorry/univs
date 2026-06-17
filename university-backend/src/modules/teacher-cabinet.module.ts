import { Module, Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Request, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { Teacher } from '../entities/teacher.entity';
import { CurriculumItem } from '../entities/curriculum-item.entity';
import { ScheduleSlot } from '../entities/schedule-slot.entity';
import { Student } from '../entities/student.entity';
import { Group } from '../entities/group.entity';
import { Exam, ExamStatus } from '../entities/exam.entity';
import { GradeBookEntry } from '../entities/grade-book-entry.entity';
import { Grade, GradeType } from '../entities/grade.entity';
import { Discipline } from '../entities/discipline.entity';

@Injectable()
export class TeacherCabinetService {
  constructor(
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(CurriculumItem) private ciRepo: Repository<CurriculumItem>,
    @InjectRepository(ScheduleSlot) private slotRepo: Repository<ScheduleSlot>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(Exam) private examRepo: Repository<Exam>,
    @InjectRepository(GradeBookEntry) private gradeBookRepo: Repository<GradeBookEntry>,
    @InjectRepository(Grade) private gradeRepo: Repository<Grade>,
    @InjectRepository(Discipline) private disciplineRepo: Repository<Discipline>,
  ) {}

  async getTeacherByUserId(userId: string) {
    return this.teacherRepo.findOne({ where: { user: { id: userId } } });
  }

  async getMyDisciplines(userId: string) {
    const teacher = await this.getTeacherByUserId(userId);
    if (!teacher) return { data: [] };

    const [lec, pra, lab] = await Promise.all([
      this.ciRepo.find({ where: { teacher_lecture: { id: teacher.id } }, relations: ['discipline'] }),
      this.ciRepo.find({ where: { teacher_practice: { id: teacher.id } }, relations: ['discipline'] }),
      this.ciRepo.find({ where: { teacher_lab: { id: teacher.id } }, relations: ['discipline'] }),
    ]);
    const disciplinesMap = new Map();
    [...lec, ...pra, ...lab].forEach(i => {
      if (!disciplinesMap.has(i.discipline.id)) {
        disciplinesMap.set(i.discipline.id, { ...i.discipline, curriculumItemId: i.id });
      }
    });
    return { data: Array.from(disciplinesMap.values()) };
  }

  async getMyGroups(userId: string) {
    const teacher = await this.getTeacherByUserId(userId);
    if (!teacher) return { data: [] };

    const slots = await this.slotRepo.find({ where: { teacher: { id: teacher.id } }, relations: ['group'] });
    const groupsMap = new Map();
    slots.forEach(s => {
      if (s.group && !groupsMap.has(s.group.id)) groupsMap.set(s.group.id, s.group);
    });
    return { data: Array.from(groupsMap.values()) };
  }

  async getGroupStudents(groupId: string) {
    const students = await this.studentRepo.find({ where: { group: { id: groupId } }, order: { last_name: 'ASC' } });
    return { data: students };
  }

  async getMySchedule(userId: string, period?: string, academicYear?: string) {
    const teacher = await this.getTeacherByUserId(userId);
    if (!teacher) return { data: [] };

    const qb = this.slotRepo.createQueryBuilder('slot')
      .leftJoinAndSelect('slot.group', 'group')
      .leftJoinAndSelect('slot.discipline', 'discipline')
      .leftJoinAndSelect('slot.classroom', 'classroom')
      .innerJoinAndSelect('slot.version', 'version', 'version.status = :status', { status: 'published' })
      .where('slot.teacher_id = :teacherId', { teacherId: teacher.id });

    if (period) qb.andWhere('version.period = :period', { period });
    if (academicYear) qb.andWhere('version.academic_year = :academicYear', { academicYear });
    // fallback: if nothing found with filters, caller should retry without period

    const slots = await qb.getMany();
    return { data: slots };
  }

  async getExamPlanInfo(disciplineId: string, groupId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: ['program'] });
    if (!group?.program) return { data: { type: null, semester: null } };

    const ci = await this.ciRepo.findOne({
      where: { discipline: { id: disciplineId }, plan: { program: { id: group.program.id } } },
      relations: ['plan'],
    });
    if (!ci) return { data: { type: null, semester: null } };

    return { data: { type: ci.has_exam ? 'exam' : 'credit', semester: ci.plan.semester } };
  }

  async requestExam(userId: string, dto: any) {
    const teacher = await this.getTeacherByUserId(userId);
    if (!teacher) return { error: 'Teacher profile not found' };
    const exam = this.examRepo.create({
      exam_date: new Date(dto.exam_date),
      type: dto.type,
      semester: dto.semester,
      classroom_text: dto.classroom_text,
      status: ExamStatus.PENDING,
      discipline: { id: dto.discipline_id },
      group: { id: dto.group_id },
      teacher: { id: teacher.id },
    });
    return { data: await this.examRepo.save(exam) };
  }

  async getJournal(groupId: string, disciplineId: string) {
    const entries = await this.gradeBookRepo.find({ where: { group_id: groupId, discipline_id: disciplineId } });
    return { data: entries };
  }

  async upsertJournalEntry(dto: { student_id: string; discipline_id: string; group_id: string; lesson_date: string | null; value: string }) {
    const existing = await this.gradeBookRepo.findOne({
      where: { student_id: dto.student_id, discipline_id: dto.discipline_id, group_id: dto.group_id, lesson_date: dto.lesson_date === null ? IsNull() : dto.lesson_date },
    });
    if (existing) {
      await this.gradeBookRepo.update(existing.id, { value: dto.value });
      return { data: { ...existing, value: dto.value } };
    }
    const entry = this.gradeBookRepo.create(dto);
    return { data: await this.gradeBookRepo.save(entry) };
  }

  async saveJournal(groupId: string, disciplineId: string, entries: { student_id: string; lesson_date: string | null; value: string }[]) {
    await this.gradeBookRepo.delete({ group_id: groupId, discipline_id: disciplineId });
    if (entries.length > 0) {
      const rows = entries.map(e => this.gradeBookRepo.create({
        student_id: e.student_id,
        discipline_id: disciplineId,
        group_id: groupId,
        lesson_date: e.lesson_date,
        value: e.value,
      }));
      await this.gradeBookRepo.save(rows);

      // Sync final scores (lesson_date = null) to grades table for transcript
      const finalEntries = entries.filter(e => e.lesson_date === null && e.value !== '' && !isNaN(Number(e.value)));
      for (const e of finalEntries) {
        const score = Number(e.value);
        const existing = await this.gradeRepo
          .createQueryBuilder('g')
          .where('g.studentId = :sid', { sid: e.student_id })
          .andWhere('g.disciplineId = :did', { did: disciplineId })
          .andWhere('g.grade_type = :type', { type: GradeType.MANUAL })
          .getOne();
        if (existing) {
          await this.gradeRepo.update(existing.id, { grade_value: score });
        } else {
          const grade = this.gradeRepo.create({
            grade_value: score,
            grade_type: GradeType.MANUAL,
            student: { id: e.student_id },
            discipline: { id: disciplineId },
            slot: null,
          });
          await this.gradeRepo.save(grade);
        }
      }
    }
    return { data: { saved: entries.length } };
  }

  async deleteMyExam(userId: string, examId: string) {
    const teacher = await this.getTeacherByUserId(userId);
    if (!teacher) return { error: 'Teacher not found' };
    const exam = await this.examRepo.findOne({ where: { id: examId, teacher: { id: teacher.id } } });
    if (!exam) return { error: 'Exam not found or access denied' };
    await this.examRepo.delete(examId);
    return { success: true };
  }

  async getMyExams(userId: string) {
    const teacher = await this.getTeacherByUserId(userId);
    if (!teacher) return { data: [] };
    return {
      data: await this.examRepo.find({
        where: { teacher: { id: teacher.id } },
        relations: ['discipline', 'group'],
        order: { exam_date: 'ASC' },
      }),
    };
  }
}

@Controller('teacher')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('teacher')
export class TeacherCabinetController {
  constructor(private readonly service: TeacherCabinetService) {}

  @Get('my-disciplines')
  getMyDisciplines(@Request() req: any) { return this.service.getMyDisciplines(req.user.id); }

  @Get('my-groups')
  getMyGroups(@Request() req: any) { return this.service.getMyGroups(req.user.id); }

  @Get('my-groups/:groupId/students')
  getGroupStudents(@Param('groupId') groupId: string) { return this.service.getGroupStudents(groupId); }

  @Get('my-schedule')
  getMySchedule(
    @Request() req: any,
    @Query('period') period?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.service.getMySchedule(req.user.id, period, academicYear);
  }

  @Get('exam-plan-info')
  getExamPlanInfo(
    @Query('disciplineId') disciplineId: string,
    @Query('groupId') groupId: string,
  ) {
    return this.service.getExamPlanInfo(disciplineId, groupId);
  }

  @Post('my-exams/request')
  requestExam(@Request() req: any, @Body() dto: any) { return this.service.requestExam(req.user.id, dto); }

  @Delete('my-exams/:id')
  deleteMyExam(@Request() req: any, @Param('id') id: string) { return this.service.deleteMyExam(req.user.id, id); }

  @Get('my-exams')
  getMyExams(@Request() req: any) { return this.service.getMyExams(req.user.id); }

  @Get('journal')
  getJournal(@Query('groupId') groupId: string, @Query('disciplineId') disciplineId: string) {
    return this.service.getJournal(groupId, disciplineId);
  }

  @Post('journal/upsert')
  upsertJournalEntry(@Body() dto: any) { return this.service.upsertJournalEntry(dto); }

  @Post('journal/save')
  saveJournal(@Body() body: { groupId: string; disciplineId: string; entries: any[] }) {
    return this.service.saveJournal(body.groupId, body.disciplineId, body.entries);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Teacher, CurriculumItem, ScheduleSlot, Student, Group, Exam, GradeBookEntry, Grade, Discipline])],
  controllers: [TeacherCabinetController],
  providers: [TeacherCabinetService],
})
export class TeacherCabinetModule {}
