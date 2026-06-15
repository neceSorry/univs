import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Group } from './group.entity';
import { Discipline } from './discipline.entity';
import { Teacher } from './teacher.entity';
import { Classroom } from './classroom.entity';

export enum ExamType {
  EXAM = 'exam',
  CREDIT = 'credit',
}

export enum ExamStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp' })
  exam_date: Date;

  @Column({ type: 'enum', enum: ExamType })
  type: ExamType;

  @Column()
  semester: number;

  @Column({ type: 'enum', enum: ExamStatus, default: ExamStatus.PENDING })
  status: ExamStatus;

  @Column({ nullable: true, type: 'text' })
  classroom_text: string;

  @ManyToOne(() => Group)
  group: Group;

  @ManyToOne(() => Discipline)
  discipline: Discipline;

  @ManyToOne(() => Teacher)
  teacher: Teacher;

  @ManyToOne(() => Classroom, { nullable: true })
  classroom: Classroom;
}
