import { AuthUser, UserRole, UserSegment, ROLE_ORDER, CreateUserPayload, UpdateUserPayload } from '../types/auth';

// Simple hash (NOT SECURE) just to avoid storing plain passwords directly.
function pseudoHash(pw: string) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (h * 31 + pw.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

interface StoredUser extends AuthUser { passwordHash: string }

const USERS_STORAGE_KEY = 'auth_users_v1';
const DEFAULT_USERS: StoredUser[] = [
  { id: 'u1', username: 'assembler', displayName: 'Сборщик', role: 'assembler', passwordHash: pseudoHash('assembler123') },
  { id: 'u5', username: 'assembler-lux', displayName: 'Сборщик (Люкс)', role: 'assembler', segment: 'lux', passwordHash: pseudoHash('lux123') },
  { id: 'u6', username: 'assembler-econom', displayName: 'Сборщик (Эконом)', role: 'assembler', segment: 'econom', passwordHash: pseudoHash('econom123') },
  { id: 'u2', username: 'operator', displayName: 'Оператор', role: 'operator', passwordHash: pseudoHash('operator123') },
  { id: 'u7', username: 'zavsklad', displayName: 'Завсклад', role: 'warehouse', passwordHash: pseudoHash('zavsklad123') },
  { id: 'u3', username: 'manager', displayName: 'Менеджер', role: 'manager', passwordHash: pseudoHash('manager123') },
  { id: 'u4', username: 'admin', displayName: 'Админ', role: 'admin', passwordHash: pseudoHash('admin123') },
];
let usersStore: StoredUser[] = [...DEFAULT_USERS];
let syncedWithStorage = false;
const userStoreSubscribers = new Set<() => void>();
function cloneUsers(users: StoredUser[]): StoredUser[] {
  return users.map((user) => ({ ...user }));
}
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
function normalizeUser(input: any): StoredUser | null {
  if (!input || typeof input !== 'object') return null;
  const { id, username, displayName, role, segment, passwordHash } = input as Partial<StoredUser>;
  if (typeof id !== 'string' || typeof username !== 'string' || typeof displayName !== 'string' || typeof passwordHash !== 'string') {
    return null;
  }
  if (!ROLE_ORDER.includes(role as UserRole)) return null;
  const normalizedSegment = segment && (segment === 'lux' || segment === 'econom') ? segment : undefined;
  return {
  id,
  username,
  displayName,
  role: (ROLE_ORDER.includes(role as UserRole) ? (role as UserRole) : 'assembler'),
  segment: normalizedSegment,
  passwordHash,
  };
}

function persistUsers() {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersStore));
  } catch (error) {
    console.warn('Failed to persist auth users', error);
  }
  notifySubscribers();
}

function notifySubscribers() {
  userStoreSubscribers.forEach((callback) => {
    try {
      callback();
    } catch (error) {
      console.error('auth user subscriber failed', error);
    }
  });
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent('auth:users-updated'));
  }
}

function ensureLoaded() {
  if (!isBrowser()) {
    return;
  }
  if (syncedWithStorage) {
    return;
  }
  syncedWithStorage = true;
  const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) {
    persistUsers();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map(normalizeUser)
        .filter((user): user is StoredUser => Boolean(user));
      if (normalized.length > 0) {
        usersStore = normalized;
        return;
      }
    }
  } catch (error) {
    console.warn('Failed to parse stored users, falling back to defaults', error);
  }
  usersStore = [...DEFAULT_USERS];
  persistUsers();
}

function sanitizeUser(user: StoredUser): AuthUser {
  const { passwordHash, ...safe } = user;
  return safe;
}
function ensureUniqueUsername(username: string, excludeId?: string) {
  const exists = usersStore.some((user) => user.username.toLowerCase() === username.toLowerCase() && user.id !== excludeId);
  if (exists) {
    throw new Error('USERNAME_EXISTS');
  }
}
function ensureAdminRemains(idToRemove?: string) {
  const adminCount = usersStore.filter((user) => user.role === 'admin' && user.id !== idToRemove).length;
  if (adminCount <= 0) {
    throw new Error('LAST_ADMIN');
  }
}
function generateId() {
  if (isBrowser() && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

export async function authenticate(username: string, password: string): Promise<AuthUser | null> {
  ensureLoaded();
  const user = usersStore.find((u) => u.username === username);
  if (!user) return null;
  if (user.passwordHash !== pseudoHash(password)) return null;
  return sanitizeUser(user);
}

export function listUsers(): AuthUser[] {
  ensureLoaded();
  return cloneUsers(usersStore)
    .map(sanitizeUser)
    .sort((a, b) => a.username.localeCompare(b.username));
}

export function getUserById(id: string): AuthUser | null {
  ensureLoaded();
  const found = usersStore.find((user) => user.id === id);
  return found ? sanitizeUser(found) : null;
}

export function isRole(user: AuthUser | null, role: UserRole) {
  return !!user && user.role === role;
}

export async function createUser(payload: CreateUserPayload): Promise<AuthUser> {
  ensureLoaded();
  const username = payload.username.trim();
  if (username.length < 3) {
    throw new Error('USERNAME_INVALID');
  }
  if (payload.password.length < 6) {
    throw new Error('PASSWORD_WEAK');
  }
  ensureUniqueUsername(username);

  const user: StoredUser = {
    id: generateId(),
    username,
    displayName: payload.displayName.trim() || username,
    role: payload.role,
    segment: payload.segment,
    passwordHash: pseudoHash(payload.password),
  };

  usersStore = [...usersStore, user];
  persistUsers();
  return sanitizeUser(user);
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<AuthUser> {
  ensureLoaded();
  const index = usersStore.findIndex((user) => user.id === id);
  if (index === -1) {
    throw new Error('NOT_FOUND');
  }

  const current = usersStore[index];
  const nextUsername = payload.username ? payload.username.trim() : current.username;
  ensureUniqueUsername(nextUsername, current.id);

  const nextRole = payload.role ?? current.role;
  if (current.role === 'admin' && nextRole !== 'admin') {
    ensureAdminRemains(current.id);
  }

  const updated: StoredUser = {
    ...current,
    username: nextUsername,
    displayName: payload.displayName?.trim() || current.displayName,
    role: nextRole,
    segment: payload.segment ?? current.segment,
  };

  usersStore = usersStore.map((user) => (user.id === id ? updated : user));
  persistUsers();
  return sanitizeUser(updated);
}

export async function deleteUser(id: string): Promise<void> {
  ensureLoaded();
  const exists = usersStore.some((user) => user.id === id);
  if (!exists) {
    throw new Error('NOT_FOUND');
  }
  ensureAdminRemains(id);
  usersStore = usersStore.filter((user) => user.id !== id);
  persistUsers();
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  ensureLoaded();
  if (newPassword.length < 6) {
    throw new Error('PASSWORD_WEAK');
  }
  const index = usersStore.findIndex((user) => user.id === id);
  if (index === -1) {
    throw new Error('NOT_FOUND');
  }
  usersStore[index] = { ...usersStore[index], passwordHash: pseudoHash(newPassword) };
  persistUsers();
}

export async function changePassword(id: string, currentPassword: string, newPassword: string): Promise<boolean> {
  ensureLoaded();
  const index = usersStore.findIndex((user) => user.id === id);
  if (index === -1) {
    throw new Error('NOT_FOUND');
  }
  const user = usersStore[index];
  if (user.passwordHash !== pseudoHash(currentPassword)) {
    return false;
  }
  if (newPassword.length < 6) {
    throw new Error('PASSWORD_WEAK');
  }
  usersStore[index] = { ...user, passwordHash: pseudoHash(newPassword) };
  persistUsers();
  return true;
}

export function subscribeToUserStore(callback: () => void): () => void {
  userStoreSubscribers.add(callback);
  return () => {
    userStoreSubscribers.delete(callback);
  };
}

// Utility for seeding localStorage if needed later
export const DEFAULT_USER_HINT = `Доступные аккаунты:\
nassembler / assembler123\
nassembler-lux / lux123\
nassembler-econom / econom123\
noperator / operator123\
nzavsklad / zavsklad123\
nmanager / manager123\
nadmin / admin123`;
