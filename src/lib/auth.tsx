/**
 * Contexto de autenticación para Multimarket.
 *
 * Flujo:
 *  1. POST /auth/login  → guarda token + usuario en localStorage
 *  2. GET /auth/me      → restaura sesión al recargar la página
 *  3. POST /auth/logout → limpia estado local
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

const API_URL =
  (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "multimarket.token";
const USER_KEY = "multimarket.user";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (
    username: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// ─── helpers de storage ──────────────────────────────────────────────────────
function saveSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function loadSession(): { token: string; user: AuthUser } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return { token, user: JSON.parse(raw) as AuthUser };
  } catch {
    return null;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Restaura la sesión guardada al montar */
  useEffect(() => {
    const saved = loadSession();
    if (!saved) {
      setLoading(false);
      return;
    }

    // Verifica que el token siga siendo válido contra el backend
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${saved.token}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const me = (await res.json()) as AuthUser;
          setUser(me);
        } else {
          clearSession();
        }
      })
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  const login: AuthCtx["login"] = useCallback(async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        let msg = "Credenciales incorrectas";
        try {
          const body = await res.json();
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          // sin cuerpo JSON
        }
        return { ok: false, error: msg };
      }

      const data = (await res.json()) as {
        access_token: string;
        user: AuthUser;
      };
      saveSession(data.access_token, data.user);
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo conectar con el servidor" };
    }
  }, []);

  const logout: AuthCtx["logout"] = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      try {
        await fetch(`${API_URL}/api/auth/logout?token=${encodeURIComponent(token)}`, {
          method: "POST",
        });
      } catch {
        // best-effort
      }
    }
    clearSession();
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
