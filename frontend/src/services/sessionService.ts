import { api, ApiError, sessionKey } from './api';
import type { User } from '../types/soc';

export async function loginUser(credentials: Record<string, string>): Promise<User> {
  const user = await api<User>('auth/login', credentials);
  sessionStorage.setItem(sessionKey, user.id);
  return user;
}

export async function logoutUser(): Promise<void> {
  try {
    await api('auth/logout', {});
  } finally {
    sessionStorage.removeItem(sessionKey);
  }
}

export function isCurrentSession(userId: string): boolean {
  return sessionStorage.getItem(sessionKey) === userId;
}

export function hasSession(): boolean {
  return !!sessionStorage.getItem(sessionKey);
}

export function clearSession(): void {
  sessionStorage.removeItem(sessionKey);
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export async function restoreUser(): Promise<User | null> {
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  const previousUserId = sessionStorage.getItem(sessionKey);

  // Only reloads of an explicitly signed-in tab restore the cookie session.
  if (previousUserId && navigation?.type === 'reload') {
    const user = await api<User>('auth/me');
    if (user.id === previousUserId) return user;
  }

  // A new tab must not sign out an existing authenticated tab.
  clearSession();
  return null;
}

export function currentUser(): Promise<User> {
  return api<User>('auth/me');
}
