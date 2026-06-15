import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AdminPermission } from '../entities/admin-permission.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(AdminPermission)
    private adminPermRepo: Repository<AdminPermission>,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { username } });
    if (user && await bcrypt.compare(pass, user.password_hash)) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const perms = await this.adminPermRepo.find({
      where: { user: { id: userId } },
    });
    return perms.map(p => p.permission_code);
  }

  async login(user: any) {
    const permissions = user.role === 'admin' ? await this.getUserPermissions(user.id) : [];
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      is_super_admin: user.is_super_admin ?? false,
      permissions,
    };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_super_admin: user.is_super_admin ?? false,
        permissions,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const permissions = payload.role === 'admin' ? await this.getUserPermissions(payload.sub) : [];
      const newPayload = {
        email: payload.email,
        sub: payload.sub,
        role: payload.role,
        is_super_admin: payload.is_super_admin ?? false,
        permissions,
      };
      return {
        access_token: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
        refresh_token: this.jwtService.sign(newPayload, { expiresIn: '7d' }),
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
