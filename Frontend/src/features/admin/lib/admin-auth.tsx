import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BASE_URL } from "@/lib/api";

export type AdminSession = { email: string; name: string; role: string };

const STORAGE_KEY = "kcy-admin-session";

type State = {
  admin: AdminSession | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
};

const Ctx = createContext<State | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setAdmin(JSON.parse(raw) as AdminSession);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const value = useMemo<State>(
    () => ({
      admin,
      hydrated,
      signIn: async (email, password) => {
        try {
          const res = await fetch(`${BASE_URL}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { ok: false, error: err.detail ?? "Invalid admin credentials" };
          }
          const session = (await res.json()) as AdminSession;
          setAdmin(session);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          return { ok: true };
        } catch {
          return { ok: false, error: "Network error — check your connection and try again." };
        }
      },
      signOut: () => {
        setAdmin(null);
        window.localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [admin, hydrated],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
}
