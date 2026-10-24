/**
 * Token handling for both sign-ins (customer "user" and "admin").
 *
 * - The access token lives only in memory (never localStorage), so a page reload restores the
 *   session by calling /refresh, which uses the HttpOnly refresh cookie the server set at login.
 * - authFetch() attaches the access token, refreshes it shortly before it expires, and on a 401
 *   refreshes once and retries. If refreshing fails the session is over and listeners are told.
 */
import { BASE_URL } from "@/lib/api";

export type Realm = "user" | "admin";

export const AUTH_PATH: Record<Realm, string> = { user: "/auth", admin: "/admin/auth" };

type StoredToken = { token: string; expiresAt: number };

const tokens: Record<Realm, StoredToken | null> = { user: null, admin: null };
const inflight: Partial<Record<Realm, Promise<RefreshResult | null>>> = {};
const endedListeners: Record<Realm, Set<() => void>> = { user: new Set(), admin: new Set() };

export type RefreshResult = {
  access_token: string;
  expires_in: number;
  user?: { user_id: number; phone: string };
  admin?: { email: string; name: string; role: string };
};

export function realmForPath(pathname: string): Realm {
  return pathname.startsWith("/admin224151") ? "admin" : "user";
}

function currentRealm(): Realm {
  return typeof window === "undefined" ? "user" : realmForPath(window.location.pathname);
}

export function setAccessToken(realm: Realm, token: string, expiresInSeconds: number) {
  tokens[realm] = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
}

export function clearAccessToken(realm: Realm) {
  tokens[realm] = null;
}

export function hasAccessToken(realm: Realm) {
  return tokens[realm] !== null;
}

export function onSessionEnded(realm: Realm, listener: () => void) {
  endedListeners[realm].add(listener);
  return () => {
    endedListeners[realm].delete(listener);
  };
}

function endSession(realm: Realm) {
  clearAccessToken(realm);
  endedListeners[realm].forEach((fn) => fn());
}

/** Exchange the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(realm: Realm): Promise<RefreshResult | null> {
  const pending = inflight[realm];
  if (pending) return pending;

  const request = (async () => {
    try {
      const res = await fetch(`${BASE_URL}${AUTH_PATH[realm]}/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        clearAccessToken(realm);
        return null;
      }
      const data = (await res.json()) as RefreshResult;
      setAccessToken(realm, data.access_token, data.expires_in);
      return data;
    } catch {
      return null;
    } finally {
      delete inflight[realm];
    }
  })();
  inflight[realm] = request;
  return request;
}

/**
 * fetch() for our API. `input` may be a full URL or a path like "/passengers/".
 * The sign-in used is picked from the current page (admin pages → admin) unless given.
 */
export async function authFetch(input: string, init: RequestInit = {}, realm: Realm = currentRealm()) {
  const url = input.startsWith("http") ? input : `${BASE_URL}${input}`;
  const send = (token: string | undefined) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };

  const wasSignedIn = tokens[realm] !== null;
  let stored = tokens[realm];
  if (stored && stored.expiresAt - Date.now() < 30_000) {
    await refreshSession(realm);
    stored = tokens[realm];
  }

  const res = await send(stored?.token);
  if (res.status !== 401) return res;

  const refreshed = await refreshSession(realm);
  if (!refreshed) {
    if (wasSignedIn) endSession(realm); // session expired or was logged out from another device
    return res;
  }
  return send(tokens[realm]?.token);
}
