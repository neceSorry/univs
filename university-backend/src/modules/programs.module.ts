import { Module, Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program, DegreeType } from '../entities/program.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsOptional, IsUUID, IsEnum, IsNumber } from 'class-validator';

export class CreateProgramDto {
  @IsString() name: string;
  @IsString() @IsOptional() code?: string;
  @IsEnum(DegreeType) degree: DegreeType;
  @IsNumber() duration_years: number;
  @IsUUID() departmentId: string;
}

export class UpdateProgramDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() code?: string;
  @IsEnum(DegreeType) @IsOptional() degree?: DegreeType;
  @IsNumber() @IsOptional() duration_years?: number;
  @IsUUID() @IsOptional() departmentId?: string;
}

@Injectable()
export class ProgramsService {
  constructor(@InjectRepository(Program) private repo: Repository<Program>) {}
  async findAll(departmentId?: string) {
    const where = departmentId ? { department: { id: departmentId } } : {};
    const [data, total] = await this.repo.findAndCount({ where, relations: ['department', 'department.institute'] });
    return { data, total };
  }
  async create(dto: CreateProgramDto) {
    const prog = this.repo.create({ ...dto, department: { id: dto.departmentId } });
    return this.repo.save(prog);
  }
  async update(id: string, dto: UpdateProgramDto) {
    const program = await this.repo.findOne({ where: { id } });
    if (!program) throw new Error('Программа не найдена');

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.code) updateData.code = dto.code;
    if (dto.degree) updateData.degree = dto.degree;
    if (dto.duration_years) updateData.duration_years = dto.duration_years;
    
    if (dto.departmentId) {
      updateData.department = { id: dto.departmentId };
    }

    await this.repo.save({ ...program, ...updateData });
    return this.repo.findOne({ where: { id }, relations: ['department', 'department.institute'] });
  }
  async delete(id: string) { await this.repo.delete(id); return { success: true }; }
}

@Controller('programs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProgramsController {
  constructor(private readonly service: ProgramsService) {}
  @Get() findAll(@Query('departmentId') departmentId?: string) { return this.service.findAll(departmentId); }
  @Roles('admin') @Post() create(@Body() dto: CreateProgramDto) { return this.service.create(dto); }
  @Roles('admin') @Post(':id') update(@Param('id') id: string, @Body() dto: UpdateProgramDto) { return this.service.update(id, dto); }
  @Roles('admin') @Delete(':id') delete(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({ imports: [TypeOrmModule.forFeature([Program])], controllers: [ProgramsController], providers: [ProgramsService] })
export class ProgramsModule {}
