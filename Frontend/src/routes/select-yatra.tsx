import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { yatraPackages } from "@/lib/yatra-data";

export const Route = createFileRoute("/select-yatra")({
  head: () => ({
    meta: [
      { title: "Select Yatra — Krishna Conscious Yatra" },
      { name: "description", content: "Browse and book curated pilgrimage and travel packages." },
      { property: "og:title", content: "Select Yatra — Krishna Conscious Yatra" },
      { property: "og:description", content: "Pick your next yatra from curated packages." },
    ],
  }),
  component: SelectYatra,
});

function SelectYatra() {
  return (
    <DashboardShell>
      {() => (
        <>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Compass className="size-6 text-primary" /> Select Yatra
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Curated journeys, ready to book.</p>

          <section className="mt-6 grid max-w-md gap-4">
            {yatraPackages.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <img
                  src={p.img}
                  alt={p.name}
                  width={1600}
                  height={900}
                  loading="lazy"
                  className="h-36 w-full object-cover"
                />
                <div className="p-4">
                  <Badge variant="secondary" className="font-semibold">
                    {p.tag}
                  </Badge>
                  <h2 className="mt-2 truncate text-base font-bold">{p.name}</h2>
                  <p className="text-xs text-muted-foreground">{p.days}</p>
                  <div className="mt-3">
                    <Button asChild size="sm" className="w-full bg-gradient-primary font-bold shadow-glow">
                      <Link to="/book/$id" params={{ id: p.id }}>
                        Book now
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </section>

        </>
      )}
    </DashboardShell>
  );
}
