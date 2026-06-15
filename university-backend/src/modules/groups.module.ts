import { Module, Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../entities/group.entity';
import { Student } from '../entities/student.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsUUID, IsNumber, IsOptional } from 'class-validator';

export class CreateGroupDto {
  @IsString() name: string;
  @IsNumber() year_of_entry: number;
  @IsUUID() programId: string;
}

export class UpdateGroupDto {
  @IsString() @IsOptional() name?: string;
  @IsNumber() @IsOptional() year_of_entry?: number;
  @IsUUID() @IsOptional() programId?: string;
}

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private repo: Repository<Group>,
    @InjectRepository(Student) private studentRepo: Repository<Student>
  ) {}
  async findAll(programId?: string) {
    const where = programId ? { program: { id: programId } } : {};
    const [data, total] = await this.repo.findAndCount({ where, relations: ['program', 'program.department', 'program.department.institute'] });
    const res = await Promise.all(data.map(async (g) => {
      const studentsCount = await this.studentRepo.count({ where: { group: { id: g.id } } });
      return { ...g, studentsCount };
    }));
    return { data: res, total };
  }
  async create(dto: CreateGroupDto) {
    const group = this.repo.create({ ...dto, program: { id: dto.programId } });
    return this.repo.save(group);
  }
  async update(id: string, dto: UpdateGroupDto) {
    const group = await this.repo.findOne({ where: { id } });
    if (!group) throw new Error('Группа не найдена');

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.year_of_entry) updateData.year_of_entry = dto.year_of_entry;
    
    if (dto.programId) {
      updateData.program = { id: dto.programId };
    }

    await this.repo.save({ ...group, ...updateData });
    return this.repo.findOne({ where: { id }, relations: ['program', 'program.department', 'program.department.institute'] });
  }
  async delete(id: string) { await this.repo.delete(id); return { success: true }; }
}

@Controller('groups')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class GroupsController {
  constructor(private readonly service: GroupsService) {}
  @Get() findAll(@Query('programId') programId?: string) { return this.service.findAll(programId); }
  @Roles('admin') @Post() create(@Body() dto: CreateGroupDto) { return this.service.create(dto); }
  @Roles('admin') @Post(':id') update(@Param('id') id: string, @Body() dto: UpdateGroupDto) { return this.service.update(id, dto); }
  @Roles('admin') @Delete(':id') delete(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({ imports: [TypeOrmModule.forFeature([Group, Student])], controllers: [GroupsController], providers: [GroupsService] })
export class GroupsModule {}
