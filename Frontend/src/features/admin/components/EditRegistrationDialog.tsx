import { useState } from "react";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
import { authFetch } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BASE_URL } from "@/lib/api";
import type { Registration } from "@/routes/admin224151.bookings";

const PAYMENT_STATUSES = ["interested", "paid", "partial_paid", "not_paid", "cash"];
const PAYMENT_METHODS = ["cash", "online"];

export function EditRegistrationDialog({ registration: r, onUpdated }: { registration: Registration; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [hotelPackage, setHotelPackage] = useState(r.hotelPackage ?? "");
  const [travelPackage, setTravelPackage] = useState(r.travelPackage ?? "");
  const [paymentStatus, setPaymentStatus] = useState(r.paymentStatus);
  const [amountPaid, setAmountPaid] = useState(String(r.amountPaid));
  const [paymentMethod, setPaymentMethod] = useState(r.paymentMethod ?? "");
  const [transactionId, setTransactionId] = useState(r.transactionId ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await authFetch(`${BASE_URL}/registrations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_package: hotelPackage || null,
          travel_package: travelPackage || null,
          payment_status: paymentStatus,
          amount_paid: Number(amountPaid) || 0,
          payment_method: paymentMethod || null,
          transaction_id: transactionId.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        toast.error(err.detail ?? "Failed to update");
        return;
      }
      toast.success("Registration updated");
      setOpen(false);
      onUpdated();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Edit registration RGS${r.id}`}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-h-[92dvh] w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-lg [&>button]:hidden">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-extrabold tracking-normal">Edit Registration · RGS{r.id}</DialogTitle>
            <DialogClose asChild>
              <Button type="button" size="icon" aria-label="Close" className="size-9 rounded-full border-2 border-card shadow-glow"><X className="size-4" /></Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); save(); }}
          className="grid gap-3 px-4 py-4 [&_input]:h-11 [&_input]:min-w-0 [&_input]:rounded-full [&_input]:shadow-sm [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full [&_button[role=combobox]]:min-w-0 [&_button[role=combobox]]:rounded-full [&_button[role=combobox]]:shadow-sm"
        >
          <Input aria-label="Hotel Package" placeholder="Hotel Package" value={hotelPackage} onChange={(e) => setHotelPackage(e.target.value)} />
          <Input aria-label="Travel Package" placeholder="Travel Package" value={travelPackage} onChange={(e) => setTravelPackage(e.target.value)} />

          <div className="grid gap-1.5">
            <Label>Payment Status</Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger aria-label="Payment status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Input
            aria-label="Amount Paid (₹)"
            placeholder="Amount Paid (₹)"
            type="number"
            inputMode="numeric"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />

          <div className="grid gap-1.5">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger aria-label="Payment method"><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Input
            aria-label="Transaction ID"
            placeholder="Transaction ID (optional)"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
          />

          <Button type="submit" disabled={saving} className="h-11 w-full rounded-full bg-gradient-primary font-bold shadow-glow">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
