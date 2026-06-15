import { Module, Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student, Gender, EnrollmentType } from '../entities/student.entity';
import { User, UserRole } from '../entities/user.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsUUID, IsEnum, IsEmail, MinLength, IsOptional } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { CurriculumPlan } from '../entities/curriculum-plan.entity';
import { CurriculumItem } from '../entities/curriculum-item.entity';
import { Grade, GradeType } from '../entities/grade.entity';
import { Discipline } from '../entities/discipline.entity';

export class CreateStudentDto {
  @IsString() first_name: string;
  @IsString() last_name: string;
  @IsString() @IsOptional() middle_name?: string;
  @IsString() username: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @MinLength(6) password: string;
  @IsString() @IsOptional() phone?: string;
  @IsUUID() groupId: string;
  @IsEnum(EnrollmentType) enrollment_type: EnrollmentType;
  @IsEnum(Gender) gender: Gender;
}

export class UpdateStudentDto {
  @IsString() @IsOptional() first_name?: string;
  @IsString() @IsOptional() last_name?: string;
  @IsString() @IsOptional() middle_name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsUUID() @IsOptional() groupId?: string;
  @IsEnum(EnrollmentType) @IsOptional() enrollment_type?: EnrollmentType;
  @IsEnum(Gender) @IsOptional() gender?: Gender;
}

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(CurriculumPlan) private curriculumPlanRepo: Repository<CurriculumPlan>,
    @InjectRepository(CurriculumItem) private curriculumItemRepo: Repository<CurriculumItem>,
    @InjectRepository(Grade) private gradeRepo: Repository<Grade>,
  ) {}
  
  async findAll(groupId?: string) {
    const where = groupId ? { group: { id: groupId } } : {};
    const [data, total] = await this.studentRepo.findAndCount({ 
      where, 
      relations: ['group', 'group.program', 'group.program.department', 'group.program.department.institute', 'user'] 
    });
    return { data, total };
  }

  async create(dto: CreateStudentDto) {
    const existingByUsername = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existingByUsername) throw new Error('Пользователь с таким логином уже существует');

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(dto.password, salt);

    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email ?? `${dto.username}@university.local`,
      password_hash,
      role: UserRole.STUDENT,
    });
    await this.userRepo.save(user);

    const student = this.studentRepo.create({
      first_name: dto.first_name,
      last_name: dto.last_name,
      middle_name: dto.middle_name,
      gender: dto.gender,
      enrollment_type: dto.enrollment_type,
      phone: dto.phone,
      group: { id: dto.groupId },
      user: user,
    });
    return this.studentRepo.save(student);
  }

  async update(id: string, dto: UpdateStudentDto) {
    const student = await this.studentRepo.findOne({ where: { id }, relations: ['user'] });
    if (!student) throw new Error('Студент не найден');

    const updateData: any = {};
    if (dto.first_name) updateData.first_name = dto.first_name;
    if (dto.last_name) updateData.last_name = dto.last_name;
    if (dto.middle_name !== undefined) updateData.middle_name = dto.middle_name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.gender) updateData.gender = dto.gender;
    if (dto.enrollment_type) updateData.enrollment_type = dto.enrollment_type;
    
    if (dto.groupId) {
      updateData.group = { id: dto.groupId };
    }

    // Если email изменился (хотя в DTO его сейчас нет, добавим для будущего)
    // if (dto.email && student.user) { ... }

    await this.studentRepo.save({ ...student, ...updateData });
    return this.studentRepo.findOne({ 
      where: { id }, 
      relations: ['group', 'group.program', 'group.program.department', 'group.program.department.institute', 'user'] 
    });
  }

  async delete(id: string) {
    const student = await this.studentRepo.findOne({ where: { id }, relations: ['user'] });
    if (student) {
      const userId = student.user.id;
      await this.studentRepo.delete(id);
      await this.userRepo.delete(userId);
    }
    return { success: true };
  }

  async setGrade(studentId: string, disciplineId: string, score: number, gradedAt?: string) {
    const existing = await this.gradeRepo.findOne({
      where: { student: { id: studentId }, discipline: { id: disciplineId }, grade_type: GradeType.MANUAL },
    });
    const update: any = { grade_value: score };
    if (gradedAt) update.graded_at = new Date(gradedAt);
    if (existing) {
      await this.gradeRepo.update(existing.id, update);
      return this.gradeRepo.findOne({ where: { id: existing.id } });
    }
    const grade = this.gradeRepo.create({
      ...update,
      grade_type: GradeType.MANUAL,
      student: { id: studentId },
      discipline: { id: disciplineId },
      slot: null,
    });
    return this.gradeRepo.save(grade);
  }

  async getTranscript(studentId: string) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: ['group', 'group.program'],
    });
    if (!student || !student.group?.program) return { data: [] };

    const programId = student.group.program.id;

    const plans = await this.curriculumPlanRepo.find({
      where: { program: { id: programId } },
      order: { academic_year: 'ASC', semester: 'ASC' },
    });

    const items = await this.curriculumItemRepo.find({
      where: { plan: plans.map((p) => ({ id: p.id })) as any },
      relations: ['plan', 'discipline'],
    });

    const grades = await this.gradeRepo.find({
      where: { student: { id: studentId } },
      relations: ['slot', 'slot.discipline', 'discipline'],
    });

    const gradesByDiscipline = new Map<string, Grade[]>();
    for (const g of grades) {
      const discId = g.discipline?.id ?? g.slot?.discipline?.id;
      if (!discId) continue;
      if (!gradesByDiscipline.has(discId)) gradesByDiscipline.set(discId, []);
      gradesByDiscipline.get(discId)!.push(g);
    }

    const semesterMap = new Map<string, { academic_year: string; semester: number; items: any[] }>();
    for (const plan of plans) {
      const key = `${plan.academic_year}_${plan.semester}`;
      if (!semesterMap.has(key)) {
        semesterMap.set(key, { academic_year: plan.academic_year, semester: plan.semester, items: [] });
      }
    }

    for (const item of items) {
      const key = `${item.plan.academic_year}_${item.plan.semester}`;
      const bucket = semesterMap.get(key);
      if (!bucket) continue;

      const discId = item.discipline?.id;
      const discGrades = discId ? (gradesByDiscipline.get(discId) ?? []) : [];
      const totalScore = discGrades.reduce((sum, g) => sum + Number(g.grade_value), 0) || null;
      const latestGrade = discGrades.sort((a, b) => new Date(b.graded_at).getTime() - new Date(a.graded_at).getTime())[0];

      let gradeLabel: string | null = null;
      if (totalScore !== null) {
        if (totalScore >= 87) gradeLabel = 'отл';
        else if (totalScore >= 74) gradeLabel = 'хор';
        else if (totalScore >= 63) gradeLabel = 'удов';
        else gradeLabel = 'неуд';
      }

      bucket.items.push({
        id: item.id,
        discipline: item.discipline?.name ?? '',
        disciplineId: item.discipline?.id ?? null,
        credits: item.credits,
        hours: item.hours_lecture + item.hours_practice + item.hours_lab,
        control_form: item.has_exam ? 'Экзамен' : 'Курс/раб',
        score: totalScore,
        grade: gradeLabel,
        graded_at: latestGrade?.graded_at ?? null,
      });
    }

    const result = Array.from(semesterMap.values())
      .filter((s) => s.items.length > 0)
      .map((s) => ({
        ...s,
        total_credits: s.items.reduce((sum, i) => sum + (i.credits || 0), 0),
      }));

    return { data: result, student: { name: `${student.last_name} ${student.first_name} ${student.middle_name ?? ''}`.trim(), group: student.group?.name } };
  }
}

@Controller('students')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StudentsController {
  constructor(private readonly service: StudentsService) {}
  @Get() findAll(@Query('groupId') groupId?: string) { return this.service.findAll(groupId); }
  @Roles('admin') @Get(':id/transcript') getTranscript(@Param('id') id: string) { return this.service.getTranscript(id); }
  @Roles('admin') @Put(':id/set-grade') setGrade(@Param('id') id: string, @Body() dto: { disciplineId: string; score: number; graded_at?: string }) { return this.service.setGrade(id, dto.disciplineId, dto.score, dto.graded_at); }
  @Roles('admin') @Post() create(@Body() dto: CreateStudentDto) { return this.service.create(dto); }
  @Roles('admin') @Post(':id') update(@Param('id') id: string, @Body() dto: UpdateStudentDto) { return this.service.update(id, dto); }
  @Roles('admin') @Delete(':id') delete(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({ imports: [TypeOrmModule.forFeature([Student, User, CurriculumPlan, CurriculumItem, Grade, Discipline])], controllers: [StudentsController], providers: [StudentsService] })
export class StudentsModule {}
