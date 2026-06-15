import { Module, Controller, Get, Post, Delete, Param, Body, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institute } from '../entities/institute.entity';
import { Department } from '../entities/department.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsOptional } from 'class-validator';

export class CreateInstituteDto {
  @IsString()
  name: string;
  @IsString()
  @IsOptional()
  short_name?: string;
}

export class UpdateInstituteDto {
  @IsString()
  @IsOptional()
  name?: string;
  @IsString()
  @IsOptional()
  short_name?: string;
}

@Injectable()
export class InstitutesService {
  constructor(
    @InjectRepository(Institute) private instRepo: Repository<Institute>,
    @InjectRepository(Department) private depRepo: Repository<Department>
  ) {}

  async findAll() {
    const [data, total] = await this.instRepo.findAndCount({ order: { created_at: 'ASC' } });
    const res = await Promise.all(data.map(async (inst) => {
      const depCount = await this.depRepo.count({ where: { institute: { id: inst.id } } });
      return { ...inst, departmentsCount: depCount };
    }));
    return { data: res, total };
  }
  async create(dto: CreateInstituteDto) { return this.instRepo.save(this.instRepo.create(dto)); }
  async update(id: string, dto: UpdateInstituteDto) { await this.instRepo.update(id, dto); return this.instRepo.findOne({ where: { id } }); }
  async delete(id: string) { await this.instRepo.delete(id); return { success: true }; }
}

@Controller('institutes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InstitutesController {
  constructor(private readonly service: InstitutesService) {}
  @Get()
  findAll() { return this.service.findAll(); }
  @Roles('admin')
  @Post()
  create(@Body() dto: CreateInstituteDto) { return this.service.create(dto); }
  @Roles('admin')
  @Post(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstituteDto) { return this.service.update(id, dto); }
  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Institute, Department])],
  controllers: [InstitutesController],
  providers: [InstitutesService],
})
export class InstitutesModule {}
