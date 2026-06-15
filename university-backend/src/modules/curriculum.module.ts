import { Module, Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumPlan } from '../entities/curriculum-plan.entity';
import { CurriculumItem } from '../entities/curriculum-item.entity';
import { Discipline } from '../entities/discipline.entity';
import { Teacher } from '../entities/teacher.entity';
import { Classroom } from '../entities/classroom.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(CurriculumPlan) private planRepo: Repository<CurriculumPlan>,
    @InjectRepository(CurriculumItem) private itemRepo: Repository<CurriculumItem>,
    @InjectRepository(Discipline) private discRepo: Repository<Discipline>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(Classroom) private classroomRepo: Repository<Classroom>,
  ) {}

  async findPlans(programId?: string, semester?: number) {
    const where: any = {};
    if (programId) where.programId = programId;
    if (semester) where.semester = Number(semester);
    
    const plans = await this.planRepo.find({ where });
    
    const res = await Promise.all(plans.map(async (p) => {
      const items = await this.itemRepo.find({ 
        where: { plan: { id: p.id } }, 
        relations: ['discipline', 'teacher_lecture', 'teacher_practice', 'teacher_lab'] 
      });
      return { 
        id: p.id,
        semester: p.semester,
        academic_year: p.academic_year,
        programId: p.programId,
        default_credit_price: p.default_credit_price || 0,
        items: items.map(i => ({
          ...i,
          total_cost: (i.credits || 0) * (i.credit_price || p.default_credit_price || 0)
        })) || []
      };
    }));
    return { data: res, total: res.length };
  }

  async createPlan(dto: any) {
    const { semester, programId } = dto;
    console.log('Creating/finding plan for:', { semester, programId });
    
    const existing = await this.planRepo.findOne({ 
      where: { 
        semester: Number(semester), 
        programId: programId 
      } 
    });
    
    if (existing) {
      console.log('Found existing plan:', existing.id);
      return existing;
    }

    const plan = this.planRepo.create({ 
      semester: Number(semester), 
      academic_year: dto.academic_year || '2023-2024', 
      programId: programId 
    });
    
    const saved = await this.planRepo.save(plan);
    console.log('Created new plan:', saved.id, 'with programId:', saved.programId);
    return saved;
  }

  async updatePlan(id: string, dto: any) {
    await this.planRepo.update(id, dto);
    return this.planRepo.findOne({ where: { id } });
  }

  async addItem(planId: string, dto: any) {
    if (!planId || planId === 'undefined') {
      throw new BadRequestException('Некорректный ID учебного плана');
    }
    
    try {
      const { name, hours_lecture, hours_practice, hours_lab, credits, credit_price } = dto;
      
      // 1. Ищем или создаем дисциплину
      let discipline = await this.discRepo.findOne({ where: { name } });
      if (!discipline) {
        discipline = await this.discRepo.save(this.discRepo.create({
          name,
          type: 'lecture' as any,
          short_name: name.substring(0, 10)
        }));
      }

      // 2. Создаем элемент учебного плана
      const item = this.itemRepo.create({
        hours_lecture: Number(hours_lecture || 0),
        hours_practice: Number(hours_practice || 0),
        hours_lab: Number(hours_lab || 0),
        credits: Number(credits || 0),
        credit_price: Number(credit_price || 0),
        plan: { id: planId },
        discipline: { id: discipline.id }
      });
      
      const savedItem = await this.itemRepo.save(item);
      return savedItem;
    } catch (e) {
      console.error('Error in addItem:', e);
      throw new BadRequestException(`Ошибка при сохранении: ${e.message}`);
    }
  }

  async deleteItem(itemId: string) {
    return this.itemRepo.delete(itemId);
  }

  async updateItem(itemId: string, dto: any) {
    const { name, hours_lecture, hours_practice, hours_lab, credits } = dto;
    
    const item = await this.itemRepo.findOne({ where: { id: itemId }, relations: ['discipline'] });
    if (!item) throw new BadRequestException('Элемент не найден');

    // Если имя изменилось, обновляем дисциплину (или ищем другую)
    if (name && item.discipline.name !== name) {
      let discipline = await this.discRepo.findOne({ where: { name } });
      if (!discipline) {
        discipline = await this.discRepo.save(this.discRepo.create({
          name,
          type: 'lecture' as any,
          short_name: name.substring(0, 10)
        }));
      }
      item.discipline = discipline;
    }

    if (hours_lecture !== undefined) item.hours_lecture = Number(hours_lecture);
    if (hours_practice !== undefined) item.hours_practice = Number(hours_practice);
    if (hours_lab !== undefined) item.hours_lab = Number(hours_lab);
    if (credits !== undefined) item.credits = Number(credits);

    return this.itemRepo.save(item);
  }

  async assignTeacher(itemId: string, lessonType: 'lecture' | 'practice' | 'lab', teacherId: string | null) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
      relations: ['teacher_lecture', 'teacher_practice', 'teacher_lab', 'discipline'],
    });
    if (!item) throw new NotFoundException('Curriculum item not found');

    let teacher: any = null;
    if (teacherId) {
      teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
      if (!teacher) throw new NotFoundException('Teacher not found');
    }

    if (lessonType === 'lecture') item.teacher_lecture = teacher;
    else if (lessonType === 'practice') item.teacher_practice = teacher;
    else if (lessonType === 'lab') item.teacher_lab = teacher;

    const saved = await this.itemRepo.save(item);
    const savedTeacher = lessonType === 'lecture' ? saved.teacher_lecture
      : lessonType === 'practice' ? saved.teacher_practice : saved.teacher_lab;
    return {
      id: saved.id,
      lesson_type: lessonType,
      assigned_teacher: savedTeacher
        ? { id: savedTeacher.id, first_name: savedTeacher.first_name, last_name: savedTeacher.last_name }
        : null,
    };
  }

  async assignClassroom(itemId: string, lessonType: 'lecture' | 'practice' | 'lab', classroomName: string | null) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Curriculum item not found');

    if (lessonType === 'lecture') item.classroom_lecture = classroomName;
    else if (lessonType === 'practice') item.classroom_practice = classroomName;
    else if (lessonType === 'lab') item.classroom_lab = classroomName;

    const saved = await this.itemRepo.save(item);
    const savedClassroom = lessonType === 'lecture' ? saved.classroom_lecture
      : lessonType === 'practice' ? saved.classroom_practice : saved.classroom_lab;
    return {
      id: saved.id,
      lesson_type: lessonType,
      assigned_classroom: savedClassroom,
    };
  }
}

@Controller('curriculum')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CurriculumController {
  constructor(private readonly service: CurriculumService) {}
  
  @Get() findPlans(@Query('programId') programId?: string, @Query('semester') semester?: number) { 
    return this.service.findPlans(programId, semester); 
  }
  
  @Roles('admin') @Post() createPlan(@Body() dto: any) { return this.service.createPlan(dto); }
  @Roles('admin') @Post(':id') updatePlan(@Param('id') id: string, @Body() dto: any) { return this.service.updatePlan(id, dto); }
  @Roles('admin') @Post(':planId/items') addItem(@Param('planId') planId: string, @Body() dto: any) { return this.service.addItem(planId, dto); }
  @Roles('admin') @Put('items/:itemId') updateItem(@Param('itemId') itemId: string, @Body() dto: any) { return this.service.updateItem(itemId, dto); }
  @Roles('admin') @Put('items/:itemId/assign-teacher') assignTeacher(@Param('itemId') itemId: string, @Body() body: { lesson_type: 'lecture' | 'practice' | 'lab'; teacher_id: string | null }) { return this.service.assignTeacher(itemId, body.lesson_type, body.teacher_id ?? null); }
  @Roles('admin') @Put('items/:itemId/assign-classroom') assignClassroom(@Param('itemId') itemId: string, @Body() body: { lesson_type: 'lecture' | 'practice' | 'lab'; classroom_name: string | null }) { return this.service.assignClassroom(itemId, body.lesson_type, body.classroom_name ?? null); }
  @Roles('admin') @Delete('items/:itemId') deleteItem(@Param('itemId') itemId: string) { return this.service.deleteItem(itemId); }
}

@Module({ imports: [TypeOrmModule.forFeature([CurriculumPlan, CurriculumItem, Discipline, Teacher, Classroom])], controllers: [CurriculumController], providers: [CurriculumService] })
export class CurriculumModule {}
