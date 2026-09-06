import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownWideNarrow, MessageCircle, Receipt } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { transactions } from "@/lib/yatra-data";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "My Bookings — Krishna Conscious Yatra" },
      { name: "description", content: "Track your Krishna Conscious Yatra bookings, payment IDs, packages and journey dates." },
      { property: "og:title", content: "My Bookings — Krishna Conscious Yatra" },
      { property: "og:description", content: "Booking tickets with payment IDs, packages and journey dates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Transactions,
});

function Transactions() {
  return (
    <DashboardShell>
      {() => (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                <Receipt className="size-6 text-primary" /> My Bookings
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">All your booked yatras and payments.</p>
            </div>
            <button
              type="button"
              aria-label="Sort bookings"
              className="shrink-0 rounded-full border border-border bg-card p-2.5 text-primary shadow-soft"
            >
              <ArrowDownWideNarrow className="size-5" />
            </button>
          </div>

          <ul className="mt-6 space-y-5">
            {transactions.map((t) => (
              <li
                key={t.id}
                className="overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-soft"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <span
                      className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                        t.status === "Booked"
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t.status}
                    </span>
                    <div className="min-w-0 text-right">
                      <p className="text-xs font-semibold text-muted-foreground">Razorpay Payment ID</p>
                      <p className="truncate text-sm font-extrabold">{t.paymentId}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm font-extrabold">
                    {t.passenger} · {t.age}, {t.gender}
                  </p>
                  <p className="text-xs text-muted-foreground">User ID: {t.userId}</p>

                  <dl className="mt-3 grid gap-1.5 text-sm">
                    <Row label="Yatra" value={t.yatra} />
                    <Row label="Hotel Package" value={t.hotelPackage} />
                    <Row label="Travelling Package" value={t.travelPackage} />
                    <Row label="Concession" value={t.concession} />
                    <Row label="Journey Date" value={t.journeyDate} />
                    <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2 border-t border-border pt-2">
                      <dt className="text-sm font-bold">Total</dt>
                      <dd className="text-right text-base font-extrabold text-primary">{t.total}</dd>
                    </div>
                  </dl>
                </div>

                <div className="relative border-t border-dashed border-primary/50 bg-muted/50">
                  <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full border border-primary/40 bg-background" />
                  <span className="absolute -right-2.5 -top-2.5 size-5 rounded-full border border-primary/40 bg-background" />
                  <a
                    href={t.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-extrabold text-foreground hover:text-primary sm:px-5"
                  >
                    <MessageCircle className="size-4 text-primary" /> WhatsApp Group Link Join
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2">
      <dt className="text-sm text-muted-foreground">{label}:</dt>
      <dd className="text-right text-sm font-semibold">{value}</dd>
    </div>
  );
}
