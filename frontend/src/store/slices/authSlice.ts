import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserResponse } from "@/types/api";

const STORAGE_KEY = "et.auth";

export interface AuthState {
  token: string | null;
  /** epoch ms; null when unknown - there is no refresh token, expiry drives re-login */
  expiresAt: number | null;
  user: UserResponse | null;
}

function loadPersisted(): AuthState {
  if (typeof window === "undefined") {
    return { token: null, expiresAt: null, user: null };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, expiresAt: null, user: null };
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.token) return { token: null, expiresAt: null, user: null };
    return {
      token: parsed.token,
      expiresAt: parsed.expiresAt ?? null,
      user: parsed.user ?? null,
    };
  } catch {
    return { token: null, expiresAt: null, user: null };
  }
}

function persist(state: AuthState) {
  if (typeof window === "undefined") return;
  if (!state.token) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ token: state.token, expiresAt: state.expiresAt, user: state.user }),
  );
}

const initialState: AuthState = loadPersisted();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        token: string;
        expiresInMs: number;
        user?: UserResponse | null;
      }>,
    ) {
      state.token = action.payload.token;
      state.expiresAt = Date.now() + action.payload.expiresInMs;
      if (action.payload.user) state.user = action.payload.user;
      persist(state);
    },
    setUser(state, action: PayloadAction<UserResponse>) {
      state.user = action.payload;
      persist(state);
    },
    logout(state) {
      state.token = null;
      state.expiresAt = null;
      state.user = null;
      persist(state);
    },
  },
});

export default authSlice.reducer;
export const { setCredentials, setUser, logout } = authSlice.actions;

// --- selectors (take the auth slice) ---------------------------------------

export function selectToken(state: AuthState): string | null {
  return state.token;
}

export function selectUser(state: AuthState): UserResponse | null {
  return state.user;
}

export function selectIsAuthenticated(state: AuthState): boolean {
  if (!state.token) return false;
  if (state.expiresAt !== null && Date.now() >= state.expiresAt) return false;
  return true;
}
