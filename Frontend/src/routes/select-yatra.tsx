import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authFetch } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass, Loader2, MessageCircle } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import yatra1 from "@/assets/yatra-1.jpeg";

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

// ── Type matching backend YatraResponse ──────────────────────────────────────
type Yatra = {
  id: number;
  title: string;
  image_url: string | null;
  start_date: string;  // "YYYY-MM-DD"
  end_date: string;
  is_start_date_fixed: boolean;
  is_end_date_fixed: boolean;
  status: string;      // "upcoming" | "open" | "close"
  description: string | null;
  whatsapp_group_link: string | null;
  allow_whatsapp_before_payment: boolean;
  hotel_packages: { title: string; price: number }[] | null;
  travel_packages: { title: string; price: number }[] | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateRange(start: string, end: string): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(new Date(start))} – ${fmt(new Date(end))}`;
}

function statusLabel(status: string): string {
  return { upcoming: "Registrations Open", open: "Open", close: "Closed", closed: "Closed", active: "Active" }[status] ?? status;
}

function statusVariant(status: string): "secondary" | "destructive" | "outline" {
  return status === "closed" ? "destructive" : status === "active" ? "secondary" : "secondary";
}

// ── Component ─────────────────────────────────────────────────────────────────
function SelectYatra() {
  const [yatras, setYatras] = useState<Yatra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchYatras() {
      try {
        const res = await authFetch(`${BASE_URL}/yatras/`);
        if (!res.ok) throw new Error(`Server error (${res.status})`);
        const data: Yatra[] = await res.json();
        setYatras(data);
      } catch (err) {
        toast.error("Could not load yatras — " + (err instanceof Error ? err.message : "unknown error"));
      } finally {
        setLoading(false);
      }
    }
    fetchYatras();
  }, []);

  return (
    <DashboardShell>
      {() => (
        <>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Compass className="size-6 text-primary" /> Select Yatra
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Curated journeys, ready to book.</p>

          <section className="mt-6 flex flex-wrap justify-center gap-5 [&>article]:w-full [&>article]:sm:w-96 [&>article]:lg:w-[420px]">
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading yatras…
              </div>
            )}

            {/* Empty */}
            {!loading && yatras.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No yatras available at the moment. Check back soon!
              </p>
            )}

            {/* Yatra cards */}
            {!loading &&
              yatras.map((y) => (
                <article
                  key={y.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
                >
                  <img
                    src={y.image_url ?? yatra1}
                    alt={y.title}
                    width={1600}
                    height={900}
                    loading="lazy"
                    className="h-48 w-full object-fill"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = yatra1; }}
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <Badge variant={statusVariant(y.status)} className="font-semibold self-start">
                      {statusLabel(y.status)}
                    </Badge>
                    <h2 className="mt-2 truncate text-base font-bold">{y.title}</h2>
                    {y.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {y.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {formatDateRange(y.start_date, y.end_date)}
                    </p>
                    <div className="mt-auto flex gap-2 pt-4">
                      {y.whatsapp_group_link && y.allow_whatsapp_before_payment && (
                        <a
                          href={y.whatsapp_group_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-2 py-2 text-xs font-bold text-white shadow transition-opacity hover:opacity-90 active:scale-95"
                        >
                          <MessageCircle className="size-4 fill-white stroke-none shrink-0" />
                          <span>Join WhatsApp</span>
                        </a>
                      )}
                      <Button
                        asChild
                        size="sm"
                        className="flex-1 bg-gradient-primary font-bold shadow-glow"
                        disabled={y.status === "closed"}
                      >
                        <Link to="/book/$id" params={{ id: String(y.id) }}>
                          {y.status === "closed" ? "Closed" : "Book now"}
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
