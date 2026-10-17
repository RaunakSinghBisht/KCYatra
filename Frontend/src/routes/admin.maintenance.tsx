import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Construction, Eye } from "lucide-react";
import { AdminShell } from "@/features/admin/components/AdminShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/admin/maintenance")({
  head: () => ({
    meta: [
      { title: "Dam Page — Krishna Conscious Yatra Admin" },
      { name: "description", content: "Show a maintenance message that stops visitors on the website." },
      { property: "og:title", content: "Dam Page — Krishna Conscious Yatra Admin" },
      { property: "og:description", content: "Show a maintenance message that stops visitors on the website." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminMaintenance,
});

type DamPageSettings = { enabled: boolean; title: string; description: string };

const DEFAULT: DamPageSettings = {
  enabled: false,
  title: "Website Under Maintenance",
  description:
    "We are performing scheduled maintenance to serve you better. Please check back in a little while. Hare Krishna!",
};

async function apiFetch(body: Partial<DamPageSettings>) {
  const res = await fetch(`${BASE_URL}/dam-page/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Save failed");
  }
  return res.json() as Promise<DamPageSettings & { id: number }>;
}

function AdminMaintenance() {
  const [settings, setSettings] = useState<DamPageSettings>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/dam-page/`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: DamPageSettings) => setSettings({ enabled: data.enabled, title: data.title, description: data.description }))
      .catch(() => toast.error("Failed to load Dam Page settings"));
  }, []);

  const persist = useCallback((patch: Partial<DamPageSettings>, immediate = false) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = immediate ? 0 : 600;
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await apiFetch(patch);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, delay);
  }, []);

  const toggle = (on: boolean) => {
    const next = { ...settings, enabled: on };
    setSettings(next);
    persist({ enabled: on }, true);
    toast.success(on ? "Dam Page is ON — visitors see the maintenance message" : "Dam Page is OFF — website is live");
  };

  const onTitle = (value: string) => {
    setSettings((s) => ({ ...s, title: value }));
    persist({ title: value });
  };

  const onDescription = (value: string) => {
    setSettings((s) => ({ ...s, description: value }));
    persist({ description: value });
  };

  const { enabled, title, description } = settings;

  return (
    <AdminShell
      title="Dam Page"
      description="Show a maintenance message with a Back to Home button on the login (OTP) page only."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">Dam Page is {enabled ? "ON" : "OFF"}</p>
              <p className="text-xs text-muted-foreground">
                {enabled ? "Visitors are blocked and see your message." : "Website is open to visitors."}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={toggle} aria-label="Toggle Dam Page" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dam-title">Title</Label>
            <Input
              id="dam-title"
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              placeholder="Website Under Maintenance"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dam-desc">Description</Label>
            <Textarea
              id="dam-desc"
              value={description}
              onChange={(e) => onDescription(e.target.value)}
              placeholder="We are performing scheduled maintenance…"
              rows={4}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {saving ? "Saving…" : "Changes save automatically."}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Eye className="size-3.5" /> Visitor preview
          </p>
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Construction className="size-7" />
            </span>
            <h2 className="mt-4 text-xl font-extrabold tracking-tight">{title || DEFAULT.title}</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {description || DEFAULT.description}
            </p>
            <span className="mt-5 inline-flex items-center justify-center rounded-full bg-gradient-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-glow">
              Back to Home
            </span>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
