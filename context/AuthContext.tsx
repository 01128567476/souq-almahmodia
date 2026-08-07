/**
 * AuthContext — Client-side authentication provider.
 *
 * This context manages the client-side auth state by:
 * 1. Fetching session from /api/auth/session on mount
 * 2. Providing login/logout via API calls to /api/auth/login and /api/auth/logout
 * 3. Never storing mock data or fake user objects
 *
 * All user data comes from real API calls.
 * When Auth.js is added, only the API endpoints change — this context stays the same.
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Role } from "@/types";

/** User object returned by the session endpoint. */
interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  phone?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
   logout: () => Promise<void>;
 refreshSession: () => Promise<void>;
}

/** Registration input data. */
export interface RegisterData {
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Fetch the current session from the API.
 * Returns the user data or null if unauthenticated.
 */
async function fetchSession(): Promise<AuthUser | null> {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "include",
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json.data?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Call the login API endpoint.
 * On success, the session cookie is set server-side AND user data is returned.
 */
async function callLogin(email: string, password: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.message ?? "Login failed");
  }

  const data = await response.json();
  if (!data?.data?.user) {
    throw new Error("Login succeeded but user data not received");
  }

  return data.data.user;
}

/**
 * Call the register API endpoint.
 * On success, a session cookie is automatically set.
 */
async function callRegister(data: RegisterData): Promise<void> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.message ?? "Registration failed");
  }
}

/**
 * Call the logout API endpoint.
 *
 * The Auth.js session cookie is HttpOnly, so only the server can clear it —
 * /api/auth/logout does that via signOut(). There is deliberately no
 * client-side document.cookie cleanup here: it cannot touch an HttpOnly
 * cookie, and doing it would only hide a failed server-side sign-out.
 */
async function callLogout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.message ?? "Logout failed");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const sessionUser = await fetchSession();
    setUser(sessionUser);
  }, []);

  // Fetch session on mount and refresh
  useEffect(() => {
    refreshSession().finally(() => {
      setIsLoading(false);
    });
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const sessionUser = await callLogin(email, password);
    setUser(sessionUser);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    await callRegister(data);
    // Refresh session after register (auto-logged in)
    const sessionUser = await fetchSession();
    setUser(sessionUser);
  }, []);

  const logout = useCallback(async () => {
    await callLogout();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    register,
    logout,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}