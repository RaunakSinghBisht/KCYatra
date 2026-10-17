import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AdminSession = { email: string; name: string; role: string };

const STORAGE_KEY = "kcy-admin-session";

export const DEMO_ADMIN = {
  email: "admin@krishnaconsciousyatra.com",
  password: "yatra@123",
  name: "Yatra Admin",
  role: "Super Admin",
};

type State = {
  admin: AdminSession | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => boolean;
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
      signIn: (email, password) => {
        if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) return false;
        const session = { email: DEMO_ADMIN.email, name: DEMO_ADMIN.name, role: DEMO_ADMIN.role };
        setAdmin(session);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        return true;
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
