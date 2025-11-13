// Role & Auth related TypeScript types
// NOTE: Simplified in-app auth; replace with secure backend-backed auth in production.

export type UserRole = 'assembler' | 'operator' | 'warehouse' | 'manager' | 'admin';

export type UserSegment = 'lux' | 'econom';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  // Optional segment for scoped assemblers (e.g., lux/econom)
  segment?: UserSegment;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface CreateUserPayload {
  username: string;
  displayName: string;
  role: UserRole;
  segment?: UserSegment;
  password: string;
}

export interface UpdateUserPayload {
  username?: string;
  displayName?: string;
  role?: UserRole;
  segment?: UserSegment | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  loginJwt?: (username: string, password: string, role: UserRole) => Promise<boolean>;
  refreshToken?: () => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  listUsers: () => AuthUser[];
  createUser: (payload: CreateUserPayload) => Promise<AuthUser>;
  updateUser: (id: string, payload: UpdateUserPayload) => Promise<AuthUser>;
  deleteUser: (id: string) => Promise<void>;
  resetUserPassword: (id: string, newPassword: string) => Promise<void>;
  changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  isReady: boolean;
  jwtExp?: number | null;
  remainingSec?: number | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  assembler: 'Сборщик',
  operator: 'Оператор',
  warehouse: 'Завсклад',
  manager: 'Менеджер',
  admin: 'Админ'
};

// Role hierarchy for convenience (higher index => higher privilege)
export const ROLE_ORDER: UserRole[] = ['assembler', 'operator', 'warehouse', 'manager', 'admin'];

export function roleAtLeast(userRole: UserRole, required: UserRole) {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(required);
}
