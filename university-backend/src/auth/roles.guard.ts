import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PERMISSION_KEY } from '../common/decorators/require-permission.decorator';
import { AdminPermission } from '../entities/admin-permission.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(AdminPermission)
    private adminPermRepo: Repository<AdminPermission>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Super-admin always passes
    if (user?.is_super_admin) {
      return true;
    }

    // Check role first
    if (!requiredRoles.includes(user?.role)) {
      return false;
    }

    // If a specific permission is also required, check it
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredPermission) {
      const perm = await this.adminPermRepo.findOne({
        where: { user: { id: user.id }, permission_code: requiredPermission },
      });
      return !!perm;
    }

    return true;
  }
}
