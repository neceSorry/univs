import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Institute } from './institute.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  short_name: string;

  @ManyToOne(() => Institute, { onDelete: 'CASCADE' })
  institute: Institute;
}
