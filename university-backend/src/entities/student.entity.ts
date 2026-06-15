import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Group } from './group.entity';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum EnrollmentType {
  BUDGET = 'budget',
  CONTRACT = 'contract',
}

export enum StudyForm {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
}

export enum StudentStatus {
  ACTIVE = 'active',
  EXPELLED = 'expelled',
  ACADEMIC_LEAVE = 'academic_leave',
}

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ nullable: true })
  middle_name: string;


  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender;

  @Column({ type: 'enum', enum: EnrollmentType, nullable: true })
  enrollment_type: EnrollmentType;

  @Column({ type: 'enum', enum: StudyForm, nullable: true })
  study_form: StudyForm;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: StudentStatus, default: StudentStatus.ACTIVE })
  status: StudentStatus;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  group: Group;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;
}
