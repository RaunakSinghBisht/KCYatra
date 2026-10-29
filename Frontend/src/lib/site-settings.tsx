import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BASE_URL } from "@/lib/api";

export type SiteSettings = {
  enabled: boolean;
  title: string;
  description: string;
  otp_enabled: boolean;
  accept_payments: boolean;
};

// How often every open tab re-checks the Dam Page / payment toggles.
const POLL_MS = 5_000;

const SiteSettingsContext = createContext<SiteSettings | null>(null);

/** Keeps the Dam Page and payment toggles fresh for logged-in users without a page refresh. */
export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`${BASE_URL}/dam-page/`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: SiteSettings) => {
          if (alive) setSettings(data);
        })
        .catch(() => { /* keep the last known settings */ });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, []);

  return <SiteSettingsContext.Provider value={settings}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings(): SiteSettings | null {
  return useContext(SiteSettingsContext);
}
