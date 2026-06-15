import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryColumn()
  code: string;

  @Column()
  description: string;
}
