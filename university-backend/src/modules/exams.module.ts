import { Module, Controller, Get, Post, Delete, Patch, Param, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Exam, ExamStatus } from '../entities/exam.entity';
import { ExamResult } from '../entities/exam-result.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam) private examRepo: Repository<Exam>,
    @InjectRepository(ExamResult) private resultRepo: Repository<ExamResult>
  ) {}

  async findAll(groupId?: string, semester?: number, teacherId?: string) {
    const where: any = { status: ExamStatus.APPROVED };
    if (groupId) where.group = { id: groupId };
    if (semester) where.semester = semester;
    if (teacherId) where.teacher = { id: teacherId };
    return { data: await this.examRepo.find({ where, relations: ['discipline', 'group', 'teacher', 'classroom'] }) };
  }

  async getPending() {
    return { data: await this.examRepo.find({
      where: { status: ExamStatus.PENDING },
      relations: ['discipline', 'group', 'teacher'],
      order: { exam_date: 'ASC' },
    }) };
  }

  async approve(id: string) {
    await this.examRepo.update(id, { status: ExamStatus.APPROVED });
    return { success: true };
  }

  async reject(id: string) {
    await this.examRepo.update(id, { status: ExamStatus.REJECTED });
    return { success: true };
  }

  async create(dto: any) {
    const exam = this.examRepo.create({
      ...dto,
      status: ExamStatus.PENDING,
      discipline: { id: dto.discipline_id },
      group: { id: dto.group_id },
      teacher: { id: dto.teacher_id },
    });
    return this.examRepo.save(exam);
  }

  async delete(id: string) {
    await this.examRepo.delete(id);
    return { success: true };
  }

  async getResults(examId: string) {
    return { data: await this.resultRepo.find({ where: { exam: { id: examId } }, relations: ['student'] }) };
  }

  async bulkResults(examId: string, dto: { results: any[] }) {
    const existing = await this.resultRepo.find({ where: { exam: { id: examId } } });
    await this.resultRepo.remove(existing);

    const entities = dto.results.map(r => this.resultRepo.create({
      exam: { id: examId },
      student: { id: r.student_id },
      grade: r.grade,
      is_admitted: r.is_admitted,
    }));
    await this.resultRepo.save(entities);
    return { success: true, count: entities.length };
  }
}

@Controller('exams')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ExamsController {
  constructor(private readonly service: ExamsService) {}

  @Get() findAll(@Query('groupId') g: string, @Query('semester') s: number, @Query('teacherId') t: string) { return this.service.findAll(g, s, t); }
  @Get('pending') @Roles('admin') getPending() { return this.service.getPending(); }
  @Patch(':id/approve') @Roles('admin') approve(@Param('id') id: string) { return this.service.approve(id); }
  @Patch(':id/reject') @Roles('admin') reject(@Param('id') id: string) { return this.service.reject(id); }
  @Post() create(@Body() dto: any) { return this.service.create(dto); }
  @Delete(':id') delete(@Param('id') id: string) { return this.service.delete(id); }
  @Get(':examId/results') getResults(@Param('examId') id: string) { return this.service.getResults(id); }
  @Post(':examId/results/bulk') bulkResults(@Param('examId') id: string, @Body() dto: any) { return this.service.bulkResults(id, dto); }
}

@Module({ imports: [TypeOrmModule.forFeature([Exam, ExamResult])], controllers: [ExamsController], providers: [ExamsService] })
export class ExamsModule {}
