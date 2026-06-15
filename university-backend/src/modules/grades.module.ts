import { Module, Controller, Get, Post, Put, Param, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Grade } from '../entities/grade.entity';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GradesService {
  constructor(@InjectRepository(Grade) private repo: Repository<Grade>) {}
  async findAll(slotId?: string, groupId?: string) {
    const where: any = {};
    if (slotId) where.slot = { id: slotId };
    if (groupId) where.student = { group: { id: groupId } }; 
    return { data: await this.repo.find({ where, relations: ['student', 'slot'] }) };
  }
  async create(dto: any) {
    const grade = this.repo.create({ ...dto, student: { id: dto.studentId }, slot: { id: dto.slotId } });
    return this.repo.save(grade);
  }
  async update(id: string, dto: any) {
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } });
  }
}

@Controller('grades')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class GradesController {
  constructor(private readonly service: GradesService) {}
  @Get() findAll(@Query('slotId') slotId: string, @Query('groupId') groupId: string) { return this.service.findAll(slotId, groupId); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
}

@Module({ imports: [TypeOrmModule.forFeature([Grade])], controllers: [GradesController], providers: [GradesService] })
export class GradesModule {}
