import { useAuthStore } from '../store/auth.store';

export function usePermissions() {
  const user = useAuthStore(s => s.user);

  const isSuperAdmin = user?.is_super_admin ?? false;

  const hasPermission = (code: string): boolean => {
    if (isSuperAdmin) return true;
    return user?.permissions?.includes(code) ?? false;
  };

  const canAny = (codes: string[]): boolean => codes.some(c => hasPermission(c));

  return { isSuperAdmin, hasPermission, canAny };
}
