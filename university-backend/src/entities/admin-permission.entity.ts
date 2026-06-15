import {
  Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn,
  Column, CreateDateColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Permission } from './permission.entity';

@Entity('admin_permissions')
@Unique(['user', 'permission_code'])
export class AdminPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  permission_code: string;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'permission_code' })
  permission: Permission;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'granted_by_id' })
  granted_by: User;

  @CreateDateColumn()
  granted_at: Date;
}
