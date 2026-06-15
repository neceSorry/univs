import { Module, Controller, Get, Post, Delete, Param, Query, UseGuards, Injectable, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseMaterial } from '../entities/course-material.entity';
import { Teacher } from '../entities/teacher.entity';
import { RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { Request as Req } from '@nestjs/common';
import { diskStorage } from 'multer';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(CourseMaterial) private repo: Repository<CourseMaterial>,
    @InjectRepository(Teacher) private teacherRepo: Repository<Teacher>,
  ) {}

  async findAll(curriculumItemId?: string) {
    const where: any = {};
    if (curriculumItemId) where.curriculum_item = { id: curriculumItemId };
    return { data: await this.repo.find({ where, relations: ['curriculum_item'] }) };
  }

  async upload(userId: string, curriculumItemId: string, file: any) {
    const teacher = await this.teacherRepo.findOne({ where: { user: { id: userId } } });
    const material = this.repo.create({
      title: file.originalname,
      file_url: `/uploads/${file.filename}`,
      teacher: { id: teacher?.id },
      curriculum_item: { id: curriculumItemId }
    });
    return this.repo.save(material);
  }

  async delete(id: string) { await this.repo.delete(id); return { success: true }; }
}

@Controller('materials')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MaterialsController {
  constructor(private readonly service: MaterialsService) {}
  
  @Get() findAll(@Query('curriculumItemId') itemId: string) { return this.service.findAll(itemId); }
  
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
    })
  }))
  upload(@Req() req, @Body('curriculumItemId') itemId: string, @UploadedFile() file: any) {
    return this.service.upload(req.user.id, itemId, file);
  }

  @Delete(':id') delete(@Param('id') id: string) { return this.service.delete(id); }
}

@Module({ imports: [TypeOrmModule.forFeature([CourseMaterial, Teacher])], controllers: [MaterialsController], providers: [MaterialsService] })
export class MaterialsModule {}
