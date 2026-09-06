import { useState, useMemo } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, ArrowDownWideNarrow, X } from "lucide-react";
import { yatraPackages } from "@/lib/yatra-data";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

const hotelOptions = [
  { key: "Basic", price: "₹430" },
  { key: "Standard", price: "₹1100" },
  { key: "Premium", price: "₹1800" },
];

const travelOptions = [
  { key: "Self", price: "₹0" },
  { key: "Train", price: "₹1100" },
  { key: "Flight", price: "₹5400" },
];

const passengers = [
  { id: "YB-USER-1042", name: "Avishkar Jaiswal", age: "20Y", gender: "M" },
  { id: "YB-USER-1043", name: "Shivang Pandey", age: "21Y", gender: "M" },
  { id: "YB-USER-1044", name: "Meera Jaiswal", age: "48Y", gender: "F" },
];

type Selection = { hotel?: string; travel?: string };

function parsePrice(value: string) {
  const num = Number(value.replace(/[^0-9]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}

function formatPrice(value: number) {
  return `₹ ${value.toLocaleString("en-IN")}`;
}

function BookYatra() {
  const { id } = useParams({ from: "/book/$id" });
  const pack = yatraPackages.find((p) => p.id === id) ?? yatraPackages[0]!;
  const [sel, setSel] = useState<Record<string, Selection>>({});
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [payOpen, setPayOpen] = useState(false);

  const pick = (pid: string, kind: keyof Selection, value: string) =>
    setSel((prev) => ({ ...prev, [pid]: { ...prev[pid], [kind]: value } }));

  const passengerTotal = (p: (typeof passengers)[number]) => {
    const s = sel[p.id] ?? {};
    const hotel = hotelOptions.find((o) => o.key === s.hotel);
    const travel = travelOptions.find((o) => o.key === s.travel);
    return parsePrice(pack.price) + parsePrice(hotel?.price ?? "0") + parsePrice(travel?.price ?? "0");
  };

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
            Welcome to {pack.name}
          </h1>
          <ArrowDownWideNarrow className="size-6 shrink-0" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 py-3">
        {passengers.map((p) => {
          const s = sel[p.id] ?? {};
          const isPaid = paidIds.has(p.id);
          const status = isPaid
            ? "Paid"
            : s.hotel && s.travel
              ? "Packages selected"
              : "Not Selected any Pack";
          return (
            <section key={p.id} className="bg-card px-4 py-4 shadow-soft sm:rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-x-3">
                <h2 className="text-base font-extrabold">User ID</h2>
                <p className="text-sm font-extrabold">
                  Status: <span className="font-medium text-muted-foreground">{status}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-base font-extrabold">
                  ({p.name}, {p.age}, {p.gender})
                </p>
                <p className="text-sm text-muted-foreground">
                  Mon, 24 Aug <span className="font-bold text-foreground">to</span> Tue, 25 Aug
                </p>
              </div>

              <OptionRow
                label="Hotel Package"
                options={hotelOptions}
                selected={s.hotel}
                tone="hotel"
                disabled={isPaid}
                onSelect={(v) => pick(p.id, "hotel", v)}
              />
              <OptionRow
                label="Travel Package"
                options={travelOptions}
                selected={s.travel}
                tone="travel"
                disabled={isPaid}
                onSelect={(v) => pick(p.id, "travel", v)}
              />
            </section>
          );
        })}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-primary px-4 py-4 text-center shadow-glow">
        <button
          type="button"
          onClick={() => setPayOpen(true)}
          className="w-full text-xl font-extrabold tracking-tight text-primary-foreground"
        >
          Proceed to Pay
        </button>
      </div>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        passengers={passengers}
        sel={sel}
        paidIds={paidIds}
        pack={pack}
        onPaid={(ids) => {
          setPaidIds((prev) => new Set([...prev, ...ids]));
          setPayOpen(false);
        }}
      />
    </div>
  );
}

function OptionRow({
  label,
  options,
  selected,
  tone,
  disabled,
  onSelect,
}: {
  label: string;
  options: { key: string; price: string }[];
  selected?: string | undefined;
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
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "hsl(var(--primary)) transparent",
          }}
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(o.key)}
              className={cn(
                "relative w-40 shrink-0 snap-start rounded-xl border px-3 py-3 text-left transition active:scale-95",
                tone === "hotel"
                  ? "border-primary/25 bg-accent/60"
                  : "border-primary/40 bg-secondary",
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
                {o.price}
              </span>
            </button>
          ))}
          {/* spacer so the last card peeks and scrolling feels intentional */}
          <div className="w-6 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
  passengers,
  sel,
  paidIds,
  pack,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  passengers: { id: string; name: string; age: string; gender: string }[];
  sel: Record<string, Selection>;
  paidIds: Set<string>;
  pack: { price: string };
  onPaid: (ids: string[]) => void;
}) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () =>
      passengers.map((p) => {
        const s = sel[p.id] ?? {};
        const isPaid = paidIds.has(p.id);
        const isSelectable = !isPaid && Boolean(s.hotel && s.travel);
        const hotel = hotelOptions.find((o) => o.key === s.hotel);
        const travel = travelOptions.find((o) => o.key === s.travel);
        const total = parsePrice(pack.price) + parsePrice(hotel?.price ?? "0") + parsePrice(travel?.price ?? "0");
        return { ...p, isPaid, isSelectable, total };
      }),
    [passengers, sel, paidIds, pack.price],
  );

  const grandTotal = rows
    .filter((r) => r.isSelectable && checkedIds.has(r.id))
    .reduce((sum, r) => sum + r.total, 0);

  const toggle = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePay = () => {
    onPaid([...checkedIds]);
    setCheckedIds(new Set());
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bottom-0 left-4 right-4 mx-auto max-w-lg gap-0 overflow-hidden rounded-t-3xl border-0 p-0 sm:rounded-3xl [&>button]:hidden"
      >
        {/* Drag handle + close button row */}
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
            const checked = r.isPaid || checkedIds.has(r.id);
            const labelRight = r.isPaid
              ? "Paid"
              : r.isSelectable
                ? formatPrice(r.total)
                : "Pack not Selected";
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 shadow-soft",
                  !r.isSelectable && !r.isPaid && "opacity-70",
                )}
              >
                <Checkbox
                  id={`pay-${r.id}`}
                  checked={checked}
                  disabled={!r.isSelectable}
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
                    {r.name}, {r.age}, {r.gender}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-extrabold",
                      r.isPaid
                        ? "text-primary"
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
          <button
            type="button"
            onClick={handlePay}
            disabled={checkedIds.size === 0}
            className="mt-4 w-full rounded-full bg-gradient-primary py-3.5 text-center text-xl font-extrabold tracking-tight text-primary-foreground shadow-glow disabled:opacity-60"
          >
            Pay Now
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
