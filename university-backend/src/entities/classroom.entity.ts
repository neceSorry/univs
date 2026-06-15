import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum ClassroomType {
  LECTURE = 'lecture',
  PRACTICE = 'practice',
  COMPUTER = 'computer',
  LAB = 'lab',
}

@Entity('classrooms')
export class Classroom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  building: string;

  @Column()
  room_number: string;

  @Column()
  capacity: number;

  @Column({ type: 'enum', enum: ClassroomType, default: ClassroomType.PRACTICE })
  type: ClassroomType;
}
