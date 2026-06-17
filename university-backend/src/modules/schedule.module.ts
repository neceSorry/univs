import {
  Module, Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Request, Injectable,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import axios from 'axios';

import { ScheduleSlot, WeekType } from '../entities/schedule-slot.entity';
import { ScheduleVersion, VersionStatus } from '../entities/schedule-version.entity';
import { CurriculumItem } from '../entities/curriculum-item.entity';
import { CurriculumPlan } from '../entities/curriculum-plan.entity';
import { TeacherPreference } from '../entities/teacher-preference.entity';
import { Stream } from '../entities/stream.entity';
import { StreamGroup } from '../entities/stream-group.entity';
import { Group } from '../entities/group.entity';
import { Program } from '../entities/program.entity';
import { Teacher } from '../entities/teacher.entity';
import { Department } from '../entities/department.entity';

import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RolesGuard } from '../auth/roles.guard';

function computeSemester(yearOfEntry: number, academicYear: string, period: 'autumn' | 'spring'): number {
  const startYear = parseInt(academicYear.split('-')[0], 10);
  const course = startYear - yearOfEntry + 1;
  if (course < 1 || course > 8) return -1;
  return period === 'autumn' ? course * 2 - 1 : course * 2;
}

const SCHEDULER_URL = process.env.SCHEDULER_URL ?? 'http://127.0.0.1:8001';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduleSlot) private slotRepo: Repository<ScheduleSlot>,
    @InjectRepository(ScheduleVersion) private versionRepo: Repository<ScheduleVersion>,
    @InjectRepository(CurriculumItem) private itemRepo: Repository<CurriculumItem>,
    @InjectRepository(CurriculumPlan) private planRepo: Repository<CurriculumPlan>,
    @InjectRepository(TeacherPreference) private prefRepo: Repository<TeacherPreference>,
    @InjectRepository(Stream) private streamRepo: Repository<Stream>,
    @InjectRepository(StreamGroup) private sgRepo: Repository<StreamGroup>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(Program) private programRepo: Repository<Program>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
  ) {}

  async getDirectionData(programId: string, academicYear: string, period: 'autumn' | 'spring') {
    const program = await this.programRepo.findOne({
      where: { id: programId },
      relations: ['department', 'department.institute'],
    });
    if (!program) return null;

    // All active groups for this program
    const allGroups = await this.groupRepo.find({
      where: { program: { id: programId }, is_active: true },
    });

    const groupsData: any[] = [];
    const allTeacherIds = new Set<string>();

    for (const group of allGroups) {
      const semester = computeSemester(group.year_of_entry, academicYear, period);
      if (semester < 1 || semester > 8) continue;
      const startYear = parseInt(academicYear.split('-')[0], 10);
      const course = startYear - group.year_of_entry + 1;
      if (course < 1 || course > (program.duration_years || 4)) continue;

      const plan = await this.planRepo.findOne({ where: { programId, semester } });
      let curriculumItems: any[] = [];
      if (plan) {
        const items = await this.itemRepo.find({
          where: { plan: { id: plan.id } },
          relations: ['discipline', 'teacher_lecture', 'teacher_practice', 'teacher_lab'],
        });
        for (const item of items) {
          if (item.teacher_lecture?.id) allTeacherIds.add(item.teacher_lecture.id);
          if (item.teacher_practice?.id) allTeacherIds.add(item.teacher_practice.id);
          if (item.teacher_lab?.id) allTeacherIds.add(item.teacher_lab.id);
        }
        curriculumItems = items;
      }
      groupsData.push({ group, semester, course, curriculumItems });
    }

    groupsData.sort((a, b) => a.course - b.course || a.group.name.localeCompare(b.group.name));

    // Load teacher preferences
    const allPrefs = allTeacherIds.size > 0
      ? await this.prefRepo.find({ where: { academic_year: academicYear }, relations: ['teacher'] })
      : [];
    const prefFilledTeacherIds = new Set(
      allPrefs
        .filter(p => groupsData.some(gd => gd.semester === Number(p.semester)))
        .map(p => p.teacher?.id)
        .filter(Boolean),
    );

    // All teachers across the university
    const teachers = await this.teacherRepo.find({ relations: ['department'] });
    const allTeachers = teachers.map(t => ({
      id: t.id,
      first_name: t.first_name,
      last_name: t.last_name,
      department_name: t.department?.name,
    }));

    // Build response with per-type readiness
    let totalLecture = 0, totalPractice = 0, totalLab = 0;
    let assignedLecture = 0, assignedPractice = 0, assignedLab = 0;
    const uniqueAssignedTeachers = new Set<string>();
    let preferencesFilled = 0;

    const groups = groupsData.map(({ group, semester, course, curriculumItems }) => {
      const items = curriculumItems.map((item: any) => {
        const tLec = item.teacher_lecture ? { id: item.teacher_lecture.id, first_name: item.teacher_lecture.first_name, last_name: item.teacher_lecture.last_name } : null;
        const tPra = item.teacher_practice ? { id: item.teacher_practice.id, first_name: item.teacher_practice.first_name, last_name: item.teacher_practice.last_name } : null;
        const tLab = item.teacher_lab ? { id: item.teacher_lab.id, first_name: item.teacher_lab.first_name, last_name: item.teacher_lab.last_name } : null;

        if (item.hours_lecture > 0) { totalLecture++; if (tLec) { assignedLecture++; uniqueAssignedTeachers.add(tLec.id); } }
        if (item.hours_practice > 0) { totalPractice++; if (tPra) { assignedPractice++; uniqueAssignedTeachers.add(tPra.id); } }
        if (item.hours_lab > 0) { totalLab++; if (tLab) { assignedLab++; uniqueAssignedTeachers.add(tLab.id); } }

        return {
          id: item.id,
          discipline: {
            id: item.discipline?.id,
            name: item.discipline?.name,
            hours_lecture: item.hours_lecture,
            hours_practice: item.hours_practice,
            hours_lab: item.hours_lab,
          },
          teacher_lecture: tLec,
          teacher_practice: tPra,
          teacher_lab: tLab,
          classroom_lecture: item.classroom_lecture,
          classroom_practice: item.classroom_practice,
          classroom_lab: item.classroom_lab,
          preference_lecture_filled: !!tLec && prefFilledTeacherIds.has(tLec.id),
          preference_practice_filled: !!tPra && prefFilledTeacherIds.has(tPra.id),
          preference_lab_filled: !!tLab && prefFilledTeacherIds.has(tLab.id),
        };
      });

      return { id: group.id, name: group.name, course, semester, year_of_entry: group.year_of_entry, curriculum_items: items };
    });

    // Count preferences filled for unique assigned teachers
    for (const tid of uniqueAssignedTeachers) {
      if (prefFilledTeacherIds.has(tid)) preferencesFilled++;
    }

    return {
      program: { id: program.id, name: program.name },
      period,
      academic_year: academicYear,
      groups,
      all_teachers: allTeachers,
      readiness: {
        total_lecture_slots: totalLecture,
        total_practice_slots: totalPractice,
        total_lab_slots: totalLab,
        assigned_lectures: assignedLecture,
        assigned_practices: assignedPractice,
        assigned_labs: assignedLab,
        preferences_filled: preferencesFilled,
        preferences_total: uniqueAssignedTeachers.size,
      },
    };
  }

  async generate(dto: any, requestingUser: any) {
    const { period, academic_year, version_name, weights } = dto;

    // University-wide: load ALL active groups across ALL programs
    const allGroups = await this.groupRepo.find({
      where: { is_active: true },
      relations: ['program'],
    });

    const ciPayload: any[] = [];
    const semesterSet = new Set<number>();
    const groupSemesterMap = new Map<string, number>();

    // Lectures: merge groups with the same teacher into a single stream so the
    // teacher is not scheduled N×groups times for the same lesson.
    // key = `${curriculumItemId}__${teacherLectureId}`
    const lectureMap = new Map<string, { ci: any; groupIds: string[] }>();
    const practiceLabItems: any[] = [];

    for (const group of allGroups) {
      if (!group.program) continue;
      const semester = computeSemester(group.year_of_entry, academic_year, period as 'autumn' | 'spring');
      if (semester < 1 || semester > 8) continue;
      semesterSet.add(semester);
      groupSemesterMap.set(group.id, semester);

      const plan = await this.planRepo.findOne({
        where: { program: { id: group.program.id }, semester },
      });
      if (!plan) continue;

      const items = await this.itemRepo.find({
        where: { plan: { id: plan.id } },
        relations: ['discipline', 'teacher_lecture', 'teacher_practice', 'teacher_lab'],
      });

      for (const item of items) {
        if ((item.hours_lecture || 0) > 0) {
          const teacherId = item.teacher_lecture?.id ?? 'none';
          const key = `${item.id}__${teacherId}`;
          if (!lectureMap.has(key)) {
            lectureMap.set(key, { ci: item, groupIds: [] });
          }
          lectureMap.get(key)!.groupIds.push(group.id);
        }

        if ((item.hours_practice || 0) > 0) {
          practiceLabItems.push({
            id: `${item.id}-${group.id}-pra`,
            curriculum_item_id: item.id,
            discipline_id: item.discipline?.id,
            discipline_name: item.discipline?.name,
            teacher_lecture_id: null,
            teacher_practice_id: item.teacher_practice?.id || null,
            teacher_lab_id: null,
            preferred_classroom: item.classroom_practice || null,
            group_id: group.id,
            group_size: 25,
            hours_lecture: 0,
            hours_practice: item.hours_practice,
            hours_lab: 0,
          });
        }

        if ((item.hours_lab || 0) > 0) {
          practiceLabItems.push({
            id: `${item.id}-${group.id}-lab`,
            curriculum_item_id: item.id,
            discipline_id: item.discipline?.id,
            discipline_name: item.discipline?.name,
            teacher_lecture_id: null,
            teacher_practice_id: null,
            teacher_lab_id: item.teacher_lab?.id || null,
            preferred_classroom: item.classroom_lab || null,
            group_id: group.id,
            group_size: 25,
            hours_lecture: 0,
            hours_practice: 0,
            hours_lab: item.hours_lab,
          });
        }
      }
    }

    // Build merged lecture entries (one per unique item+teacher, shared across groups)
    for (const [, { ci, groupIds }] of lectureMap.entries()) {
      const isStream = groupIds.length > 1;
      ciPayload.push({
        id: `lec-${ci.id}-${ci.teacher_lecture?.id ?? 'none'}`,
        curriculum_item_id: ci.id,
        discipline_id: ci.discipline?.id,
        discipline_name: ci.discipline?.name,
        teacher_lecture_id: ci.teacher_lecture?.id || null,
        teacher_practice_id: null,
        teacher_lab_id: null,
        preferred_classroom: ci.classroom_lecture || null,
        group_id: groupIds[0],
        group_size: groupIds.length * 25,
        hours_lecture: ci.hours_lecture,
        hours_practice: 0,
        hours_lab: 0,
        is_stream: isStream,
        stream_group_ids: groupIds,
      });
    }

    ciPayload.push(...practiceLabItems);

    // Load streams for all relevant semesters
    for (const semester of semesterSet) {
      const streams = await this.streamRepo.find({
        where: { semester, academic_year },
        relations: ['discipline', 'teacher'],
      });
      for (const stream of streams) {
        const sgs = await this.sgRepo.find({ where: { stream: { id: stream.id } }, relations: ['group'] });
        const groupIds = sgs.map(sg => sg.group.id);
        ciPayload.push({
          id: `stream-${stream.id}`,
          curriculum_item_id: stream.id,
          discipline_id: stream.discipline?.id,
          discipline_name: stream.discipline?.name,
          discipline_type: stream.discipline?.type || 'lecture',
          teacher_lecture_id: stream.teacher?.id || null,
          teacher_practice_id: null,
          teacher_lab_id: null,
          preferred_classroom: null,
          group_id: groupIds[0],
          group_size: groupIds.length * 25,
          hours_lecture: 75,
          hours_practice: 0,
          hours_lab: 0,
          is_stream: true,
          stream_id: stream.id,
          stream_group_ids: groupIds,
        });
      }
    }

    // Load teacher preferences for all relevant semesters (deduplicated by teacher)
    const prefPayload: any[] = [];
    for (const semester of semesterSet) {
      const prefs = await this.prefRepo.find({
        where: { semester, academic_year },
        relations: ['teacher'],
      });
      for (const p of prefs) {
        if (!prefPayload.find(x => x.teacher_id === p.teacher.id)) {
          prefPayload.push({
            teacher_id: p.teacher.id,
            unavailable_days: Array.isArray(p.unavailable_days) ? p.unavailable_days.map(Number) : [],
            preferred_periods: Array.isArray(p.preferred_periods) ? p.preferred_periods.map(Number) : [],
            max_periods_per_day: p.max_periods_per_day,
            max_periods_per_week: Math.round(Number(p.work_rate) * 9),
          });
        }
      }
    }

    const defaultWeights = { teacher_window: 20, teacher_overload: 30, teacher_preferred_time: 10, teacher_rate_exceeded: 50, group_window: 80, group_overload: 25, group_single_lesson: 60, hard_conflict: 1000 };
    const payload = {
      curriculum_items: ciPayload,
      teacher_preferences: prefPayload,
      classrooms: [],
      weights: { ...defaultWeights, ...(weights || {}) },
    };

    // Send to Python scheduler
    const startRes = await axios.post(`${SCHEDULER_URL}/generate`, payload);
    const taskId = startRes.data.task_id;

    let result: any = null;
    const timeout = Date.now() + 5 * 60 * 1000;
    while (Date.now() < timeout) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await axios.get(`${SCHEDULER_URL}/status/${taskId}`);
      if (statusRes.data.status === 'done') {
        const resultRes = await axios.get(`${SCHEDULER_URL}/result/${taskId}`);
        result = resultRes.data.data;
        break;
      }
      if (statusRes.data.status?.startsWith('error')) {
        throw new Error(`Scheduler error: ${statusRes.data.status}`);
      }
    }
    if (!result) throw new Error('Scheduler timed out');

    // Create university-wide ScheduleVersion (no program)
    const versionCount = await this.versionRepo.count({
      where: { academic_year, period },
    });

    const version = this.versionRepo.create({
      name: version_name || `${academic_year} ${period === 'autumn' ? 'Осенний' : 'Весенний'} — Вариант ${versionCount + 1}`,
      academic_year,
      period,
      program: null as any,
      status: VersionStatus.DRAFT,
      quality_score: result.quality_score,
      penalty_details: result.penalty_details,
      generated_by: requestingUser,
    });
    const savedVersion = await this.versionRepo.save(version);

    // Save slots with per-group semester.
    // For auto-merged lecture streams (is_stream=true, no stream entity id) we
    // expand back to one ScheduleSlot per group so each group sees the lecture.
    for (const slot of (result.slots || [])) {
      const streamGroupIds: string[] = (slot.is_stream && !slot.stream_id && Array.isArray(slot.stream_group_ids) && slot.stream_group_ids.length > 0)
        ? slot.stream_group_ids
        : [slot.group_id];

      for (const gid of streamGroupIds) {
        const sem = groupSemesterMap.get(gid) ?? groupSemesterMap.get(slot.group_id) ?? 1;
        const s = this.slotRepo.create({
          day_of_week: slot.day_of_week,
          period_number: slot.period,
          week_type: slot.week_type as WeekType || WeekType.ALL,
          semester: sem,
          academic_year,
          group: { id: gid },
          discipline: { id: slot.discipline_id },
          teacher: slot.teacher_id ? { id: slot.teacher_id } : undefined,
          lesson_type: slot.lesson_type || 'lecture',
          classroom_text: slot.classroom || null,
          version: savedVersion,
          is_stream: slot.is_stream || false,
          stream: slot.stream_id ? { id: slot.stream_id } : undefined,
        });
        await this.slotRepo.save(s);
      }
    }

    return {
      version_id: savedVersion.id,
      quality_score: result.quality_score,
      penalty_details: result.penalty_details,
    };
  }

  async getByGroup(groupId: string, semester: number, year: string) {
    const where: any = {};
    if (groupId) where.group = { id: groupId };
    if (semester) where.semester = Number(semester);
    if (year) where.academic_year = year;
    // Return only published slots
    const publishedVersions = await this.versionRepo.find({
      where: { status: VersionStatus.PUBLISHED, semester: Number(semester), academic_year: year },
    });
    if (publishedVersions.length === 0) {
      return { data: await this.slotRepo.find({ where, relations: ['discipline', 'teacher'] }) };
    }
    const versionIds = publishedVersions.map(v => v.id);
    return {
      data: await this.slotRepo.find({
        where: versionIds.map(vid => ({ ...where, version: { id: vid } })),
        relations: ['discipline', 'teacher'],
      }),
    };
  }

  async getByTeacher(teacherId: string, semester: number) {
    return {
      data: await this.slotRepo.find({
        where: { teacher: { id: teacherId }, semester: Number(semester) },
        relations: ['group', 'discipline'],
      }),
    };
  }

  async update(id: string, dto: any) {
    await this.slotRepo.update(id, { ...dto, is_manual_override: true });
    return this.slotRepo.findOne({ where: { id } });
  }

  async deleteSemester(semester: number, year: string) {
    await this.slotRepo.delete({ semester: Number(semester), academic_year: year });
    return { success: true };
  }
}

@Controller('schedule')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Roles('admin')
  @RequirePermission('schedule.generate')
  @Post('generate')
  async generate(@Body() dto: any, @Request() req: any) {
    try {
      return await this.service.generate(dto, req.user);
    } catch (e) {
      console.error('GENERATE ERROR:', e?.message, e?.stack);
      throw e;
    }
  }

  @Get()
  getByGroup(
    @Query('groupId') groupId: string,
    @Query('semester') sem: number,
    @Query('year') year: string,
  ) {
    return this.service.getByGroup(groupId, sem, year);
  }

  @Get('teacher')
  getByTeacher(@Query('teacherId') teacherId: string, @Query('semester') sem: number) {
    return this.service.getByTeacher(teacherId, sem);
  }

  @Roles('admin')
  @Put(':slotId')
  update(@Param('slotId') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Roles('admin')
  @Get('direction-data')
  getDirectionData(
    @Query('programId') programId: string,
    @Query('academicYear') academicYear: string,
    @Query('period') period: 'autumn' | 'spring',
  ) {
    return this.service.getDirectionData(programId, academicYear, period);
  }

  @Roles('admin')
  @Delete('semester')
  deleteSemester(@Query('semester') sem: number, @Query('year') year: string) {
    return this.service.deleteSemester(sem, year);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleSlot, ScheduleVersion, CurriculumItem, CurriculumPlan,
      TeacherPreference, Stream, StreamGroup, Group, Program,
      Teacher, Department,
    ]),
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
