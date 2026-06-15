import {
  Module, Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Injectable, NotFoundException,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';

import { Stream } from '../../entities/stream.entity';
import { StreamGroup } from '../../entities/stream-group.entity';
import { Discipline } from '../../entities/discipline.entity';
import { Teacher } from '../../entities/teacher.entity';
import { Group } from '../../entities/group.entity';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Injectable()
export class StreamsService {
  constructor(
    @InjectRepository(Stream) private streamRepo: Repository<Stream>,
    @InjectRepository(StreamGroup) private sgRepo: Repository<StreamGroup>,
    @InjectRepository(Discipline) private discRepo: Repository<Discipline>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    private dataSource: DataSource,
  ) {}

  async findAll(semester?: number, academicYear?: string, programId?: string) {
    const streams = await this.streamRepo.find({
      where: {
        ...(semester ? { semester } : {}),
        ...(academicYear ? { academic_year: academicYear } : {}),
      },
      relations: ['discipline', 'teacher'],
    });

    const result: any[] = [];
    for (const stream of streams) {
      const sgs = await this.sgRepo.find({
        where: { stream: { id: stream.id } },
        relations: ['group', 'group.program'],
      });
      // filter by programId if requested
      const groups = sgs.map(sg => sg.group);
      if (programId && !groups.some(g => g.program?.id === programId)) continue;
      result.push({ ...stream, groups });
    }
    return result;
  }

  async create(dto: any) {
    return this.dataSource.transaction(async manager => {
      const discipline = await manager.findOne(Discipline, { where: { id: dto.discipline_id } });
      const teacher = await manager.findOne(Teacher, { where: { id: dto.teacher_id } });
      if (!discipline || !teacher) throw new NotFoundException('Discipline or Teacher not found');

      const stream = manager.create(Stream, {
        name: dto.name,
        semester: dto.semester,
        academic_year: dto.academic_year,
        discipline,
        teacher,
      });
      const saved = await manager.save(stream);

      for (const gId of (dto.group_ids || [])) {
        const group = await manager.findOne(Group, { where: { id: gId } });
        if (group) {
          await manager.save(manager.create(StreamGroup, { stream: saved, group }));
        }
      }

      return saved;
    });
  }

  async update(id: string, dto: any) {
    const stream = await this.streamRepo.findOne({ where: { id } });
    if (!stream) throw new NotFoundException('Stream not found');

    return this.dataSource.transaction(async manager => {
      if (dto.name) stream.name = dto.name;
      const saved = await manager.save(stream);

      if (dto.group_ids) {
        await manager.delete(StreamGroup, { stream: { id } });
        for (const gId of dto.group_ids) {
          const group = await manager.findOne(Group, { where: { id: gId } });
          if (group) {
            await manager.save(manager.create(StreamGroup, { stream: saved, group }));
          }
        }
      }

      return saved;
    });
  }

  async remove(id: string) {
    const stream = await this.streamRepo.findOne({ where: { id } });
    if (!stream) throw new NotFoundException('Stream not found');
    await this.sgRepo.delete({ stream: { id } });
    await this.streamRepo.remove(stream);
    return { success: true };
  }
}

@Controller('streams')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class StreamsController {
  constructor(private readonly service: StreamsService) {}

  @Get()
  @RequirePermission('schedule.input')
  findAll(
    @Query('semester') semester: number,
    @Query('academicYear') academicYear: string,
    @Query('programId') programId: string,
  ) {
    return this.service.findAll(semester ? Number(semester) : undefined, academicYear, programId);
  }

  @Post()
  @RequirePermission('schedule.input')
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermission('schedule.input')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('schedule.input')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Stream, StreamGroup, Discipline, Teacher, Group])],
  controllers: [StreamsController],
  providers: [StreamsService],
  exports: [StreamsService],
})
export class StreamsModule {}
