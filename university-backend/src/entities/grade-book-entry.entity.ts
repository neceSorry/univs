import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('grade_book_entries')
@Index(['student_id', 'discipline_id', 'group_id', 'lesson_date'], { unique: true })
export class GradeBookEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  student_id: string;

  @Column('uuid')
  discipline_id: string;

  @Column('uuid')
  group_id: string;

  // null = final grade row; 'YYYY-MM-DD' = daily entry
  @Column({ type: 'date', nullable: true })
  lesson_date: string | null;

  // '+' | '1'-'10' | '' for daily; '2'-'5' | '' for final
  @Column({ default: '' })
  value: string;
}
