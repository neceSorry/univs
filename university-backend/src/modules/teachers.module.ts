import { Module, Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Injectable } from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from '../entities/teacher.entity';
import { User, UserRole } from '../entities/user.entity';
import { CurriculumItem } from '../entities/curriculum-item.entity';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsOptional, IsUUID, IsEmail, MinLength } from 'class-validator';
import * as bcrypt from 'bcrypt';

export class CreateTeacherDto {
  @IsString() first_name: string;
  @IsString() last_name: string;
  @IsString() @IsOptional() middle_name?: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsUUID() departmentId: string;
  @IsString() @IsOptional() position?: string;
  @IsString() @IsOptional() degree?: string;
  @IsString() @IsOptional() phone?: string;
}

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(CurriculumItem) private ciRepo: Repository<CurriculumItem>
  ) {}

  async findAll(departmentId?: string) {
    const where = departmentId ? { department: { id: departmentId } } : {};
    const [data, total] = await this.teacherRepo.findAndCount({ where, relations: ['department', 'department.institute', 'user'] });
    
    const res = await Promise.all(data.map(async t => {
      const count = await Promise.all([
        this.ciRepo.count({ where: { teacher_lecture: { id: t.id } } }),
        this.ciRepo.count({ where: { teacher_practice: { id: t.id } } }),
        this.ciRepo.count({ where: { teacher_lab: { id: t.id } } }),
      ]).then(([a, b, c]) => a + b + c);
      return { ...t, disciplinesCount: count };
    }));

    return { data: res, total };
  }

  async findOne(id: string) {
    const teacher = await this.teacherRepo.findOne({ where: { id }, relations: ['department', 'user'] });
    const [lec, pra, lab] = await Promise.all([
      this.ciRepo.find({ where: { teacher_lecture: { id } }, relations: ['discipline', 'plan', 'plan.program'] }),
      this.ciRepo.find({ where: { teacher_practice: { id } }, relations: ['discipline', 'plan', 'plan.program'] }),
      this.ciRepo.find({ where: { teacher_lab: { id } }, relations: ['discipline', 'plan', 'plan.program'] }),
    ]);
    const itemMap = new Map([...lec, ...pra, ...lab].map(i => [i.id, i]));
    return { data: { ...teacher, curriculum_items: Array.from(itemMap.values()) } };
  }

  async create(dto: CreateTeacherDto) {
    let user = await this.userRepo.findOne({ where: { email: dto.email } });
    
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(dto.password, salt);

    const username = dto.email.split('@')[0];

    if (user) {
      // Check if this user is already assigned to a teacher
      const existingTeacher = await this.teacherRepo.findOne({ where: { user: { id: user.id } } });
      if (existingTeacher) {
        throw new Error('Пользователь с таким Email уже привязан к другому преподавателю');
      }
      // Update password for the existing orphaned user
      user.password_hash = password_hash;
      user.role = UserRole.TEACHER;
      user.username = user.username ?? username;
      await this.userRepo.save(user);
    } else {
      user = this.userRepo.create({ email: dto.email, username, password_hash, role: UserRole.TEACHER });
      await this.userRepo.save(user);
    }

    const teacher = this.teacherRepo.create({
      first_name: dto.first_name,
      last_name: dto.last_name,
      middle_name: dto.middle_name,
      position: dto.position,
      degree: dto.degree,
      phone: dto.phone,
      department: { id: dto.departmentId },
      user: user,
    });
    return this.teacherRepo.save(teacher);
  }

  async update(id: string, dto: any) {
    const teacher = await this.teacherRepo.findOne({ where: { id }, relations: ['user'] });
    if (!teacher) throw new Error('Преподаватель не найден');

    const updateData: any = {};
    if (dto.first_name) updateData.first_name = dto.first_name;
    if (dto.last_name) updateData.last_name = dto.last_name;
    if (dto.middle_name !== undefined) updateData.middle_name = dto.middle_name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.position !== undefined) updateData.position = dto.position;
    if (dto.degree !== undefined) updateData.degree = dto.degree;
    
    if (dto.departmentId) {
      updateData.department = { id: dto.departmentId };
    }

    // Если email изменился, обновляем его в сущности User
    if (dto.email && teacher.user) {
      await this.userRepo.update(teacher.user.id, { email: dto.email });
    }

    await this.teacherRepo.save({ ...teacher, ...updateData });
    return this.teacherRepo.findOne({ where: { id }, relations: ['department', 'department.institute', 'user'] });
  }

  async delete(id: string) {
    const teacher = await this.teacherRepo.findOne({ where: { id }, relations: ['user'] });
    if (teacher) {
      const userId = teacher.user.id;
      await this.teacherRepo.delete(id);
      await this.userRepo.delete(userId);
    }
    return { success: true };
  }
}

@Controller('teachers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TeachersController {
  constructor(private readonly service: TeachersService) {}
  @Get() findAll(@Query('departmentId') departmentId?: string) { return this.service.findAll(departmentId); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Roles('admin') @Post() create(@Body() dto: CreateTeacherDto) { return this.service.create(dto); }
  @Roles('admin') @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Roles('admin') @Delete(':id') delete(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({ imports: [TypeOrmModule.forFeature([Teacher, User, CurriculumItem])], controllers: [TeachersController], providers: [TeachersService] })
export class TeachersModule {}
