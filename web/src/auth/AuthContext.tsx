import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { AuthUser, UserRole } from "../api";
import * as api from "../api";

interface AuthState {
  user: AuthUser | null;
  setupMode: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api.getMe();
      if ("setupMode" in result && result.setupMode) {
        setUser(null);
        setSetupMode(true);
      } else {
        setUser(result as AuthUser);
        setSetupMode(false);
      }
    } catch {
      setUser(null);
      setSetupMode(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const loggedIn = await api.login(username, password);
    setUser(loggedIn);
    setSetupMode(false);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setupMode, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useCanEdit(): boolean {
  const { user } = useAuth();
  return user?.role === "groundskeeper" || user?.role === "gardener";
}

export function useIsGroundskeeper(): boolean {
  const { user } = useAuth();
  return user?.role === "groundskeeper";
}

const ROLE_LABELS: Record<UserRole, string> = {
  groundskeeper: "Groundskeeper",
  gardener: "Gardener",
  helper: "Helper",
};

export function roleName(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}
