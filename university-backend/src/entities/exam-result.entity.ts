import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Student } from './student.entity';
import { Exam } from './exam.entity';

@Entity('exam_results')
export class ExamResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 3, scale: 1, nullable: true })
  grade: number;

  @Column({ default: true })
  is_admitted: boolean;

  @ManyToOne(() => Student)
  student: Student;

  @ManyToOne(() => Exam)
  exam: Exam;
}
