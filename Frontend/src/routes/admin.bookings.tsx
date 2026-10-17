import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { AdminShell, ExportButtons, StatCard } from "@/features/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManualBookingDialog } from "@/features/admin/components/ManualBookingDialog";
import { EditRegistrationDialog } from "@/features/admin/components/EditRegistrationDialog";
import { exportCsv, exportExcel } from "@/features/admin/lib/export-records";
import { BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings & Payments — Krishna Conscious Yatra Admin" },
      { name: "description", content: "Track, filter, update and export every yatra booking and payment." },
      { property: "og:title", content: "Bookings & Payments — Krishna Conscious Yatra Admin" },
      { property: "og:description", content: "Track, filter, update and export every yatra booking and payment." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBookings,
});

export type Registration = {
  id: number;
  passengerId: number;
  userId: number;
  yatraId: number;
  hotelPackage: string | null;
  travelPackage: string | null;
  paymentStatus: string;
  amountPaid: number;
  paymentMethod: string | null;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
  passengerName: string;
  passengerGender: string;
  passengerYob: number;
  passengerPhone: string | null;
  passengerCity: string | null;
  passengerDistrict: string | null;
  passengerState: string | null;
  passengerSpecialAssistance: string | null;
  yatraTitle: string;
  userPhone: string | null;
};

function fromApi(r: Record<string, unknown>): Registration {
  return {
    id: r.id as number,
    passengerId: r.passenger_id as number,
    userId: r.user_id as number,
    yatraId: r.yatra_id as number,
    hotelPackage: (r.hotel_package as string | null) ?? null,
    travelPackage: (r.travel_package as string | null) ?? null,
    paymentStatus: r.payment_status as string,
    amountPaid: Number(r.amount_paid),
    paymentMethod: (r.payment_method as string | null) ?? null,
    transactionId: (r.transaction_id as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    passengerName: r.passenger_name as string,
    passengerGender: r.passenger_gender as string,
    passengerYob: r.passenger_yob as number,
    passengerPhone: (r.passenger_phone as string | null) ?? null,
    passengerCity: (r.passenger_city as string | null) ?? null,
    passengerDistrict: (r.passenger_district as string | null) ?? null,
    passengerState: (r.passenger_state as string | null) ?? null,
    passengerSpecialAssistance: (r.passenger_special_assistance as string | null) ?? null,
    yatraTitle: r.yatra_title as string,
    userPhone: (r.user_phone as string | null) ?? null,
  };
}

function toExportRow(r: Registration, i: number) {
  return {
    "S. No.": i + 1,
    "Parent Phone No": r.userPhone ? `+91 ${r.userPhone}` : "—",
    "Name": r.passengerName,
    "Gender": r.passengerGender,
    "Year of Birth": r.passengerYob,
    "Phone No.": r.passengerPhone ? `+91 ${r.passengerPhone}` : "—",
    "City": r.passengerCity ?? "—",
    "District": r.passengerDistrict ?? "—",
    "State": r.passengerState ?? "—",
    "Hotel Package": r.hotelPackage ?? "—",
    "Travel Package": r.travelPackage ?? "—",
    "Payment Method": r.paymentMethod ?? "—",
    "Payment Status": r.paymentStatus,
    "Amount Paid": r.amountPaid,
    "Razorpay ID": r.transactionId ?? "—",
    "Special Assistance": r.passengerSpecialAssistance ?? "—",
  };
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const PAYMENT_STATUSES = ["interested", "paid", "not_paid", "cash"];

function AdminBookings() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yatraFilter, setYatraFilter] = useState("all");

  const load = async () => {
    try {
      const res = await fetch(`${BASE_URL}/registrations/`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Record<string, unknown>[];
      setRegistrations(data.map(fromApi));
    } catch (err) {
      toast.error("Failed to load registrations");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(
    () =>
      registrations.filter((r) => {
        const text = `${r.passengerName} ${r.transactionId ?? ""} ${r.yatraTitle}`.toLowerCase();
        return (
          text.includes(q.toLowerCase()) &&
          (statusFilter === "all" || r.paymentStatus === statusFilter) &&
          (yatraFilter === "all" || r.yatraTitle === yatraFilter)
        );
      }),
    [registrations, q, statusFilter, yatraFilter],
  );

  const yatraNames = Array.from(new Set(registrations.map((r) => r.yatraTitle)));
  const collected = rows.reduce((s, r) => s + r.amountPaid, 0);
  const paidCount = rows.filter((r) => r.paymentStatus === "paid").length;

  const handleDelete = async (id: number, name: string) => {
    try {
      const res = await fetch(`${BASE_URL}/registrations/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
      toast.success(`Registration for ${name} deleted`);
    } catch (err) {
      toast.error("Failed to delete registration");
      console.error(err);
    }
  };

  return (
    <AdminShell
      title="Bookings & Payments"
      description="Filter, update payment status and export booking records."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ManualBookingDialog onCreated={load} />
          <ExportButtons
            onCsv={() => (exportCsv(rows.map(toExportRow), "kcy-bookings") ? toast.success("CSV downloaded") : toast.error("No records"))}
            onExcel={() => (exportExcel(rows.map(toExportRow), "kcy-bookings") ? toast.success("Excel downloaded") : toast.error("No records"))}
          />
        </div>
      }
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Records shown" value={String(rows.length)} />
        <StatCard label="Collected" value={inr(collected)} />
        <StatCard label="Paid" value={String(paidCount)} />
      </section>

      <section className="grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, transaction ID or yatra" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Payment status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yatraFilter} onValueChange={setYatraFilter}>
          <SelectTrigger><SelectValue placeholder="Yatra" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All yatras</SelectItem>
            {yatraNames.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3">
        {loading ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Loading registrations…
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No registrations match these filters.
          </p>
        ) : (
          rows.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">
                    {r.passengerName} · {new Date().getFullYear() - r.passengerYob}, {r.passengerGender}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">RGS{r.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <EditRegistrationDialog registration={r} onUpdated={load} />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete registration"
                    className="text-destructive"
                    onClick={() => handleDelete(r.id, r.passengerName)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <Cell label="Yatra" value={r.yatraTitle} />
                <Cell label="Hotel Package" value={r.hotelPackage ?? "—"} />
                <Cell label="Travel Package" value={r.travelPackage ?? "—"} />
                <Cell label="Payment Status" value={r.paymentStatus} />
                <Cell label="Amount Paid" value={inr(r.amountPaid)} />
                <Cell label="Payment Method" value={r.paymentMethod ?? "—"} />
                <Cell label="Transaction ID" value={r.transactionId ?? "—"} />
                <Cell label="Registered On" value={new Date(r.createdAt).toLocaleDateString("en-IN")} />
              </dl>
            </article>
          ))
        )}
      </section>
    </AdminShell>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}
