import {
  Module, Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Injectable, NotFoundException, ForbiddenException,
  ConflictException, Request,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';

import { ScheduleVersion, VersionStatus } from '../../entities/schedule-version.entity';
import { ScheduleSlot, WeekType } from '../../entities/schedule-slot.entity';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Injectable()
export class ScheduleVersionsService {
  constructor(
    @InjectRepository(ScheduleVersion) private versionRepo: Repository<ScheduleVersion>,
    @InjectRepository(ScheduleSlot) private slotRepo: Repository<ScheduleSlot>,
  ) {}

  async findAll(semester: number, academicYear: string, programId?: string) {
    const where: any = {};
    if (semester) where.semester = Number(semester);
    if (academicYear) where.academic_year = academicYear;
    if (programId) where.program = { id: programId };
    return this.versionRepo.find({
      where,
      relations: ['program', 'generated_by'],
      order: { generated_at: 'DESC' },
    });
  }

  async getSlots(versionId: string, groupId?: string, teacherId?: string) {
    const where: any = { version: { id: versionId } };
    if (groupId) where.group = { id: groupId };
    if (teacherId) where.teacher = { id: teacherId };
    return this.slotRepo.find({
      where,
      relations: ['group', 'discipline', 'teacher', 'classroom', 'stream'],
    });
  }

  // Check if two week_types conflict
  private weekTypesConflict(a: string, b: string): boolean {
    if (a === WeekType.ODD && b === WeekType.EVEN) return false;
    if (a === WeekType.EVEN && b === WeekType.ODD) return false;
    return true;
  }

  async checkConflicts(
    slotId: string, versionId: string,
    newDay: number, newPeriod: number,
    newWeekType: string,
    newTeacherId: string, newClassroomId: string, newGroupId: string,
  ) {
    const slotsInSameTime = await this.slotRepo.find({
      where: {
        version: { id: versionId },
        day_of_week: newDay,
        period_number: newPeriod,
        id: Not(slotId),
      },
      relations: ['teacher', 'classroom', 'group', 'discipline'],
    });

    const conflicts: any[] = [];
    for (const slot of slotsInSameTime) {
      if (!this.weekTypesConflict(slot.week_type, newWeekType)) continue;
      if (slot.teacher?.id === newTeacherId) {
        conflicts.push({
          type: 'teacher',
          message: `Преподаватель уже ведёт ${slot.discipline?.name} у группы ${slot.group?.name}`,
        });
      }
      if (slot.classroom?.id === newClassroomId) {
        conflicts.push({
          type: 'classroom',
          message: `Аудитория занята группой ${slot.group?.name}`,
        });
      }
      if (slot.group?.id === newGroupId) {
        conflicts.push({
          type: 'group',
          message: `Группа уже на паре ${slot.discipline?.name}`,
        });
      }
    }
    return conflicts;
  }

  async getSlotById(slotId: string, versionId: string) {
    const slot = await this.slotRepo.findOne({
      where: { id: slotId, version: { id: versionId } },
      relations: ['teacher', 'classroom', 'group'],
    });
    if (!slot) throw new NotFoundException('Slot not found');
    return slot;
  }

  async updateSlot(versionId: string, slotId: string, dto: any) {
    const slot = await this.slotRepo.findOne({
      where: { id: slotId, version: { id: versionId } },
      relations: ['teacher', 'classroom', 'group'],
    });
    if (!slot) throw new NotFoundException('Slot not found');

    const newDay = dto.day_of_week ?? slot.day_of_week;
    const newPeriod = dto.period ?? slot.period_number;
    const newWeekType = dto.week_type ?? slot.week_type;
    const newTeacherId = dto.teacher_id ?? slot.teacher?.id;
    const newClassroomId = dto.classroom_id ?? slot.classroom?.id;
    const newGroupId = dto.group_id ?? slot.group?.id;

    const conflicts = await this.checkConflicts(
      slotId, versionId, newDay, newPeriod, newWeekType,
      newTeacherId, newClassroomId, newGroupId,
    );

    if (conflicts.length > 0 && !dto.force) {
      throw new ConflictException({ conflicts });
    }

    await this.slotRepo.update(slotId, {
      day_of_week: newDay,
      period_number: newPeriod,
      week_type: newWeekType,
      ...(dto.classroom_id ? { classroom: { id: dto.classroom_id } } : {}),
      is_manual_override: true,
      override_reason: dto.override_reason ?? null,
    });

    return this.slotRepo.findOne({
      where: { id: slotId },
      relations: ['group', 'discipline', 'teacher', 'classroom'],
    });
  }

  async publish(versionId: string, publishedByUser: any) {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Version not found');
    if (version.status === VersionStatus.PUBLISHED)
      throw new ForbiddenException('Already published');

    // Demote all other published versions for same year + period
    await this.versionRepo
      .createQueryBuilder()
      .update(ScheduleVersion)
      .set({ status: VersionStatus.DRAFT })
      .where('academic_year = :yr AND period = :period AND id != :id', {
        yr: version.academic_year,
        period: version.period,
        id: versionId,
      })
      .execute();

    version.status = VersionStatus.PUBLISHED;
    version.published_at = new Date();
    version.published_by = publishedByUser;
    await this.versionRepo.save(version);
    return version;
  }

  async remove(versionId: string) {
    const version = await this.versionRepo.findOne({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Version not found');
    await this.slotRepo.delete({ version: { id: versionId } });
    await this.versionRepo.remove(version);
    return { success: true };
  }
}

@Controller('schedule-versions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class ScheduleVersionsController {
  constructor(private readonly service: ScheduleVersionsService) {}

  @Get()
  findAll(
    @Query('semester') semester: number,
    @Query('academicYear') academicYear: string,
    @Query('programId') programId: string,
  ) {
    return this.service.findAll(semester, academicYear, programId);
  }

  @Get(':versionId/check-conflict')
  async checkConflict(
    @Param('versionId') versionId: string,
    @Query('slotId') slotId: string,
    @Query('newDay') newDay: string,
    @Query('newPeriod') newPeriod: string,
  ) {
    const slot = await this.service.getSlotById(slotId, versionId);
    const conflicts = await this.service.checkConflicts(
      slotId, versionId,
      Number(newDay), Number(newPeriod),
      slot.week_type,
      slot.teacher?.id, slot.classroom?.id, slot.group?.id,
    );
    return { conflicts };
  }

  @Get(':versionId/slots')
  getSlots(
    @Param('versionId') versionId: string,
    @Query('groupId') groupId: string,
    @Query('teacherId') teacherId: string,
  ) {
    return this.service.getSlots(versionId, groupId, teacherId);
  }

  @Put(':versionId/slots/:slotId')
  @RequirePermission('schedule.edit')
  updateSlot(
    @Param('versionId') versionId: string,
    @Param('slotId') slotId: string,
    @Body() dto: any,
  ) {
    return this.service.updateSlot(versionId, slotId, dto);
  }

  @Post(':versionId/publish')
  @RequirePermission('schedule.publish')
  publish(@Param('versionId') versionId: string, @Request() req: any) {
    return this.service.publish(versionId, req.user);
  }

  @Delete(':versionId')
  remove(@Param('versionId') versionId: string) {
    return this.service.remove(versionId);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleVersion, ScheduleSlot])],
  controllers: [ScheduleVersionsController],
  providers: [ScheduleVersionsService],
  exports: [ScheduleVersionsService],
})
export class ScheduleVersionsModule {}
