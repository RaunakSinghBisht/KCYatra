import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type YatraUser = { phone: string; name: string };

const STORAGE_KEY = "yatra-book-user";

type AuthState = {
  user: YatraUser | null;
  hydrated: boolean;
  signIn: (user: YatraUser) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function YatraAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<YatraUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as YatraUser);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      hydrated,
      signIn: (next) => {
        setUser(next);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
      signOut: () => {
        setUser(null);
        window.localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [user, hydrated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useYatraAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useYatraAuth must be used inside YatraAuthProvider");
  return ctx;
}
