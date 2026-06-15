import {
  Module, Controller, Get, Post, Body, Param, Query, Request,
  UseGuards, Injectable, NotFoundException,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';

import { TeacherPreference } from '../../entities/teacher-preference.entity';
import { Teacher } from '../../entities/teacher.entity';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Injectable()
export class TeacherPreferencesService {
  constructor(
    @InjectRepository(TeacherPreference) private prefRepo: Repository<TeacherPreference>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
  ) {}

  async findAll(semester: number, academicYear: string) {
    return this.prefRepo.find({
      where: { semester, academic_year: academicYear },
      relations: ['teacher', 'teacher.department'],
    });
  }

  async upsert(dto: any) {
    const teacher = await this.teacherRepo.findOne({ where: { id: dto.teacher_id } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    let pref = await this.prefRepo.findOne({
      where: {
        teacher: { id: dto.teacher_id },
        semester: dto.semester,
        academic_year: dto.academic_year,
      },
    });

    if (pref) {
      Object.assign(pref, {
        unavailable_days: dto.unavailable_days ?? pref.unavailable_days,
        preferred_periods: dto.preferred_periods ?? pref.preferred_periods,
        max_periods_per_day: dto.max_periods_per_day ?? pref.max_periods_per_day,
        work_rate: dto.work_rate ?? pref.work_rate,
        notes: dto.notes ?? pref.notes,
      });
    } else {
      pref = this.prefRepo.create({
        teacher,
        semester: dto.semester,
        academic_year: dto.academic_year,
        unavailable_days: dto.unavailable_days ?? [],
        preferred_periods: dto.preferred_periods ?? [],
        max_periods_per_day: dto.max_periods_per_day ?? 4,
        work_rate: dto.work_rate ?? 1.0,
        notes: dto.notes ?? null,
      });
    }

    return this.prefRepo.save(pref);
  }

  async findForTeacher(teacherId: string, semester: number, academicYear: string) {
    return this.prefRepo.findOne({
      where: {
        teacher: { id: teacherId },
        semester,
        academic_year: academicYear,
      },
      relations: ['teacher'],
    });
  }

  async findMyPreferences(userId: string, semester: number, academicYear: string) {
    const teacher = await this.teacherRepo.findOne({ where: { user: { id: userId } } });
    if (!teacher) return null;
    return this.prefRepo.findOne({
      where: { teacher: { id: teacher.id }, semester, academic_year: academicYear },
      relations: ['teacher'],
    });
  }

  async upsertMyPreferences(userId: string, dto: any) {
    const teacher = await this.teacherRepo.findOne({ where: { user: { id: userId } } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return this.upsert({ ...dto, teacher_id: teacher.id });
  }

  async getReadiness(semester: number, academicYear: string) {
    const allTeachers = await this.teacherRepo.find({ relations: ['department'] });
    const filled = await this.prefRepo.find({
      where: { semester, academic_year: academicYear },
      relations: ['teacher'],
    });
    const filledIds = new Set(filled.map(p => p.teacher.id));
    const missing = allTeachers
      .filter(t => !filledIds.has(t.id))
      .map(t => ({
        teacher_id: t.id,
        name: `${t.first_name} ${t.last_name}`,
        department: t.department?.name,
      }));

    return {
      total_teachers: allTeachers.length,
      filled: filledIds.size,
      missing,
    };
  }
}

@Controller('teacher-preferences')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('teacher')
export class TeacherPreferencesSelfController {
  constructor(private readonly service: TeacherPreferencesService) {}

  @Get('my')
  findMy(
    @Request() req: any,
    @Query('semester') semester: string,
    @Query('academicYear') academicYear: string,
  ) {
    return this.service.findMyPreferences(req.user.id, Number(semester), academicYear);
  }

  @Post('my')
  upsertMy(@Request() req: any, @Body() dto: any) {
    return this.service.upsertMyPreferences(req.user.id, dto);
  }
}

@Controller('teacher-preferences')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class TeacherPreferencesController {
  constructor(private readonly service: TeacherPreferencesService) {}

  @Get()
  @RequirePermission('schedule.input')
  findAll(
    @Query('semester') semester: number,
    @Query('academicYear') academicYear: string,
  ) {
    return this.service.findAll(Number(semester), academicYear);
  }

  @Post()
  @RequirePermission('schedule.input')
  upsert(@Body() dto: any) {
    return this.service.upsert(dto);
  }

  @Get('readiness')
  @RequirePermission('schedule.input')
  getReadiness(
    @Query('semester') semester: number,
    @Query('academicYear') academicYear: string,
  ) {
    return this.service.getReadiness(Number(semester), academicYear);
  }

  @Get(':teacherId')
  @RequirePermission('schedule.input')
  findForTeacher(
    @Param('teacherId') teacherId: string,
    @Query('semester') semester: number,
    @Query('academicYear') academicYear: string,
  ) {
    return this.service.findForTeacher(teacherId, Number(semester), academicYear);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([TeacherPreference, Teacher])],
  controllers: [TeacherPreferencesSelfController, TeacherPreferencesController],
  providers: [TeacherPreferencesService],
  exports: [TeacherPreferencesService],
})
export class TeacherPreferencesModule {}
