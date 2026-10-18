import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Compass, Mail, MessageCircle, Phone, Receipt, UserRound } from "lucide-react";
import { useYatraAuth } from "@/lib/yatra-auth";
import { DashboardTabBar } from "@/components/DashboardTabBar";

const tabs = [
  { to: "/dashboard", label: "Notice", icon: Bell },
  { to: "/select-yatra", label: "Select Yatra", icon: Compass },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/personal-details", label: "You", icon: UserRound },
] as const;

const contacts = [
  { href: "mailto:krishna.con.yatra@gmail.com", icon: Mail, label: "krishna.con.yatra@gmail.com" },
  { href: "tel:+917020391800", icon: Phone, label: "+91 70203 91800" },
  { href: "https://wa.me/918796976009", icon: MessageCircle, label: "WhatsApp" },
] as const;

export function DashboardShell({ children }: { children: (user: NonNullable<ReturnType<typeof useYatraAuth>["user"]>) => ReactNode }) {
  const { user, hydrated } = useYatraAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !user) navigate({ to: "/auth" });
  }, [hydrated, user, navigate]);

  if (!hydrated || !user) {
    return <main className="p-8 text-center text-sm text-muted-foreground">Loading…</main>;
  }

  return (
    <>
      {/* ── Fixed desktop sidebar ── */}
      <aside className="fixed left-0 top-[60px] hidden h-[calc(100vh-60px)] w-56 flex-col border-r border-border bg-card shadow-sm lg:flex">
        {/* Nav links */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Menu
          </p>
          <nav className="flex flex-col gap-0.5">
            {tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-gradient-primary text-primary-foreground shadow-glow" }}
                inactiveProps={{ className: "text-muted-foreground hover:bg-accent hover:text-accent-foreground" }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
              >
                <t.icon className="size-[1.05rem] shrink-0" />
                <span>{t.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Contact strip */}
        <div className="border-t border-border px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Contact Us
          </p>
          <div className="flex flex-col gap-0.5">
            {contacts.map((c) => (
              <a
                key={c.href}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noreferrer" : undefined}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow">
                  <c.icon className="size-3.5" />
                </span>
                <span className="truncate text-xs text-muted-foreground/70">{c.label}</span>
              </a>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Page content offset by sidebar width on desktop ── */}
      <div className="min-h-[calc(100vh-60px)] bg-muted/30 lg:pl-56">
        <main className="px-4 py-5 pb-28 sm:px-6 sm:py-6 sm:pb-32 lg:pb-8">
          {children(user)}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <DashboardTabBar />
    </>
  );
}
