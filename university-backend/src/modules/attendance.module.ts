import { Module, Controller, Get, Post, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../entities/attendance.entity';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AttendanceService {
  constructor(@InjectRepository(Attendance) private repo: Repository<Attendance>) {}
  async findAll(slotId?: string, date?: string) {
    const where: any = {};
    if (slotId) where.slot = { id: slotId };
    if (date) where.class_date = date;
    return { data: await this.repo.find({ where, relations: ['student', 'slot'] }) };
  }
  async bulkCreate(dto: { slotId: string, date: string, records: { studentId: string, status: string }[] }) {
    const entities = dto.records.map(r => this.repo.create({
      slot: { id: dto.slotId },
      class_date: dto.date,
      student: { id: r.studentId },
      status: r.status as any,
    }));
    await this.repo.save(entities);
    return { success: true, count: entities.length };
  }
}

@Controller('attendance')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}
  @Get() findAll(@Query('slotId') slotId: string, @Query('date') date: string) { return this.service.findAll(slotId, date); }
  @Post('bulk') bulkCreate(@Body() dto: any) { return this.service.bulkCreate(dto); }
}

@Module({ imports: [TypeOrmModule.forFeature([Attendance])], controllers: [AttendanceController], providers: [AttendanceService] })
export class AttendanceModule {}
