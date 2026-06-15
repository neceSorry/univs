import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  is_super_admin: boolean;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  role: string | null;
  isAuthenticated: boolean;
  login: (credentials: { user: User; access_token: string; refresh_token: string }) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  role: localStorage.getItem('role'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  login: ({ user, access_token, refresh_token }) => {
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('role', user.role);
    set({ user, token: access_token, role: user.role, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('role');
    set({ user: null, token: null, role: null, isAuthenticated: false });
  },
  setUser: (user) => set({ user, role: user.role }),
}));
