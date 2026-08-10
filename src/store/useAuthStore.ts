import { create } from 'zustand';
import { apiFetch, ApiError } from '../api/client';

export interface AuthUser {
  id: string;
  username: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

const TOKEN_STORAGE_KEY = 'tabula.auth.token';
const USER_STORAGE_KEY = 'tabula.auth.user';

function loadPersisted(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    return { token, user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null };
  } catch {
    return { token: null, user: null };
  }
}

function persist(token: string | null, user: AuthUser | null) {
  try {
    if (token && user) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (private browsing, quota) — session just won't survive a reload.
  }
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  register: (username: string, password: string) => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

async function submit(path: '/auth/register' | '/auth/login', username: string, password: string) {
  return apiFetch<TokenResponse>(path, { method: 'POST', body: { username, password } });
}

export const useAuthStore = create<AuthStore>((set) => {
  const persisted = loadPersisted();
  return {
    token: persisted.token,
    user: persisted.user,
    loading: false,
    error: null,

    register: async (username, password) => {
      set({ loading: true, error: null });
      try {
        const res = await submit('/auth/register', username, password);
        persist(res.access_token, res.user);
        set({ token: res.access_token, user: res.user, loading: false });
        return true;
      } catch (err) {
        set({ loading: false, error: err instanceof ApiError ? err.message : 'Falha ao criar conta.' });
        return false;
      }
    },

    login: async (username, password) => {
      set({ loading: true, error: null });
      try {
        const res = await submit('/auth/login', username, password);
        persist(res.access_token, res.user);
        set({ token: res.access_token, user: res.user, loading: false });
        return true;
      } catch (err) {
        set({ loading: false, error: err instanceof ApiError ? err.message : 'Falha ao entrar.' });
        return false;
      }
    },

    logout: () => {
      persist(null, null);
      set({ token: null, user: null, error: null });
    },

    clearError: () => set({ error: null }),
  };
});
