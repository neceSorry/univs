import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Program } from './program.entity';

@Entity('curriculum_plans')
export class CurriculumPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  semester: number;

  @Column()
  academic_year: string;

  @Column({ default: 0 })
  default_credit_price: number;

  @ManyToOne(() => Program)
  @JoinColumn({ name: 'programId' })
  program: Program;

  @Column({ nullable: true })
  programId: string;
}
