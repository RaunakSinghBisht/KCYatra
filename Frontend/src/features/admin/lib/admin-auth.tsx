import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { BASE_URL } from "@/lib/api";
import {
  authFetch,
  clearAccessToken,
  onSessionEnded,
  realmForPath,
  refreshSession,
  setAccessToken,
} from "@/lib/auth-client";

export type AdminSession = { email: string; name: string; role: string };

type State = {
  admin: AdminSession | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  /** Log out this device. */
  signOut: () => void;
  /** Log out every device signed in as admin. Returns false if the server refused. */
  signOutAll: () => Promise<boolean>;
};

const LEGACY_STORAGE_KEY = "kcy-admin-session";

const Ctx = createContext<State | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pathname = useRouterState({ select: (s) => s?.location?.pathname ?? "" });
  const inAdminArea = realmForPath(pathname) === "admin";
  const restoreStarted = useRef(false);

  useEffect(() => onSessionEnded("admin", () => setAdmin(null)), []);

  // Restore the admin session only once someone actually opens the admin panel.
  useEffect(() => {
    if (!inAdminArea || restoreStarted.current) return;
    restoreStarted.current = true;
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY); // pre-JWT session format
    } catch {
      /* ignore */
    }
    refreshSession("admin")
      .then((data) => {
        if (data?.admin) setAdmin(data.admin);
      })
      .finally(() => setHydrated(true));
  }, [inAdminArea]);

  const value = useMemo<State>(
    () => ({
      admin,
      hydrated,
      signIn: async (email, password) => {
        try {
          const res = await fetch(`${BASE_URL}/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false, error: data.detail ?? "Invalid admin credentials" };
          setAccessToken("admin", data.access_token, data.expires_in);
          setAdmin(data.admin as AdminSession);
          setHydrated(true);
          return { ok: true };
        } catch {
          return { ok: false, error: "Network error — check your connection and try again." };
        }
      },
      signOut: () => {
        clearAccessToken("admin");
        setAdmin(null);
        void fetch(`${BASE_URL}/admin/auth/logout`, { method: "POST", credentials: "include", keepalive: true }).catch(
          () => {},
        );
      },
      signOutAll: async () => {
        const res = await authFetch("/admin/auth/logout-all", { method: "POST", credentials: "include" }, "admin");
        if (!res.ok && res.status !== 401) return false;
        clearAccessToken("admin");
        setAdmin(null);
        return true;
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
