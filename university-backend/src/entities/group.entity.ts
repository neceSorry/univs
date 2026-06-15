import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Program } from './program.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  year_of_entry: number;

  @Column({ default: true })
  is_active: boolean;

  @ManyToOne(() => Program, { onDelete: 'CASCADE' })
  program: Program;
}
