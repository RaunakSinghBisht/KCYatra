import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ArrowDownWideNarrow, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BASE_URL } from "@/lib/api";
import { useYatraAuth } from "@/lib/yatra-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/book/$id")({
  head: () => ({
    meta: [
      { title: "Book Yatra — Krishna Conscious Yatra" },
      { name: "description", content: "Choose hotel and travel packages for each passenger and proceed to pay." },
      { property: "og:title", content: "Book Yatra — Krishna Conscious Yatra" },
      { property: "og:description", content: "Select hotel and travel packages for your yatra passengers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookYatra,
});

// ── API types ─────────────────────────────────────────────────────────────────

type Package = { title: string; price: number };

type Yatra = {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  hotel_packages: Package[] | null;
  travel_packages: Package[] | null;
  status: string;
};

type Passenger = {
  id: number;
  full_name: string;
  year_of_birth: number;
  gender: "male" | "female" | "other";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type Selection = { hotel?: string; travel?: string };

/**
 * Parse a saved package string "Title : Price" → just the title part.
 * Returns null if the string is empty/null.
 */
function parsePkgTitle(pkgStr: string | null | undefined): string | undefined {
  if (!pkgStr) return undefined;
  const colonIdx = pkgStr.lastIndexOf(" : ");
  return colonIdx !== -1 ? pkgStr.slice(0, colonIdx).trim() : pkgStr.trim();
}

function formatPrice(value: number) {
  return `₹ ${value.toLocaleString("en-IN")}`;
}

function ageAtStart(yob: number, yatraStartYear: number) {
  return yatraStartYear - yob;
}

function genderInitial(g: string) {
  return g === "male" ? "M" : g === "female" ? "F" : "O";
}

// Load Razorpay checkout script once and return a promise
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as Record<string, unknown>)["Razorpay"]) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Shared save helper (used by both "Proceed to Pay" and on-unmount) ─────────
// Returns updated regIds map. Silently skips paid passengers and those without
// both packages selected. Never throws — errors are logged, not toasted (used
// as a best-effort background save).
async function saveSelectionsToDB(
  sel: Record<number, Selection>,
  paidIds: Set<number>,
  regIds: Record<number, number>,
  userId: number,
  yatraId: number,
  hotelOptions: { key: string; price: number }[],
  travelOptions: { key: string; price: number }[],
  silent = false,
): Promise<Record<number, number>> {
  const newRegIds: Record<number, number> = { ...regIds };

  const passengerIds = Object.keys(sel).map(Number);
  for (const passengerId of passengerIds) {
    // Skip paid passengers
    if (paidIds.has(passengerId)) continue;

    const s = sel[passengerId] ?? {};
    // Only save when BOTH packages are selected
    if (!s.hotel || !s.travel) continue;

    const hotelPkg = hotelOptions.find((o) => o.key === s.hotel);
    const travelPkg = travelOptions.find((o) => o.key === s.travel);
    const hotelStr = hotelPkg ? `${hotelPkg.key} : ${hotelPkg.price}` : s.hotel!;
    const travelStr = travelPkg ? `${travelPkg.key} : ${travelPkg.price}` : s.travel!;
    const existingRegId = regIds[passengerId];

    try {
      if (existingRegId) {
        // PATCH existing registration packages
        const res = await fetch(`${BASE_URL}/registrations/${existingRegId}/packages`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotel_package: hotelStr, travel_package: travelStr }),
        });
        if (!res.ok && !silent) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.detail ?? "Failed to update registration");
        }
      } else {
        // POST new registration
        const res = await fetch(`${BASE_URL}/registrations/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passenger_id: passengerId,
            user_id: userId,
            yatra_id: yatraId,
            hotel_package: hotelStr,
            travel_package: travelStr,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          newRegIds[passengerId] = data.id;
        } else if (!silent) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.detail ?? "Failed to save registration");
        }
      }
    } catch (err) {
      if (!silent) console.error("[saveSelectionsToDB]", err);
    }
  }

  return newRegIds;
}

// ── OptionRow ─────────────────────────────────────────────────────────────────

function OptionRow({
  label,
  options,
  selected,
  tone,
  disabled,
  onSelect,
}: {
  label: string;
  options: { key: string; price: number }[];
  selected?: string;
  tone: "hotel" | "travel";
  disabled?: boolean;
  onSelect: (v: string) => void;
}) {
  return (
    <div className={cn("relative mt-3", disabled && "opacity-60")}>
      <p className="text-sm font-semibold">{label}</p>
      <div className="relative">
        <div
          className="-mx-4 mt-1.5 flex snap-x gap-3 overflow-x-auto px-4 pb-px [&::-webkit-scrollbar]:h-px [&::-webkit-scrollbar-thumb]:rounded-none [&::-webkit-scrollbar-thumb]:bg-primary [&::-webkit-scrollbar-track]:bg-transparent"
          style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--primary)) transparent" }}
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(o.key)}
              className={cn(
                "relative w-40 shrink-0 snap-start rounded-xl border px-3 py-3 text-left transition active:scale-95",
                tone === "hotel" ? "border-primary/25 bg-accent/60" : "border-primary/40 bg-secondary",
                selected === o.key && "border-primary bg-gradient-primary text-primary-foreground shadow-glow",
                disabled && "cursor-not-allowed",
              )}
            >
              <span className="block text-sm font-semibold">{o.key}</span>
              <span
                className={cn(
                  "absolute right-3 top-2 text-xs font-semibold",
                  selected === o.key ? "text-primary-foreground/80" : "text-muted-foreground/60",
                )}
              >
                ₹{o.price.toLocaleString("en-IN")}
              </span>
            </button>
          ))}
          <div className="w-6 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

// ── PaymentDialog ─────────────────────────────────────────────────────────────

function PaymentDialog({
  open,
  onOpenChange,
  passengers,
  sel,
  paidIds,
  hotelOptions,
  travelOptions,
  yatraId,
  userId,
  regIds,
  yatraStartYear,
  onSaved,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  passengers: Passenger[];
  sel: Record<number, Selection>;
  paidIds: Set<number>;
  hotelOptions: { key: string; price: number }[];
  travelOptions: { key: string; price: number }[];
  yatraId: number;
  userId: number;
  regIds: Record<number, number>;
  yatraStartYear: number;
  onSaved: (savedRegIds: Record<number, number>) => void;
  onPaid: (paidRegIds: number[]) => void;
}) {
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [activeMethod, setActiveMethod] = useState<"cash" | "online" | null>(null);

  const rows = useMemo(
    () =>
      passengers.map((p) => {
        const s = sel[p.id] ?? {};
        const isPaid = paidIds.has(p.id);
        const isSelectable = !isPaid && Boolean(s.hotel && s.travel);
        const hotel = hotelOptions.find((o) => o.key === s.hotel);
        const travel = travelOptions.find((o) => o.key === s.travel);
        const baseTotal = (hotel?.price ?? 0) + (travel?.price ?? 0);

        // Age-based fare rule (age = yatraStartYear − year_of_birth)
        const age = ageAtStart(p.year_of_birth, yatraStartYear);
        let discountedTotal: number;
        let ageTag: string | null = null;
        if (age <= 5) {
          discountedTotal = 0;
          ageTag = "Free";
        } else if (age <= 10) {
          discountedTotal = Math.round(baseTotal / 2);
          ageTag = "Half Price";
        } else {
          discountedTotal = baseTotal;
        }

        return { ...p, isPaid, isSelectable, total: discountedTotal, ageTag };
      }),
    [passengers, sel, paidIds, hotelOptions, travelOptions, yatraStartYear],
  );

  const grandTotal = rows
    .filter((r) => r.isSelectable && checkedIds.has(r.id))
    .reduce((sum, r) => sum + r.total, 0);

  const toggle = (id: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Pay Now: save (all sel, not just checked) → Razorpay ──────────────────
  async function handlePayOnline() {
    if (checkedIds.size === 0) return;
    setActiveMethod("online");

    setSaving(true);

    // Save ALL passengers with both packages selected (not just checked ones).
    // This ensures regIds is fully up-to-date before building the Razorpay order.
    const newRegIds = await saveSelectionsToDB(
      sel,
      paidIds,
      regIds,
      userId,
      yatraId,
      hotelOptions,
      travelOptions,
      false, // show errors via toast
    );
    onSaved(newRegIds);

    setSaving(false);

    // Build registration IDs list for only the CHECKED passengers
    const selectedRegIds: number[] = [];
    for (const passengerId of checkedIds) {
      if (paidIds.has(passengerId)) continue;
      const regId = newRegIds[passengerId];
      if (!regId) continue;
      const r = rows.find((x) => x.id === passengerId);
      if (!r || !r.isSelectable) continue;
      selectedRegIds.push(regId);
    }

    if (selectedRegIds.length === 0) return;

    setPaying(true);

    try {
      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error("Failed to load payment gateway. Check your internet connection.");
        return;
      }

      // Create order on backend — amounts are computed server-side from DB
      const orderRes = await fetch(`${BASE_URL}/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_ids: selectedRegIds }),
      });
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        toast.error(err.detail ?? "Could not create payment order.");
        return;
      }
      const orderData = await orderRes.json();

      if (orderData.order_id === "FREE_ORDER") {
        // Bypass razorpay and verify immediately
        const verifyRes = await fetch(`${BASE_URL}/payments/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: "FREE_ORDER",
            razorpay_payment_id: "FREE_PAYMENT",
            razorpay_signature: "FREE_SIGNATURE",
            registration_ids: selectedRegIds,
          }),
        });

        if (!verifyRes.ok) {
          const err = await verifyRes.json().catch(() => ({}));
          toast.error(err.detail ?? "Failed to confirm free registration.");
          return;
        }

        const verifyData = await verifyRes.json();
        toast.success(`Registration successful! ${verifyData.paid_registration_ids.length} registration(s) confirmed.`);
        onPaid(verifyData.paid_registration_ids);
        setCheckedIds(new Set());
        onOpenChange(false);
        return;
      }

      // Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          order_id: orderData.order_id,
          name: "Krishna Conscious Yatra",
          description: "Yatra Registration Payment",
          theme: { color: "#f97316" },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await fetch(`${BASE_URL}/payments/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  registration_ids: selectedRegIds,
                }),
              });

              if (!verifyRes.ok) {
                const err = await verifyRes.json().catch(() => ({}));
                toast.error(err.detail ?? "Payment verification failed. Contact support.");
                reject(new Error("verify failed"));
                return;
              }

              const verifyData = await verifyRes.json();
              toast.success(`Payment successful! ${verifyData.paid_registration_ids.length} registration(s) confirmed.`);
              onPaid(verifyData.paid_registration_ids);
              setCheckedIds(new Set());
              onOpenChange(false);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              toast.info("Payment cancelled.");
              resolve();
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      });
    } catch {
      // errors already toasted
    } finally {
      setPaying(false);
      setActiveMethod(null);
    }
  }

  async function handlePayCash() {
    if (checkedIds.size === 0 || saving || paying) return;
    setActiveMethod("cash");

    setSaving(true);

    const newRegIds = await saveSelectionsToDB(
      sel,
      paidIds,
      regIds,
      userId,
      yatraId,
      hotelOptions,
      travelOptions,
      false,
    );
    onSaved(newRegIds);

    const selectedRegIds: number[] = [];
    for (const passengerId of checkedIds) {
      if (paidIds.has(passengerId)) continue;
      const regId = newRegIds[passengerId];
      if (!regId) continue;
      const r = rows.find((x) => x.id === passengerId);
      if (!r || !r.isSelectable) continue;
      selectedRegIds.push(regId);
    }

    if (selectedRegIds.length === 0) {
      setSaving(false);
      return;
    }

    setPaying(true);

    try {
      const res = await fetch(`${BASE_URL}/registrations/mark-cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_ids: selectedRegIds }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail ?? "Failed to mark as cash payment.");
        return;
      }

      toast.success("Registration confirmed — pay by cash to the organizer");
      onPaid(selectedRegIds); // this adds them to paidIds locally
      setCheckedIds(new Set());
      onOpenChange(false);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPaying(false);
      setSaving(false);
      setActiveMethod(null);
    }
  }

  const isBusy = saving || paying;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bottom-0 left-4 right-4 mx-auto max-w-lg gap-0 overflow-hidden rounded-t-3xl border-0 p-0 sm:rounded-3xl [&>button]:hidden"
      >
        <div className="relative flex items-center justify-center border-b border-border px-5 pb-3 pt-6">
          <div className="h-1.5 w-14 rounded-full bg-muted" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-5 top-4 grid size-10 place-items-center rounded-full border-2 border-primary-foreground bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 active:scale-95"
            aria-label="Close"
          >
            <X className="size-5" strokeWidth={3} />
          </button>
        </div>

        <SheetHeader className="px-5 pb-2 pt-3 text-left">
          <SheetTitle className="text-xl font-extrabold">Choose For Payments</SheetTitle>
        </SheetHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {rows.map((r) => {
            const checked = checkedIds.has(r.id);
            // Show ageTag (Free / Half Price) when applicable, else normal price
            const labelRight = r.isPaid
              ? "Paid ✓"
              : r.isSelectable
                ? r.ageTag === "Free"
                  ? "Free"
                  : r.ageTag === "Half Price"
                    ? `${formatPrice(r.total)} (Half Price)`
                    : formatPrice(r.total)
                : "Pack not Selected";
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 shadow-soft",
                  !r.isSelectable && !r.isPaid && "opacity-70",
                  r.isPaid && "border-green-200 bg-green-50",
                )}
              >
                <Checkbox
                  id={`pay-${r.id}`}
                  checked={checked}
                  disabled={!r.isSelectable || r.isPaid || isBusy}
                  onCheckedChange={() => toggle(r.id)}
                  className="size-5 rounded-md border-2 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <label
                  htmlFor={`pay-${r.id}`}
                  className={cn(
                    "flex flex-1 items-center justify-between gap-2 text-sm font-bold",
                    !r.isSelectable && !r.isPaid && "text-muted-foreground",
                  )}
                >
                  <span className="truncate">
                    {r.full_name}, {ageAtStart(r.year_of_birth, yatraStartYear)}Y, {genderInitial(r.gender)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-extrabold",
                      r.isPaid
                        ? "text-green-600"
                        : r.isSelectable
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {labelRight}
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border px-5 pb-5 pt-4">
          <p className="text-2xl font-extrabold">Grand Total: {formatPrice(grandTotal)}</p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handlePayCash}
              disabled={checkedIds.size === 0 || isBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-center text-base sm:text-lg font-extrabold tracking-tight text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {isBusy && activeMethod === "cash" ? <Loader2 className="size-4 animate-spin" /> : "Pay by Cash"}
            </button>
            <button
              type="button"
              onClick={handlePayOnline}
              disabled={checkedIds.size === 0 || isBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-primary py-3.5 text-center text-base sm:text-lg font-extrabold tracking-tight text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {isBusy && activeMethod === "online" && <Loader2 className="size-4 animate-spin" />}
              {activeMethod === "online" && saving ? "Saving…" : activeMethod === "online" && paying ? "Opening Payment…" : "Pay Online"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function BookYatra() {
  const { id } = useParams({ from: "/book/$id" });
  const { user } = useYatraAuth();

  const [yatra, setYatra] = useState<Yatra | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);

  const [sel, setSel] = useState<Record<number, Selection>>({});
  const [paidIds, setPaidIds] = useState<Set<number>>(new Set());
  const [payOpen, setPayOpen] = useState(false);
  const [acceptPayments, setAcceptPayments] = useState(true);

  // passenger_id → registration_id
  const [regIds, setRegIds] = useState<Record<number, number>>({});
  // registration_id → passenger_id (reverse map for marking paid)
  const [regToPax, setRegToPax] = useState<Record<number, number>>({});

  // Keep a stable ref to the latest values needed for the cleanup save
  // (useEffect cleanup closes over stale state, so we need refs)
  const selRef = useRef(sel);
  const paidIdsRef = useRef(paidIds);
  const regIdsRef = useRef(regIds);

  useEffect(() => { selRef.current = sel; }, [sel]);
  useEffect(() => { paidIdsRef.current = paidIds; }, [paidIds]);
  useEffect(() => { regIdsRef.current = regIds; }, [regIds]);

  // Stable refs for yatra options (don't change after load)
  const hotelOptionsRef = useRef<{ key: string; price: number }[]>([]);
  const travelOptionsRef = useRef<{ key: string; price: number }[]>([]);
  const userIdRef = useRef(user?.user_id ?? 0);
  const yatraIdRef = useRef(Number(id));

  useEffect(() => { userIdRef.current = user?.user_id ?? 0; }, [user?.user_id]);
  useEffect(() => { yatraIdRef.current = Number(id); }, [id]);

  // Fetch site settings to check if payments are enabled
  useEffect(() => {
    fetch(`${BASE_URL}/dam-page/`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { accept_payments: boolean }) => setAcceptPayments(data.accept_payments))
      .catch(() => { /* keep default true on error */ });
  }, []);

  // ── Fetch yatra + passengers in parallel ──────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [yatraRes, passengerRes] = await Promise.all([
          fetch(`${BASE_URL}/yatras/${id}`),
          fetch(`${BASE_URL}/passengers/user/${user?.user_id ?? 0}`),
        ]);

        if (!yatraRes.ok) throw new Error(`Yatra not found (${yatraRes.status})`);
        if (!passengerRes.ok) throw new Error(`Could not load passengers (${passengerRes.status})`);

        const [yatraData, passengerData] = await Promise.all([
          yatraRes.json() as Promise<Yatra>,
          passengerRes.json() as Promise<Passenger[]>,
        ]);

        setYatra(yatraData);
        setPassengers(passengerData);

        // Cache options in refs for cleanup save
        hotelOptionsRef.current = (yatraData.hotel_packages ?? []).map((p) => ({ key: p.title, price: p.price }));
        travelOptionsRef.current = (yatraData.travel_packages ?? []).map((p) => ({ key: p.title, price: p.price }));

        const lookups = await Promise.all(
          passengerData.map((p) =>
            fetch(`${BASE_URL}/registrations/lookup?passenger_id=${p.id}&yatra_id=${id}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
          ),
        );

        const ids: Record<number, number> = {};
        const revIds: Record<number, number> = {};
        const alreadyPaid = new Set<number>();

        // Change 1: Pre-fill sel from existing pending registrations
        const prefilled: Record<number, Selection> = {};

        lookups.forEach((reg, i) => {
          const pax = passengerData[i];
          if (reg?.id) {
            ids[pax.id] = reg.id;
            revIds[reg.id] = pax.id;

            if (reg.payment_status === "paid") {
              alreadyPaid.add(pax.id);
            } else {
              // Pre-fill selections for pending registrations
              const hotelTitle = parsePkgTitle(reg.hotel_package);
              const travelTitle = parsePkgTitle(reg.travel_package);
              if (hotelTitle || travelTitle) {
                prefilled[pax.id] = {
                  ...(hotelTitle ? { hotel: hotelTitle } : {}),
                  ...(travelTitle ? { travel: travelTitle } : {}),
                };
              }
            }
          }
        });

        setRegIds(ids);
        setRegToPax(revIds);
        if (alreadyPaid.size > 0) setPaidIds(alreadyPaid);
        if (Object.keys(prefilled).length > 0) setSel(prefilled);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load page");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, user?.user_id]);

  // ── Change 2: Best-effort save on unmount (SPA route change) ─────────────
  useEffect(() => {
    return () => {
      // Fire-and-forget — don't await, don't block navigation
      saveSelectionsToDB(
        selRef.current,
        paidIdsRef.current,
        regIdsRef.current,
        userIdRef.current,
        yatraIdRef.current,
        hotelOptionsRef.current,
        travelOptionsRef.current,
        true, // silent — no toasts during unmount
      ).catch(() => {/* already silent */});
    };
  }, []); // runs only on mount/unmount

  // ── Change 2: Best-effort save on browser tab close / hard refresh ────────
  useEffect(() => {
    function handleBeforeUnload() {
      // navigator.sendBeacon would be ideal but requires a dedicated endpoint;
      // fetch with keepalive is the next best option for unload saves.
      const s = selRef.current;
      const paid = paidIdsRef.current;
      const rIds = regIdsRef.current;

      for (const [paxIdStr, pkgSel] of Object.entries(s)) {
        const passengerId = Number(paxIdStr);
        if (paid.has(passengerId)) continue;
        if (!pkgSel.hotel || !pkgSel.travel) continue;

        const hotelPkg = hotelOptionsRef.current.find((o) => o.key === pkgSel.hotel);
        const travelPkg = travelOptionsRef.current.find((o) => o.key === pkgSel.travel);
        const hotelStr = hotelPkg ? `${hotelPkg.key} : ${hotelPkg.price}` : pkgSel.hotel!;
        const travelStr = travelPkg ? `${travelPkg.key} : ${travelPkg.price}` : pkgSel.travel!;
        const existingRegId = rIds[passengerId];

        if (existingRegId) {
          fetch(`${BASE_URL}/registrations/${existingRegId}/packages`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hotel_package: hotelStr, travel_package: travelStr }),
            keepalive: true,
          }).catch(() => {});
        } else {
          fetch(`${BASE_URL}/registrations/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              passenger_id: passengerId,
              user_id: userIdRef.current,
              yatra_id: yatraIdRef.current,
              hotel_package: hotelStr,
              travel_package: travelStr,
            }),
            keepalive: true,
          }).catch(() => {});
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []); // runs only on mount/unmount

  const pick = (pid: number, kind: keyof Selection, value: string) =>
    setSel((prev) => ({ ...prev, [pid]: { ...prev[pid], [kind]: value } }));

  // Change 2: Save on "Proceed to Pay" click, then open dialog
  const handleProceedToPay = useCallback(async () => {
    const newRegIds = await saveSelectionsToDB(
      sel,
      paidIds,
      regIds,
      user?.user_id ?? 0,
      Number(id),
      hotelOptionsRef.current,
      travelOptionsRef.current,
      false,
    );
    setRegIds(newRegIds);
    setRegToPax((prev) => {
      const next = { ...prev };
      for (const [paxId, regId] of Object.entries(newRegIds)) {
        next[regId] = Number(paxId);
      }
      return next;
    });
    setPayOpen(true);
  }, [sel, paidIds, regIds, user?.user_id, id]);

  const handleSaved = useCallback((newRegIds: Record<number, number>) => {
    setRegIds(newRegIds);
    setRegToPax((prev) => {
      const next = { ...prev };
      for (const [paxId, regId] of Object.entries(newRegIds)) {
        next[regId] = Number(paxId);
      }
      return next;
    });
  }, []);

  const handlePaid = useCallback((paidRegIds: number[]) => {
    setPaidIds((prev) => {
      const next = new Set(prev);
      for (const regId of paidRegIds) {
        const paxId = regToPax[regId];
        if (paxId) next.add(paxId);
      }
      return next;
    });
    setPayOpen(false);
  }, [regToPax]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!yatra) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Yatra not found.{" "}
        <Link to="/select-yatra" className="ml-1 font-semibold text-primary underline">
          Go back
        </Link>
      </div>
    );
  }

  const hotelOptions = (yatra.hotel_packages ?? []).map((p) => ({
    key: p.title,
    price: p.price,
  }));

  const travelOptions = (yatra.travel_packages ?? []).map((p) => ({
    key: p.title,
    price: p.price,
  }));

  return (
    <div className="min-h-dvh bg-muted/50 pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-gradient-primary px-4 py-4 text-primary-foreground shadow-glow">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            to="/select-yatra"
            aria-label="Back to Select Yatra"
            className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-primary-foreground/70"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold uppercase tracking-tight sm:text-2xl">
            Welcome to {yatra.title}
          </h1>
          <ArrowDownWideNarrow className="size-6 shrink-0" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 py-3">
        {/* Empty passengers state */}
        {passengers.length === 0 && (
          <div className="rounded-2xl bg-card px-6 py-10 text-center text-sm text-muted-foreground shadow-soft">
            <p className="mb-4">No saved passengers found. Please add passengers first.</p>
            <Link
              to="/personal-details"
              className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:opacity-90 active:scale-95"
            >
              + Add Passengers
            </Link>
          </div>
        )}

        {passengers.map((p) => {
          const s = sel[p.id] ?? {};
          const isPaid = paidIds.has(p.id);
          const isRegistered = Boolean(regIds[p.id]);
          const statusText = isPaid
            ? "Paid ✓"
            : isRegistered
              ? "Saved"
              : s.hotel && s.travel
                ? "Packages selected"
                : "Not Selected any Pack";

          return (
            <section key={p.id} className="bg-card px-4 py-4 shadow-soft sm:rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-x-3">
                <h2 className="text-base font-extrabold">Passenger ID: {p.id}</h2>
                <p className="text-sm font-extrabold">
                  Status:{" "}
                  <span
                    className={cn(
                      "font-medium",
                      isPaid
                        ? "text-green-600"
                        : isRegistered
                          ? "text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {statusText}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-base font-extrabold">
                  ({p.full_name}, {ageAtStart(p.year_of_birth, new Date(yatra.start_date).getFullYear())}Y, {genderInitial(p.gender)})
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(yatra.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{" "}
                  <span className="font-bold text-foreground">to</span>{" "}
                  {new Date(yatra.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              </div>

              {hotelOptions.length > 0 && (
                <OptionRow
                  label="Hotel Package"
                  options={hotelOptions}
                  selected={s.hotel}
                  tone="hotel"
                  disabled={isPaid}
                  onSelect={(v) => pick(p.id, "hotel", v)}
                />
              )}

              {travelOptions.length > 0 && (
                <OptionRow
                  label="Travel Package"
                  options={travelOptions}
                  selected={s.travel}
                  tone="travel"
                  disabled={isPaid}
                  onSelect={(v) => pick(p.id, "travel", v)}
                />
              )}
            </section>
          );
        })}
      </main>

      {passengers.length > 0 && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 px-4 py-4 text-center shadow-glow",
            acceptPayments ? "bg-gradient-primary" : "bg-muted",
          )}
        >
          <button
            type="button"
            onClick={acceptPayments ? handleProceedToPay : undefined}
            disabled={!acceptPayments}
            className={cn(
              "w-full text-xl font-extrabold tracking-tight",
              acceptPayments
                ? "text-primary-foreground"
                : "cursor-not-allowed text-muted-foreground",
            )}
          >
            {acceptPayments ? "Proceed to Pay" : "Payments Temporarily Unavailable"}
          </button>
        </div>
      )}

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        passengers={passengers}
        sel={sel}
        paidIds={paidIds}
        hotelOptions={hotelOptions}
        travelOptions={travelOptions}
        yatraId={yatra.id}
        userId={user?.user_id ?? 0}
        regIds={regIds}
        yatraStartYear={new Date(yatra.start_date).getFullYear()}
        onSaved={handleSaved}
        onPaid={handlePaid}
      />
    </div>
  );
}
