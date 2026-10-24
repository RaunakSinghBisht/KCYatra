import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Construction,
  Images,
  LogOut,
  Menu,
  MountainSnow,
  Receipt,
  ShieldCheck,
  Users,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAdminAuth } from "@/features/admin/lib/admin-auth";

const nav = [
  { to: "/admin224151/users", label: "Users", icon: Users },
  { to: "/admin224151/bookings", label: "Bookings & Payments", icon: Receipt },
  { to: "/admin224151/yatras", label: "Yatra Packages", icon: MountainSnow },
  { to: "/admin224151/notices", label: "Notices", icon: Bell },
  { to: "/admin224151/carousel", label: "Carousel Manager", icon: Images },
  { to: "/admin224151/youtube", label: "YouTube Links", icon: Youtube },
  { to: "/admin224151/maintenance", label: "Dam Page", icon: Construction },
  { to: "/admin224151/sessions", label: "Sessions", icon: ShieldCheck },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onNavigate}
          activeProps={{ className: "bg-gradient-primary text-primary-foreground shadow-glow" }}
          inactiveProps={{ className: "text-muted-foreground hover:bg-accent hover:text-foreground" }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
        >
          <n.icon className="size-4 shrink-0" />
          <span className="truncate">{n.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const { admin, hydrated, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !admin) navigate({ to: "/admin224151/login" });
  }, [hydrated, admin, navigate]);

  if (!hydrated || !admin) {
    return <main className="p-10 text-center text-sm text-muted-foreground">Loading admin…</main>;
  }

  return (
    <AdminShellInner
      title={title}
      description={description}
      actions={actions}
      admin={admin}
      signOut={signOut}
      open={open}
      setOpen={setOpen}
      navigate={navigate}
    >
      {children}
    </AdminShellInner>
  );
}

function AdminShellInner({
  title,
  description,
  actions,
  children,
  admin,
  signOut,
  open,
  setOpen,
  navigate,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  admin: { name: string; role: string };
  signOut: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {

  return (
    <div className="min-h-[calc(100vh-61px)] bg-muted/30">
      <div className="flex gap-6 px-3 py-4 sm:px-6 sm:py-6">
        <aside className="sticky top-[calc(61px+1rem)] hidden h-[calc(100vh-61px-2rem)] w-64 shrink-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-soft lg:flex">
          <div className="flex items-center gap-2 px-1 pb-4">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <MountainSnow className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">Admin Panel</p>
              <p className="truncate text-xs text-muted-foreground">{admin.role}</p>
            </div>
          </div>
          <NavLinks />
          <div className="mt-auto space-y-2 pt-4">
            <Button asChild variant="outline" size="sm" className="w-full font-semibold">
              <Link to="/">View website</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full font-semibold text-destructive"
              onClick={() => {
                signOut();
                navigate({ to: "/admin224151/login" });
              }}
            >
              <LogOut className="size-4" /> Logout
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild className="lg:hidden">
                    <Button variant="outline" size="icon" aria-label="Open admin menu">
                      <Menu className="size-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[82vw] max-w-xs">
                    <SheetTitle className="px-1 text-base">Admin Panel</SheetTitle>
                    <div className="mt-4">
                      <NavLinks onNavigate={() => setOpen(false)} />
                      <Button
                        variant="outline"
                        className="mt-4 w-full font-semibold text-destructive"
                        onClick={() => {
                          signOut();
                          setOpen(false);
                          navigate({ to: "/admin224151/login" });
                        }}
                      >
                        <LogOut className="size-4" /> Logout
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
                <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
              </div>
              {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div> : null}
          </div>

          <div className="mt-5 space-y-5 pb-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function ExportButtons({ onCsv, onExcel }: { onCsv: () => void; onExcel: () => void }) {
  return (
    <>
      <Button variant="outline" size="sm" className="font-semibold" onClick={onCsv}>
        Export CSV
      </Button>
      <Button variant="outline" size="sm" className="font-semibold" onClick={onExcel}>
        Export Excel
      </Button>
    </>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
