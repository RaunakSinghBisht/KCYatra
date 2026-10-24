import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BASE_URL } from "@/lib/api";
import {
  authFetch,
  clearAccessToken,
  onSessionEnded,
  refreshSession,
  setAccessToken,
} from "@/lib/auth-client";

export type YatraUser = { user_id: number; phone: string; name: string };

/** What /otp/verify and /otp/direct-login return on success. */
export type UserLogin = { user_id: number; phone: string; access_token: string; expires_in: number };

type AuthState = {
  user: YatraUser | null;
  hydrated: boolean;
  signIn: (login: UserLogin) => void;
  /** Log out this device. */
  signOut: () => void;
  /** Log out every device signed in to this account. Returns false if the server refused. */
  signOutAll: () => Promise<boolean>;
};

const LEGACY_STORAGE_KEY = "yatra-book-user";

const toUser = (u: { user_id: number; phone: string }): YatraUser => ({
  user_id: u.user_id,
  phone: u.phone,
  name: u.phone,
});

const AuthContext = createContext<AuthState | null>(null);

export function YatraAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<YatraUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY); // pre-JWT session format
    } catch {
      /* ignore */
    }
    const off = onSessionEnded("user", () => setUser(null));
    // Restore the session from the HttpOnly refresh cookie, if there is one.
    refreshSession("user")
      .then((data) => {
        if (data?.user) setUser(toUser(data.user));
      })
      .finally(() => setHydrated(true));
    return off;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      hydrated,
      signIn: (login) => {
        setAccessToken("user", login.access_token, login.expires_in);
        setUser(toUser(login));
      },
      signOut: () => {
        clearAccessToken("user");
        setUser(null);
        void fetch(`${BASE_URL}/auth/logout`, { method: "POST", credentials: "include", keepalive: true }).catch(
          () => {},
        );
      },
      signOutAll: async () => {
        const res = await authFetch("/auth/logout-all", { method: "POST", credentials: "include" }, "user");
        if (!res.ok && res.status !== 401) return false;
        clearAccessToken("user");
        setUser(null);
        return true;
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
