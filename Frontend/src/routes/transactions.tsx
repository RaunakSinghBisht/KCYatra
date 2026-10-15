import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownWideNarrow, MessageCircle, Receipt, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { useYatraAuth } from "@/lib/yatra-auth";
import { BASE_URL } from "@/lib/api";

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

type BookingResponse = {
  id: number;
  payment_status: string;
  transaction_id: string | null;
  hotel_package: string | null;
  travel_package: string | null;
  amount_paid: number;
  payment_method: string | null;
  created_at: string;
  passenger_id_formatted: string;
  passenger_name: string;
  passenger_gender: string;
  passenger_yob: number;
  yatra_title: string;
  yatra_start_date: string;
  yatra_whatsapp_link: string | null;
};

function ageAtStart(yob: number, yatraStartYear: number) {
  return yatraStartYear - yob;
}

function Transactions() {
  const { user } = useYatraAuth();
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function loadBookings() {
      try {
        const res = await fetch(`${BASE_URL}/registrations/user/${user!.user_id}/bookings`);
        if (res.ok) {
          const data = await res.json();
          setBookings(data);
        }
      } catch (err) {
        console.error("Failed to load bookings", err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, [user]);

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

          {loading ? (
            <div className="mt-10 flex justify-center">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="mt-10 rounded-2xl bg-card p-10 text-center shadow-soft">
              <p className="text-muted-foreground">No bookings found.</p>
            </div>
          ) : (
            <ul className="mt-6 space-y-5">
              {bookings.map((t) => {
                const yatraYear = new Date(t.yatra_start_date).getFullYear();
                const age = ageAtStart(t.passenger_yob, yatraYear);

                let concession = "N/A";
                if (age <= 5) concession = "Full (0-5 Year)";
                else if (age <= 10) concession = "Half (6-10 Year)";

                let badgeColor = "bg-muted text-muted-foreground";
                if (t.payment_status === "paid") {
                  badgeColor = "bg-green-100 text-green-800";
                } else if (t.payment_status === "not_paid") {
                  badgeColor = "bg-red-100 text-red-800";
                } else if (t.payment_status === "interested") {
                  badgeColor = "bg-yellow-100 text-yellow-800";
                }

                const displayStatus = t.payment_status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());

                return (
                  <li
                    key={t.id}
                    className="overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-soft"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <span className={`rounded-lg px-3 py-1.5 text-sm font-bold ${badgeColor}`}>
                          {displayStatus}
                        </span>
                        <div className="min-w-0 text-right">
                          <p className="text-xs font-semibold text-muted-foreground">Razorpay Payment ID</p>
                          <p className="truncate text-sm font-extrabold">{t.transaction_id || "N/A"}</p>
                        </div>
                      </div>

                      <p className="mt-3 text-sm font-extrabold">
                        {t.passenger_name} · {age} Y, {t.passenger_gender.charAt(0).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">Passenger ID: {t.passenger_id_formatted}</p>

                      <dl className="mt-3 grid gap-1.5 text-sm">
                        <Row label="Yatra" value={t.yatra_title} />
                        <Row label="Hotel Package" value={t.hotel_package || "Not Selected"} />
                        <Row label="Travelling Package" value={t.travel_package || "Not Selected"} />
                        <Row label="Concession" value={concession} />
                        <Row label="Journey Date" value={new Date(t.yatra_start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })} />
                        <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2 border-t border-border pt-2">
                          <dt className="text-sm font-bold">Total</dt>
                          <dd className="text-right text-base font-extrabold text-primary">₹ {t.amount_paid.toLocaleString("en-IN")}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="relative border-t border-dashed border-primary/50 bg-muted/50">
                      <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full border border-primary/40 bg-background" />
                      <span className="absolute -right-2.5 -top-2.5 size-5 rounded-full border border-primary/40 bg-background" />
                      <a
                        href={t.yatra_whatsapp_link || "#"}
                        target={t.yatra_whatsapp_link ? "_blank" : undefined}
                        rel="noreferrer"
                        onClick={(e) => {
                          if (!t.yatra_whatsapp_link) e.preventDefault();
                        }}
                        className={`flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-extrabold sm:px-5 ${t.yatra_whatsapp_link
                            ? "text-foreground hover:text-primary"
                            : "text-muted-foreground cursor-not-allowed opacity-60"
                          }`}
                      >
                        <MessageCircle className={`size-4 ${t.yatra_whatsapp_link ? "text-primary" : "text-muted-foreground"}`} />
                        WhatsApp Group Link Join
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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

