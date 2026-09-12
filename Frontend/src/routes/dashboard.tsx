import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { notices } from "@/lib/yatra-data";
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

const colorStyles: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  "chart-3": "bg-chart-3 text-white",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Dashboard() {
  const adminNotices = notices.filter((n) => n.author === "admin");

  return (
    <DashboardShell>
      {() => (
        <section>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Bell className="size-7 text-primary" /> Important Notices
          </h1>

          <div className="mt-6 space-y-5">
            {adminNotices.map((n) => (
              <div key={n.id} className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold shadow-soft",
                    colorStyles[n.senderColor] ?? colorStyles["primary"]
                  )}
                >
                  {initials(n.senderName)}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-bold text-foreground">{n.senderName}</span>
                  <div className="mt-0.5 w-fit max-w-[92%] rounded-2xl rounded-tl-none border border-border bg-card p-3.5 text-sm leading-relaxed text-foreground shadow-soft">
                    <p className="font-semibold">{n.title}</p>
                    <p className="mt-1 text-muted-foreground">{n.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
