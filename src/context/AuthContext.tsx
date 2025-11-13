import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContextValue, AuthUser, ROLE_ORDER, UserRole, CreateUserPayload, UpdateUserPayload } from '../types/auth';
import {
  authenticate,
  listUsers as authListUsers,
  createUser as authCreateUser,
  updateUser as authUpdateUser,
  deleteUser as authDeleteUser,
  resetUserPassword as authResetUserPassword,
  changePassword as authChangePassword,
  subscribeToUserStore,
  getUserById as authGetUserById,
} from '../lib/auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const LS_KEY = 'auth_user_v1';
const USERS_STORAGE_KEY = 'auth_users_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [usersRevision, setUsersRevision] = useState(0);
  const [jwtExp, setJwtExp] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Restore session
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsReady(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) {
        setUser(JSON.parse(raw));
      }
      const expRaw = window.localStorage.getItem('jwt_exp');
      if (expRaw) {
        const expNum = Number(expRaw);
        if (!isNaN(expNum)) setJwtExp(expNum);
      }
    } catch (error) {
      console.warn('Auth session restore failed', error);
    } finally {
      setIsReady(true);
    }
  }, []);

  // Monitor remaining time
  useEffect(() => {
    if (!jwtExp) { setRemainingSec(null); return; }
    const update = () => {
      const nowSec = Math.floor(Date.now()/1000);
      const rem = jwtExp - nowSec;
      setRemainingSec(rem >= 0 ? rem : 0);
      // Auto logout when expired
      if (rem <= 0) {
        // локальный логаут, без зависимости от logout
        setUser(null);
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(LS_KEY);
            window.localStorage.removeItem('jwt_token');
            window.localStorage.removeItem('jwt_exp');
          }
        } catch {}
        setJwtExp(null);
        setRemainingSec(null);
      }
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [jwtExp]);

  // Schedule proactive refresh 2 minutes before expiry if > 10 minutes token
  // We define refreshToken later; use a separate effect after its definition

  // Cross-tab sync
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LS_KEY) return;
      if (!event.newValue) {
        setUser(null);
        return;
      }
      try {
        const nextUser = JSON.parse(event.newValue) as AuthUser;
        setUser(nextUser);
      } catch (error) {
        console.warn('Failed to parse auth payload from storage', error);
      }
    };

    if (typeof window === 'undefined') return undefined;

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await authenticate(username, password);
    if (u) {
      setUser(u);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(LS_KEY, JSON.stringify(u));
        } catch (error) {
          console.warn('Persisting auth user failed', error);
        }
      }
      return true;
    }
    return false;
  }, []);

  const loginJwt = useCallback(async (username: string, password: string, role: UserRole) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.token && data.role) {
        const u: AuthUser = { id: username, username, displayName: username, role: data.role };
        setUser(u);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(LS_KEY, JSON.stringify(u));
            window.localStorage.setItem('jwt_token', data.token);
            window.localStorage.setItem('jwt_exp', String(data.exp || ''));
          } catch (error) {
            console.warn('Persisting jwt user failed', error);
          }
        }
        if (data.exp) setJwtExp(data.exp);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('loginJwt error', e);
      return false;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('jwt_token') : null;
      if (!token) return false;
      const res = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
      if (!res.ok) return false;
      const data = await res.json();
      if (data.token && data.exp) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('jwt_token', data.token);
          window.localStorage.setItem('jwt_exp', String(data.exp));
        }
        setJwtExp(data.exp);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('refreshToken error', e);
      return false;
    }
  }, []);

  // Schedule proactive refresh 2 minutes before expiry if > 10 minutes token
  useEffect(() => {
    if (!jwtExp) return;
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    const nowSec = Math.floor(Date.now()/1000);
    const rem = jwtExp - nowSec;
    if (rem > 600) { // only if long enough
      const refreshDelay = (rem - 120) * 1000; // 2 min before expiry
      logoutTimerRef.current = window.setTimeout(async () => {
        await refreshToken();
      }, refreshDelay);
    }
  }, [jwtExp, refreshToken]);

  const logout = useCallback(() => {
    setUser(null);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LS_KEY);
        window.localStorage.removeItem('jwt_token');
        window.localStorage.removeItem('jwt_exp');
      } catch (error) {
        console.warn('Clearing auth session failed', error);
      }
    }
    setJwtExp(null);
    setRemainingSec(null);
  }, []);

  const hasRole = useCallback((roles: UserRole | UserRole[]) => {
    if (!user) return false;
    const arr = Array.isArray(roles) ? roles : [roles];
    return arr.some(r => ROLE_ORDER.indexOf(user.role) >= ROLE_ORDER.indexOf(r));
  }, [user]);

  const syncActiveUser = useCallback(() => {
    const current = userRef.current;
    if (!current) return;
    const latest = authGetUserById(current.id);
    if (!latest) {
      logout();
      return;
    }
    setUser(latest);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(latest));
      } catch (error) {
        console.warn('Persisting auth user failed', error);
      }
    }
  }, [logout]);

  useEffect(() => {
    const handleUsersChanged = () => {
      setUsersRevision(prev => prev + 1);
      syncActiveUser();
    };

    const unsubscribe = subscribeToUserStore(handleUsersChanged);

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:users-updated', handleUsersChanged);
      const handleStorageUsers = (event: StorageEvent) => {
        if (event.key === USERS_STORAGE_KEY) {
          handleUsersChanged();
        }
      };
      window.addEventListener('storage', handleStorageUsers);
      return () => {
        unsubscribe();
        window.removeEventListener('auth:users-updated', handleUsersChanged);
        window.removeEventListener('storage', handleStorageUsers);
      };
    }

    return () => {
      unsubscribe();
    };
  }, [syncActiveUser]);

  const listUsers = useCallback(() => authListUsers(), [usersRevision]);

  const createUser = useCallback(async (payload: CreateUserPayload) => {
    const created = await authCreateUser(payload);
    syncActiveUser();
    return created;
  }, [syncActiveUser]);

  const updateUser = useCallback(async (id: string, payload: UpdateUserPayload) => {
    const updated = await authUpdateUser(id, payload);
    syncActiveUser();
    return updated;
  }, [syncActiveUser]);

  const deleteUser = useCallback(async (id: string) => {
    await authDeleteUser(id);
    if (userRef.current?.id === id) {
      logout();
    } else {
      syncActiveUser();
    }
  }, [logout, syncActiveUser]);

  const resetUserPassword = useCallback(async (id: string, newPassword: string) => {
    await authResetUserPassword(id, newPassword);
    if (userRef.current?.id === id) {
      syncActiveUser();
    }
  }, [syncActiveUser]);

  const changeOwnPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = userRef.current;
    if (!current) {
      throw new Error('NOT_AUTHENTICATED');
    }
    const success = await authChangePassword(current.id, currentPassword, newPassword);
    if (success) {
      syncActiveUser();
    }
    return success;
  }, [syncActiveUser]);

  return (
    <AuthContext.Provider value={{
      user,
  login,
  loginJwt,
      logout,
      hasRole,
      listUsers,
      createUser,
      updateUser,
      deleteUser,
      resetUserPassword,
      changeOwnPassword,
  isReady,
  refreshToken,
  jwtExp,
  remainingSec,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
