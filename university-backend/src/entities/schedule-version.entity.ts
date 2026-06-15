import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Program } from './program.entity';
import { User } from './user.entity';

export enum VersionStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('schedule_versions')
export class ScheduleVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  semester: number;

  @Column()
  academic_year: string;

  @Column({ nullable: true, default: 'autumn' })
  period: string;

  // nullable — university-wide versions have no specific program
  @ManyToOne(() => Program, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'program_id' })
  program: Program;

  @Column({ type: 'enum', enum: VersionStatus, default: VersionStatus.DRAFT })
  status: VersionStatus;

  @Column({ type: 'float', default: 0 })
  quality_score: number;

  @Column({ type: 'jsonb', nullable: true })
  penalty_details: Record<string, number>;

  @CreateDateColumn()
  generated_at: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'generated_by_id' })
  generated_by: User;

  @Column({ nullable: true })
  published_at: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'published_by_id' })
  published_by: User;
}
