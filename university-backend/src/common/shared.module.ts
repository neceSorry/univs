import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminPermission } from '../entities/admin-permission.entity';
import { RolesGuard } from '../auth/roles.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AdminPermission])],
  providers: [RolesGuard],
  exports: [RolesGuard, TypeOrmModule],
})
export class SharedModule {}
