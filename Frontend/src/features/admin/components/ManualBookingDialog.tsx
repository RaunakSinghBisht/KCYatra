import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { states, stateOptions } from "@/lib/location-data";
import { BASE_URL } from "@/lib/api";

type Passenger = {
  id: number;
  user_id: number;
  full_name: string;
  gender: string;
  year_of_birth: number;
  phone_no: string | null;
};

type HotelPkg = { title: string; price: number };
type TravelPkg = { title: string; price: number };
type Yatra = {
  id: number;
  title: string;
  hotel_packages: HotelPkg[] | null;
  travel_packages: TravelPkg[] | null;
};

type Registration = { passenger_id: number; yatra_id: number };

const PAYMENT_STATUSES = ["interested", "paid", "not_paid", "cash"];
const PAYMENT_METHODS = ["cash", "online"];

const BLANK = {
  passengerId: "",
  yatraId: "",
  // new passenger
  loginPhone: "",
  fullName: "",
  gender: "male",
  yob: "",
  phone: "",
  state: "",
  district: "",
  city: "",
  specialAssistance: "Not Required",
  // registration
  hotelPackage: "",
  travelPackage: "",
  paymentStatus: "interested",
  amountPaid: "",
  paymentMethod: "",
  transactionId: "Created by Admin",
} as const;

export function ManualBookingDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [yatras, setYatras] = useState<Yatra[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ ...BLANK });

  const set = (k: keyof typeof BLANK, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(`${BASE_URL}/passengers/`).then((r) => r.json()),
      fetch(`${BASE_URL}/yatras/`).then((r) => r.json()),
    ])
      .then(([pList, yList]) => {
        setPassengers(pList as Passenger[]);
        setYatras(yList as Yatra[]);
      })
      .catch(() => toast.error("Failed to load data"));
  }, [open]);

  // When yatra changes, load its registrations to filter out already-booked passengers
  useEffect(() => {
    if (!form.yatraId) { setRegistrations([]); return; }
    fetch(`${BASE_URL}/registrations/yatra/${form.yatraId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((list) => setRegistrations(list as Registration[]))
      .catch(() => setRegistrations([]));
  }, [form.yatraId]);

  const selectedYatra = yatras.find((y) => String(y.id) === form.yatraId);

  // Passengers not yet registered for the selected yatra
  const registeredIds = new Set(registrations.map((r) => r.passenger_id));
  const availablePassengers = useMemo(
    () => passengers.filter((p) => !registeredIds.has(p.id)),
    [passengers, registrations], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const districtOptions = useMemo(
    () => (form.state ? (states[form.state] ?? []).map((d) => ({ value: d, label: d })) : []),
    [form.state],
  );

  const newPassengerMode = !form.passengerId;

  const reset = () => {
    setForm({ ...BLANK });
    setRegistrations([]);
  };

  const save = async () => {
    if (!form.yatraId) { toast.error("Select a yatra"); return; }
    if (newPassengerMode) {
      if (!form.loginPhone.trim()) { toast.error("Parent phone is required for a new passenger"); return; }
      if (!form.fullName.trim()) { toast.error("Full name is required"); return; }
      if (!form.yob || isNaN(Number(form.yob))) { toast.error("Year of birth is required"); return; }
    }
    if (!form.hotelPackage) { toast.error("Hotel package is required"); return; }
    if (!form.travelPackage) { toast.error("Travel package is required"); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        yatra_id: Number(form.yatraId),
        hotel_package: form.hotelPackage || null,
        travel_package: form.travelPackage || null,
        payment_status: form.paymentStatus || "interested",
        amount_paid: form.amountPaid ? Number(form.amountPaid) : 0,
        payment_method: form.paymentMethod || null,
        transaction_id: form.transactionId.trim() || null,
      };

      if (form.passengerId) {
        body.passenger_id = Number(form.passengerId);
      } else {
        body.login_phone = form.loginPhone.trim() || null;
        body.full_name = form.fullName.trim();
        body.gender = form.gender;
        body.year_of_birth = Number(form.yob);
        body.phone_no = form.phone.trim() || null;
        body.state = form.state || null;
        body.district = form.district || null;
        body.city = form.city.trim() || null;
        body.special_assistance = form.specialAssistance || "Not Required";
      }

      const res = await fetch(`${BASE_URL}/registrations/admin-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        toast.error(err.detail ?? "Failed to create registration");
        return;
      }

      toast.success("Registration created successfully");
      reset();
      setOpen(false);
      onCreated();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="size-4" /> Manual Booking</Button>
      </DialogTrigger>

      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92dvh] w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-lg [&>button]:hidden"
      >
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-extrabold tracking-normal">Manual Booking</DialogTitle>
            <DialogClose asChild>
              <Button type="button" size="icon" aria-label="Close" className="size-9 rounded-full border-2 border-card shadow-glow">
                <X className="size-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); save(); }}
          className="grid gap-4 px-4 py-4"
        >
          {/* ── 1. Yatra ── */}
          <Field label="Yatra">
            <Select
              value={form.yatraId}
              onValueChange={(v) => { set("yatraId", v); set("hotelPackage", ""); set("travelPackage", ""); }}
            >
              <SelectTrigger className="h-11 rounded-full shadow-sm"><SelectValue placeholder="Select yatra" /></SelectTrigger>
              <SelectContent>
                {yatras.map((y) => (
                  <SelectItem key={y.id} value={String(y.id)}>{y.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* ── 2. Passenger ── */}
          <Field label="Passenger (leave blank to create new)">
            <Select value={form.passengerId} onValueChange={(v) => set("passengerId", v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-11 rounded-full shadow-sm"><SelectValue placeholder="Select existing passenger (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— New passenger —</SelectItem>
                {availablePassengers.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.full_name}{p.phone_no ? ` · ${p.phone_no}` : " · No phone"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* ── New passenger fields (3–9) ── */}
          {newPassengerMode && (
            <div className="grid gap-3 rounded-2xl border border-dashed border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground">New Passenger Details</p>

              {/* Login phone */}
              <Field label="Login / Parent Phone *">
                <Input
                  className="h-11 rounded-full shadow-sm"
                  placeholder="10-digit phone (required)"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.loginPhone}
                  onChange={(e) => set("loginPhone", e.target.value.replace(/\D/g, ""))}
                />
              </Field>

              {/* Full Name */}
              <Field label="Full Name">
                <Input className="h-11 rounded-full shadow-sm" placeholder="Full Name" maxLength={60} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
              </Field>

              {/* Gender */}
              <Field label="Gender">
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger className="h-11 rounded-full shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Year of Birth */}
              <Field label="Year of Birth">
                <Input className="h-11 rounded-full shadow-sm" placeholder="e.g. 1990" inputMode="numeric" maxLength={4} value={form.yob} onChange={(e) => set("yob", e.target.value.replace(/\D/g, ""))} />
              </Field>

              {/* Passenger Phone */}
              <Field label="Passenger Phone (optional)">
                <Input className="h-11 rounded-full shadow-sm" placeholder="10 digits" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))} />
              </Field>

              {/* State */}
              <Field label="State">
                <Select value={form.state} onValueChange={(v) => { set("state", v); set("district", ""); }}>
                  <SelectTrigger className="h-11 rounded-full shadow-sm"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>
                    {stateOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              {/* District */}
              <Field label="District">
                <Select value={form.district} onValueChange={(v) => set("district", v)} disabled={!form.state}>
                  <SelectTrigger className="h-11 rounded-full shadow-sm"><SelectValue placeholder={form.state ? "District" : "Select state first"} /></SelectTrigger>
                  <SelectContent>
                    {districtOptions.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              {/* City */}
              <Field label="City">
                <Input className="h-11 rounded-full shadow-sm" placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>

              {/* Special Assistance */}
              <Field label="Special Assistance">
                <Select value={form.specialAssistance} onValueChange={(v) => set("specialAssistance", v)}>
                  <SelectTrigger className="h-11 rounded-full shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not Required">Not Required</SelectItem>
                    <SelectItem value="Required">Required</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {/* ── 10. Hotel Package ── */}
          <Field label="Hotel Package *">
            <Select value={form.hotelPackage} onValueChange={(v) => set("hotelPackage", v === "__none__" ? "" : v)} disabled={!selectedYatra?.hotel_packages?.length}>
              <SelectTrigger className="h-11 rounded-full shadow-sm">
                <SelectValue placeholder={selectedYatra?.hotel_packages?.length ? "Select (optional)" : "None available"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {(selectedYatra?.hotel_packages ?? []).map((p) => (
                  <SelectItem key={p.title} value={p.title}>{p.title} · ₹{p.price.toLocaleString("en-IN")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* ── 11. Travel Package ── */}
          <Field label="Travel Package *">
            <Select value={form.travelPackage} onValueChange={(v) => set("travelPackage", v === "__none__" ? "" : v)} disabled={!selectedYatra?.travel_packages?.length}>
              <SelectTrigger className="h-11 rounded-full shadow-sm">
                <SelectValue placeholder={selectedYatra?.travel_packages?.length ? "Select (optional)" : "None available"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {(selectedYatra?.travel_packages ?? []).map((p) => (
                  <SelectItem key={p.title} value={p.title}>{p.title} · ₹{p.price.toLocaleString("en-IN")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* ── 12. Payment Status ── */}
          <Field label="Payment Status">
            <Select value={form.paymentStatus} onValueChange={(v) => set("paymentStatus", v)}>
              <SelectTrigger className="h-11 rounded-full shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {/* ── 13. Amount Paid ── */}
          <Field label="Amount Paid (₹)">
            <Input className="h-11 rounded-full shadow-sm" placeholder="0" inputMode="numeric" value={form.amountPaid} onChange={(e) => set("amountPaid", e.target.value.replace(/\D/g, ""))} />
          </Field>

          {/* ── 14. Payment Method ── */}
          <Field label="Payment Method">
            <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-11 rounded-full shadow-sm"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {/* ── 15. Razorpay / Transaction ID ── */}
          <Field label="Razorpay / Transaction ID (optional)">
            <Input className="h-11 rounded-full shadow-sm" placeholder="Transaction ID" value={form.transactionId} onChange={(e) => set("transactionId", e.target.value)} />
          </Field>

          <Button type="submit" disabled={saving} className="h-11 w-full rounded-full bg-gradient-primary font-bold shadow-glow">
            {saving ? "Creating…" : "Create Registration"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
