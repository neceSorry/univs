import {
  Module, Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Request, Injectable, NotFoundException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';

import { User, UserRole } from '../../entities/user.entity';
import { Permission } from '../../entities/permission.entity';
import { AdminPermission } from '../../entities/admin-permission.entity';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Injectable()
export class AdminPermissionsService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(AdminPermission) private adminPermRepo: Repository<AdminPermission>,
    private dataSource: DataSource,
  ) {}

  async listAdminUsers() {
    const admins = await this.userRepo.find({
      where: { role: UserRole.ADMIN },
    });
    const result: any[] = [];
    for (const admin of admins) {
      const perms = await this.adminPermRepo.find({
        where: { user: { id: admin.id } },
      });
      result.push({
        user: {
          id: admin.id,
          email: admin.email,
          username: admin.username,
          is_super_admin: admin.is_super_admin,
          created_at: admin.created_at,
        },
        permissions: perms.map(p => p.permission_code),
      });
    }
    return result;
  }

  async createAdminUser(dto: {
    username: string;
    password: string;
    permissions: string[];
  }, grantedBy: User) {
    return this.dataSource.transaction(async manager => {
      const existing = await manager.findOne(User, { where: { username: dto.username } });
      if (existing) throw new BadRequestException('Логин уже занят');

      const hash = await bcrypt.hash(dto.password, 10);
      const email = `${dto.username}@admin.local`;
      const user = manager.create(User, {
        email,
        username: dto.username,
        password_hash: hash,
        role: UserRole.ADMIN,
        is_super_admin: false,
      });
      const savedUser = await manager.save(user);

      for (const code of dto.permissions) {
        const ap = manager.create(AdminPermission, {
          user: savedUser,
          permission_code: code,
          granted_by: grantedBy,
        });
        await manager.save(ap);
      }

      return { id: savedUser.id, email: savedUser.email, permissions: dto.permissions };
    });
  }

  async updatePermissions(userId: string, permissions: string[], grantedBy: User) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.is_super_admin) throw new ForbiddenException('Cannot modify super admin permissions');

    return this.dataSource.transaction(async manager => {
      await manager.delete(AdminPermission, { user: { id: userId } });
      for (const code of permissions) {
        const ap = manager.create(AdminPermission, {
          user,
          permission_code: code,
          granted_by: grantedBy,
        });
        await manager.save(ap);
      }
      return { userId, permissions };
    });
  }

  async deleteAdminUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.is_super_admin) {
      const superAdminCount = await this.userRepo.count({
        where: { role: UserRole.ADMIN, is_super_admin: true },
      });
      if (superAdminCount <= 1) throw new ForbiddenException('Нельзя удалить единственного Super Admin');
    }
    await this.userRepo.remove(user);
    return { success: true };
  }

  async getMyPermissions(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.is_super_admin) {
      const allPerms = await this.permRepo.find();
      return { is_super_admin: true, permissions: allPerms.map(p => p.code) };
    }
    const perms = await this.adminPermRepo.find({ where: { user: { id: userId } } });
    return { is_super_admin: false, permissions: perms.map(p => p.permission_code) };
  }

  async listAllPermissions() {
    return this.permRepo.find();
  }
}

@Controller('admin-permissions')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminPermissionsController {
  constructor(private readonly service: AdminPermissionsService) {}

  @Get('users')
  listUsers(@Request() req: any) {
    if (!req.user.is_super_admin) throw new ForbiddenException('Super admin only');
    return this.service.listAdminUsers();
  }

  @Post('users')
  createUser(@Body() dto: any, @Request() req: any) {
    if (!req.user.is_super_admin) throw new ForbiddenException('Super admin only');
    return this.service.createAdminUser(dto, req.user);
  }

  @Put('users/:userId/permissions')
  updatePermissions(@Param('userId') userId: string, @Body() body: any, @Request() req: any) {
    if (!req.user.is_super_admin) throw new ForbiddenException('Super admin only');
    return this.service.updatePermissions(userId, body.permissions || [], req.user);
  }

  @Delete('users/:userId')
  deleteUser(@Param('userId') userId: string, @Request() req: any) {
    if (!req.user.is_super_admin) throw new ForbiddenException('Super admin only');
    return this.service.deleteAdminUser(userId);
  }

  @Get('my-permissions')
  getMyPermissions(@Request() req: any) {
    return this.service.getMyPermissions(req.user.id);
  }

  @Get('all')
  listAllPermissions() {
    return this.service.listAllPermissions();
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User, Permission, AdminPermission])],
  controllers: [AdminPermissionsController],
  providers: [AdminPermissionsService],
  exports: [AdminPermissionsService],
})
export class AdminPermissionsModule {}
