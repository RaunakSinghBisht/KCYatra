import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AUTH_PATH, authFetch, type Realm } from "@/lib/auth-client";

type SessionInfo = {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_used_at: string;
  current: boolean;
};

function describeDevice(ua: string | null) {
  if (!ua) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return { label: os ? `${browser} on ${os}` : browser, mobile: /Mobi|Android|iPhone|iPad/.test(ua) };
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function SessionsPanel({
  realm,
  onLogout,
  onLogoutAll,
  afterLogoutAll,
}: {
  realm: Realm;
  /** When given, a plain "Logout" (this device only) button is shown beside "Log out from all devices". */
  onLogout?: () => void;
  onLogoutAll: () => Promise<boolean>;
  afterLogoutAll: () => void;
}) {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [endingAll, setEndingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${AUTH_PATH[realm]}/sessions`, {}, realm);
      if (!res.ok) throw new Error(String(res.status));
      setSessions((await res.json()) as SessionInfo[]);
      setError(false);
    } catch {
      setError(true);
    }
  }, [realm]);

  useEffect(() => {
    void load();
  }, [load]);

  const endSession = async (id: string) => {
    setEndingId(id);
    try {
      const res = await authFetch(`${AUTH_PATH[realm]}/sessions/${id}`, { method: "DELETE" }, realm);
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
      toast.success("That device has been logged out");
    } catch {
      toast.error("Could not log out that device. Please try again.");
    } finally {
      setEndingId(null);
    }
  };

  const endAll = async () => {
    setEndingAll(true);
    const ok = await onLogoutAll();
    setEndingAll(false);
    if (!ok) {
      toast.error("Could not log out all devices. Please try again.");
      return;
    }
    setConfirmAll(false);
    toast.success("Logged out from all devices");
    afterLogoutAll();
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <ShieldCheck className="size-6 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold">Logged-in Devices</h2>
          <p className="truncate text-xs text-muted-foreground">Devices currently signed in to this account</p>
        </div>
      </header>

      <ul className="divide-y divide-border">
        {sessions === null && !error && (
          <li className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading devices…
          </li>
        )}
        {error && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            Could not load devices.{" "}
            <button type="button" onClick={() => void load()} className="font-semibold text-primary underline">
              Retry
            </button>
          </li>
        )}
        {sessions?.map((s) => {
          const device = describeDevice(s.user_agent);
          const Icon = device.mobile ? Smartphone : Monitor;
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  <span className="truncate">{device.label}</span>
                  {s.current && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">
                      This device
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.ip_address ? `${s.ip_address} · ` : ""}Last active {timeAgo(s.last_used_at)}
                </p>
              </div>
              {!s.current && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-destructive"
                  disabled={endingId === s.id}
                  onClick={() => void endSession(s.id)}
                >
                  {endingId === s.id ? <Loader2 className="size-4 animate-spin" /> : "Log out"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        {onLogout && (
          <Button variant="outline" className="flex-1 font-bold sm:flex-none" onClick={onLogout}>
            <LogOut className="size-4" /> Logout
          </Button>
        )}
        <Button
          variant="outline"
          className="flex-1 font-semibold text-destructive sm:flex-none"
          onClick={() => setConfirmAll(true)}
        >
          <LogOut className="size-4" /> Log out from all devices
        </Button>
      </div>

      <AlertDialog open={confirmAll} onOpenChange={(open) => !open && !endingAll && setConfirmAll(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out from all devices?</AlertDialogTitle>
            <AlertDialogDescription>
              Every device signed in to this account will be logged out immediately, including this one. You will
              need to log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={endingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void endAll();
              }}
              disabled={endingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {endingAll ? "Logging out…" : "Log out everywhere"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
