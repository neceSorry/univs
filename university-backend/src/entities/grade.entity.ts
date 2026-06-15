import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Student } from './student.entity';
import { ScheduleSlot } from './schedule-slot.entity';
import { Discipline } from './discipline.entity';

export enum GradeType {
  CURRENT = 'current',
  MIDTERM = 'midterm',
  EXAM = 'exam',
  MANUAL = 'manual',
}

@Entity('grades')
export class Grade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 5, scale: 1 })
  grade_value: number;

  @Column({ type: 'enum', enum: GradeType })
  grade_type: GradeType;

  @CreateDateColumn()
  graded_at: Date;

  @ManyToOne(() => Student)
  student: Student;

  @ManyToOne(() => ScheduleSlot, { nullable: true })
  slot: ScheduleSlot | null;

  @ManyToOne(() => Discipline, { nullable: true })
  discipline: Discipline | null;
}
