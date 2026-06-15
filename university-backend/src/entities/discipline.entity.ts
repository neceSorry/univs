import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Department } from './department.entity';

export enum DisciplineType {
  LECTURE = 'lecture',
  PRACTICE = 'practice',
  LAB = 'lab',
}

@Entity('disciplines')
export class Discipline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  short_name: string;

  @Column({ type: 'enum', enum: DisciplineType, default: DisciplineType.LECTURE })
  type: DisciplineType;

  @ManyToOne(() => Department, { onDelete: 'CASCADE', nullable: true })
  department: Department;
}
