import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Teacher } from './teacher.entity';
import { CurriculumItem } from './curriculum-item.entity';

@Entity('course_materials')
export class CourseMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  file_url: string;

  @CreateDateColumn()
  uploaded_at: Date;

  @ManyToOne(() => Teacher)
  teacher: Teacher;

  @ManyToOne(() => CurriculumItem)
  curriculum_item: CurriculumItem;
}
