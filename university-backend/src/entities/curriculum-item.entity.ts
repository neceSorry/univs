import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { CurriculumPlan } from './curriculum-plan.entity';
import { Discipline } from './discipline.entity';
import { Teacher } from './teacher.entity';

@Entity('curriculum_items')
export class CurriculumItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 0 })
  hours_lecture: number;

  @Column({ default: 0 })
  hours_practice: number;

  @Column({ default: 0 })
  hours_lab: number;

  @Column({ default: 0 })
  credits: number;

  @Column({ default: 0 })
  credit_price: number;

  @Column({ default: false })
  has_exam: boolean;

  @ManyToOne(() => CurriculumPlan)
  plan: CurriculumPlan;

  @ManyToOne(() => Discipline)
  discipline: Discipline;

  @ManyToOne(() => Teacher, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_lecture_id' })
  teacher_lecture: Teacher;

  @ManyToOne(() => Teacher, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_practice_id' })
  teacher_practice: Teacher;

  @ManyToOne(() => Teacher, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_lab_id' })
  teacher_lab: Teacher;

  // Preferred classrooms as simple text fields
  @Column({ type: 'varchar', nullable: true })
  classroom_lecture: string | null;

  @Column({ type: 'varchar', nullable: true })
  classroom_practice: string | null;

  @Column({ type: 'varchar', nullable: true })
  classroom_lab: string | null;
}
