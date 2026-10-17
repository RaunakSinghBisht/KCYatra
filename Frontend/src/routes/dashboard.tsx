import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Important Notices — Krishna Conscious Yatra" },
      { name: "description", content: "Latest admin notices and important updates for your yatra." },
      { property: "og:title", content: "Important Notices — Krishna Conscious Yatra" },
      { property: "og:description", content: "Latest admin notices and important updates for your yatra." },
    ],
  }),
  component: Dashboard,
});

type BackendNotice = {
  id: number;
  title: string;
  body: string;
  sender_name: string;
  tag: string;
  is_published: boolean;
  created_at: string;
};

async function fetchLiveNotices(): Promise<BackendNotice[]> {
  const res = await fetch(`${BASE_URL}/notices/?published_only=true`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to load notices");
  }
  return res.json();
}

const colorStyles: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  "chart-3": "bg-chart-3 text-white",
};

function initials(name: string) {
  return (name || "Admin")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.split("T")[0] ?? iso;
  }
}

function Dashboard() {
  const {
    data: notices = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-notices"],
    queryFn: fetchLiveNotices,
  });

  return (
    <DashboardShell>
      {() => (
        <section>
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <Bell className="size-7 text-primary" /> Important Notices
            </h1>
            {isLoading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          </div>

          <div className="mt-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-3 text-sm">Loading notices…</p>
              </div>
            ) : isError ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive">
                <p className="font-semibold">Failed to load notices from server.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
                  Try again
                </Button>
              </div>
            ) : notices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
                <Bell className="mx-auto size-10 text-muted-foreground/50" />
                <h3 className="mt-3 text-base font-bold text-foreground">No notices yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Important updates, schedules, and announcements will appear here once published by the organizers.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {notices.map((n, i) => {
                  const colorKey = i % 2 === 0 ? "primary" : "chart-3";
                  return (
                    <div key={n.id} className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold shadow-soft",
                          colorStyles[colorKey] ?? colorStyles["primary"]
                        )}
                      >
                        {initials(n.sender_name)}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{n.sender_name}</span>
                          {n.tag && (
                            <Badge variant="secondary" className="text-[10px]">
                              {n.tag}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(n.created_at)}
                          </span>
                        </div>
                        <div className="mt-0.5 w-fit max-w-[92%] rounded-2xl rounded-tl-none border border-border bg-card p-3.5 text-sm leading-relaxed text-foreground shadow-soft">
                          <p className="font-semibold text-foreground">{n.title}</p>
                          <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{n.body}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
