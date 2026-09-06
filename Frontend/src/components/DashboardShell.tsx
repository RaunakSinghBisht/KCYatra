import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useYatraAuth } from "@/lib/yatra-auth";
import { DashboardTabBar } from "@/components/DashboardTabBar";

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
      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-32">{children(user)}</main>
      <DashboardTabBar />
    </>
  );
}
