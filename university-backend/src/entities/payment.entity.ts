import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Student } from './student.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
}

export enum PaymentServiceType {
  TUITION = 'tuition',
  SUMMER_SEMESTER = 'summer_semester',
  DORMITORY = 'dormitory',
  GRADE_SHEET = 'grade_sheet',
  DIPLOMA = 'diploma',
  DOCUMENT_INTAKE = 'document_intake',
  TRANSFER = 'transfer',
}

export const SERVICE_TYPE_LABELS: Record<PaymentServiceType, string> = {
  [PaymentServiceType.TUITION]: 'Плата за обучение',
  [PaymentServiceType.SUMMER_SEMESTER]: 'Плата за летний семестр',
  [PaymentServiceType.DORMITORY]: 'Плата за общежитие',
  [PaymentServiceType.GRADE_SHEET]: 'Плата за зачетно-экз. ведомость',
  [PaymentServiceType.DIPLOMA]: 'Оплата за корочку диплома',
  [PaymentServiceType.DOCUMENT_INTAKE]: 'Оплата за прием документов',
  [PaymentServiceType.TRANSFER]: 'Оплата за перевод или восстановление',
};

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PaymentServiceType, default: PaymentServiceType.TUITION })
  service_type: PaymentServiceType;

  @Column()
  semester: number;

  @Column()
  academic_year: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount_due: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  amount_paid: number;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'date', nullable: true })
  due_date: string | null;

  @Column({ type: 'varchar', nullable: true })
  receipt_number: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

  @ManyToOne(() => Student)
  student: Student;
}
