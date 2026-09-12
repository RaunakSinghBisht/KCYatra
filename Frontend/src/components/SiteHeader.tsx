import { Link } from "@tanstack/react-router";
import { Menu, MountainSnow, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useYatraAuth } from "@/lib/yatra-auth";

const links = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useYatraAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
            <MountainSnow className="size-5" />
          </span>
          <span className="truncate text-lg font-extrabold tracking-tight">
            Krishna Conscious <span className="text-primary">Yatra</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "bg-accent text-accent-foreground" }}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut} className="ml-1 font-semibold">
              <LogOut className="size-4" /> Logout
            </Button>
          ) : (
            <Button asChild size="sm" className="ml-1 bg-gradient-primary font-semibold shadow-glow">
              <Link to="/auth">Book Your Yatra</Link>
            </Button>
          )}
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="sm:hidden">
            <Button variant="outline" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[80vw] max-w-xs">
            <SheetTitle className="px-1 text-base">Menu</SheetTitle>
            <div className="mt-4 flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-semibold text-foreground hover:bg-accent"
                >
                  {l.label}
                </Link>
              ))}
              {user ? (
                <Button
                  variant="outline"
                  className="mt-3 font-semibold"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                >
                  <LogOut className="size-4" /> Logout
                </Button>
              ) : (
                <Button
                  asChild
                  className="mt-3 bg-gradient-primary font-semibold shadow-glow"
                  onClick={() => setOpen(false)}
                >
                  <Link to="/auth">Book Your Yatra</Link>
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
