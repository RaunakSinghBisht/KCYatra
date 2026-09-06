import { Link } from "@tanstack/react-router";
import { Bell, Compass, Receipt, UserRound } from "lucide-react";

const tabs = [
  { to: "/dashboard", label: "Notice", icon: Bell },
  { to: "/select-yatra", label: "Select Yatra", icon: Compass },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/personal-details", label: "You", icon: UserRound },
] as const;


export function DashboardTabBar() {
  return (
    <nav
      aria-label="Dashboard sections"
      className="fixed inset-x-0 bottom-0 z-50 bg-gradient-primary pb-[env(safe-area-inset-bottom)] shadow-glow"
    >
      <ul className="mx-auto grid max-w-6xl grid-cols-4">
        {tabs.map((t) => (
          <li key={t.to}>
            <Link
              to={t.to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-primary-foreground [&_span]:font-extrabold" }}
              inactiveProps={{ className: "text-primary-foreground/65" }}
              className="flex w-full flex-col items-center gap-1 px-2 py-2.5 transition-colors hover:text-primary-foreground"
            >
              <t.icon className="size-6 shrink-0" />
              <span className="truncate text-[11px] font-medium leading-tight sm:text-xs">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
