import { Module, Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discipline, DisciplineType } from '../entities/discipline.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';

export class CreateDisciplineDto {
  @IsString() name: string;
  @IsString() @IsOptional() short_name?: string;
  @IsEnum(DisciplineType) type: DisciplineType;
  @IsUUID() @IsOptional() departmentId?: string;
}

@Injectable()
export class DisciplinesService {
  constructor(@InjectRepository(Discipline) private repo: Repository<Discipline>) {}
  async findAll(departmentId?: string, type?: string) {
    const where: any = {};
    if (departmentId) where.department = { id: departmentId };
    if (type) where.type = type;
    const [data, total] = await this.repo.findAndCount({ where, relations: ['department'] });
    return { data, total };
  }
  async create(dto: CreateDisciplineDto) {
    const { departmentId, ...rest } = dto;
    const discipline = this.repo.create({ 
      ...rest, 
      department: (departmentId && departmentId !== 'undefined') ? { id: departmentId } : undefined
    });
    return this.repo.save(discipline);
  }
  async delete(id: string) { await this.repo.delete(id); return { success: true }; }
}

@Controller('disciplines')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DisciplinesController {
  constructor(private readonly service: DisciplinesService) {}
  @Get() findAll(@Query('departmentId') departmentId?: string, @Query('type') type?: string) { return this.service.findAll(departmentId, type); }
  @Roles('admin') @Post() create(@Body() dto: CreateDisciplineDto) { return this.service.create(dto); }
  @Roles('admin') @Delete(':id') delete(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({ imports: [TypeOrmModule.forFeature([Discipline])], controllers: [DisciplinesController], providers: [DisciplinesService] })
export class DisciplinesModule {}
