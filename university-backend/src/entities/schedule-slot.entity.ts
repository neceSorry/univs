import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Group } from './group.entity';
import { Discipline } from './discipline.entity';
import { Teacher } from './teacher.entity';
import { Classroom } from './classroom.entity';
import { ScheduleVersion } from './schedule-version.entity';
import { Stream } from './stream.entity';

export enum WeekType {
  ALL = 'all',
  ODD = 'odd',
  EVEN = 'even',
}

@Entity('schedule_slots')
export class ScheduleSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  day_of_week: number;

  @Column()
  period_number: number;

  @Column({ type: 'enum', enum: WeekType, default: WeekType.ALL })
  week_type: WeekType;

  @Column()
  semester: number;

  @Column()
  academic_year: string;

  @ManyToOne(() => Group)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ManyToOne(() => Discipline)
  @JoinColumn({ name: 'discipline_id' })
  discipline: Discipline;

  @ManyToOne(() => Teacher)
  @JoinColumn({ name: 'teacher_id' })
  teacher: Teacher;

  @ManyToOne(() => Classroom, { nullable: true })
  @JoinColumn({ name: 'classroom_id' })
  classroom: Classroom;

  @Column({ nullable: true })
  classroom_text: string;

  @Column({ nullable: true, default: 'lecture' })
  lesson_type: string;

  @ManyToOne(() => ScheduleVersion, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: ScheduleVersion;

  @Column({ default: false })
  is_stream: boolean;

  @ManyToOne(() => Stream, { nullable: true })
  @JoinColumn({ name: 'stream_id' })
  stream: Stream;

  @Column({ default: false })
  is_manual_override: boolean;

  @Column({ nullable: true })
  override_reason: string;
}
