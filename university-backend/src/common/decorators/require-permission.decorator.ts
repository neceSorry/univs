import { SetMetadata } from '@nestjs/common';
export const PERMISSION_KEY = 'require_permission';
export const RequirePermission = (code: string) => SetMetadata(PERMISSION_KEY, code);
