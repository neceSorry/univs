import { Module, Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../entities/department.entity';
import { Institute } from '../entities/institute.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() name: string;
  @IsString() @IsOptional() short_name?: string;
  @IsUUID() instituteId: string;
}

export class UpdateDepartmentDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() short_name?: string;
  @IsUUID() @IsOptional() instituteId?: string;
}

@Injectable()
export class DepartmentsService {
  constructor(@InjectRepository(Department) private repo: Repository<Department>) {}
  async findAll(instituteId?: string) {
    const where = instituteId ? { institute: { id: instituteId } } : {};
    const [data, total] = await this.repo.findAndCount({ where, relations: ['institute'] });
    return { data, total };
  }
  async create(dto: CreateDepartmentDto) {
    const dept = this.repo.create({ name: dto.name, short_name: dto.short_name, institute: { id: dto.instituteId } });
    return this.repo.save(dept);
  }
  async update(id: string, dto: UpdateDepartmentDto) {
    const department = await this.repo.findOne({ where: { id } });
    if (!department) throw new Error('Кафедра не найдена');

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.short_name) updateData.short_name = dto.short_name;
    
    if (dto.instituteId) {
      updateData.institute = { id: dto.instituteId };
    }

    await this.repo.save({ ...department, ...updateData });
    return this.repo.findOne({ where: { id }, relations: ['institute'] });
  }
  async delete(id: string) { await this.repo.delete(id); return { success: true }; }
}

@Controller('departments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}
  @Get()
  findAll(@Query('instituteId') instituteId?: string) { return this.service.findAll(instituteId); }
  @Roles('admin') @Post()
  create(@Body() dto: CreateDepartmentDto) { return this.service.create(dto); }
  @Roles('admin') @Post(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) { return this.service.update(id, dto); }
  @Roles('admin') @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Department, Institute])],
  controllers: [DepartmentsController], providers: [DepartmentsService],
})
export class DepartmentsModule {}
