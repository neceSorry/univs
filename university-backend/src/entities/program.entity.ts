import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Department } from './department.entity';

export enum DegreeType {
  BACHELOR = 'bachelor',
  MASTER = 'master',
}

@Entity('programs')
export class Program {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  code: string;

  @Column({ type: 'enum', enum: DegreeType, default: DegreeType.BACHELOR })
  degree: DegreeType;

  @Column({ default: 4 })
  duration_years: number;

  @ManyToOne(() => Department, { onDelete: 'CASCADE' })
  department: Department;
}
