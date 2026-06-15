import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Teacher } from './teacher.entity';

@Entity('teacher_preferences')
export class TeacherPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Teacher, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Teacher;

  @Column()
  semester: number;

  @Column()
  academic_year: string;

  @Column({ type: 'simple-array', nullable: true, default: '' })
  unavailable_days: number[];

  @Column({ type: 'simple-array', nullable: true, default: '' })
  preferred_periods: number[];

  @Column({ default: 4 })
  max_periods_per_day: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1.0 })
  work_rate: number;

  @Column({ nullable: true })
  notes: string;
}
