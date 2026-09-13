import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { states, stateOptions } from "@/lib/location-data";
import { cn } from "@/lib/utils";
import { Mars, Venus, X } from "lucide-react";
import { BASE_URL } from "@/lib/api";

// ─── Types matching the backend schema ───────────────────────────────────────

/** Shape returned by GET /passengers/user/{user_id} */
export type Passenger = {
  id: number;
  user_id: number;
  full_name: string;
  gender: "male" | "female";
  year_of_birth: number;
  special_assistance: string;
  state: string | null;
  city: string | null;
  aadhaar_no: string | null;
  created_at: string;
};

const genders = [
  { value: "male" as const, label: "Male", icon: Mars },
  { value: "female" as const, label: "Female", icon: Venus },
];

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  trigger: ReactNode;
  userId: number;
  /** When provided → Edit mode. Omit → Add mode. */
  passenger?: Passenger;
  onSuccess: (p: Passenger) => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AddPassengerDialog({ trigger, userId, passenger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state — pre-fill in edit mode
  const [gender, setGender] = useState<"male" | "female">(passenger?.gender ?? "male");
  const [ability, setAbility] = useState(passenger?.special_assistance ?? "Not Required");
  const [name, setName] = useState(passenger?.full_name ?? "");
  const [year, setYear] = useState(passenger?.year_of_birth ? String(passenger.year_of_birth) : "");
  const [state, setState] = useState(passenger?.state ?? "");
  const [city, setCity] = useState(passenger?.city ?? "");
  const [aadhaar, setAadhaar] = useState(passenger?.aadhaar_no ?? "");

  const districtOptions = useMemo(
    () => (state ? (states[state] ?? []).map((d) => ({ value: d, label: d })) : []),
    [state],
  );

  // Reset form to initial / edit values when dialog opens
  function resetForm() {
    setGender(passenger?.gender ?? "male");
    setAbility(passenger?.special_assistance ?? "Not Required");
    setName(passenger?.full_name ?? "");
    setYear(passenger?.year_of_birth ? String(passenger.year_of_birth) : "");
    setState(passenger?.state ?? "");
    setCity(passenger?.city ?? "");
    setAadhaar(passenger?.aadhaar_no ?? "");
  }

  function handleOpenChange(next: boolean) {
    if (next) resetForm();
    setOpen(next);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // ── Client-side validation ──
    if (!name.trim()) { toast.error("Full name is required"); return; }
    const yob = Number(year);
    if (!year || isNaN(yob) || yob < 1900 || yob > new Date().getFullYear()) {
      toast.error("Enter a valid year of birth");
      return;
    }
    if (!gender) { toast.error("Please select a gender"); return; }

    setLoading(true);
    try {
      const body = {
        user_id: userId,
        full_name: name.trim(),
        gender,
        year_of_birth: yob,
        special_assistance: ability,
        state: state || null,
        city: city.trim() || null,
        aadhaar_no: aadhaar.trim() || null,
      };

      const isEdit = Boolean(passenger);
      const url = isEdit
        ? `${BASE_URL}/passengers/${passenger!.id}`
        : `${BASE_URL}/passengers/`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const msg = err?.detail ?? `Request failed (${res.status})`;
        toast.error(msg);
        return; // keep modal open
      }

      const saved: Passenger = await res.json();
      onSuccess(saved);
      toast.success(isEdit ? "Passenger updated!" : "Passenger added!");
      setOpen(false);
    } catch {
      toast.error("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-lg">
        <DialogHeader className="sticky top-0 z-10 rounded-t-3xl border-b border-border bg-card px-5 py-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-xl font-extrabold">
              {passenger ? "Edit Passenger" : "Add Passenger"}
            </DialogTitle>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-white bg-primary text-white shadow-lg shadow-primary/30 transition-transform active:scale-95"
              >
                <X className="size-5" strokeWidth={3} />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3 px-5 py-4">
          {/* Gender toggle */}
          <div className="grid grid-cols-3 gap-3">
            {genders.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGender(g.value)}
                aria-pressed={gender === g.value}
                className={cn(
                  "grid place-items-center gap-1 rounded-2xl border-2 border-border bg-card px-2 py-3 text-xs font-semibold text-muted-foreground transition-colors",
                  gender === g.value && "border-primary bg-accent text-accent-foreground",
                )}
              >
                <g.icon className="size-6" />
                <span className="truncate">{g.label}</span>
              </button>
            ))}
          </div>

          {/* Special assistance */}
          <Select value={ability} onValueChange={setAbility}>
            <SelectTrigger className="h-12 rounded-2xl font-semibold">
              <SelectValue placeholder="Special Assistance?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Not Required">Special assistance- Not Required</SelectItem>
              <SelectItem value="Required">Special assistance- Required</SelectItem>
            </SelectContent>
          </Select>

          {/* Full name */}
          <Input
            className="h-12 rounded-2xl"
            placeholder="Full Name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="-mt-1 text-xs text-muted-foreground">
            Please submit Name (Max. 60 char) and Date of Birth as per Aadhaar.
          </p>

          {/* Year of birth */}
          <Input
            className="h-12 rounded-2xl"
            placeholder="Year of Birth"
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
          />

          {/* State / City */}
          <div className="grid grid-cols-3 gap-2">
            <Select
              value={state}
              onValueChange={(value) => {
                setState(value);
                setCity("");
              }}
            >
              <SelectTrigger className="h-12 rounded-2xl font-semibold">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={city} onValueChange={setCity} disabled={!state}>
              <SelectTrigger className="h-12 rounded-2xl font-semibold">
                <SelectValue placeholder={state ? "District" : "Select state"} />
              </SelectTrigger>
              <SelectContent>
                {districtOptions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              className="h-12 rounded-2xl"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          {/* Aadhaar */}
          <Input
            className="h-12 rounded-2xl"
            placeholder="Aadhaar ID / Virtual ID (Optional)"
            inputMode="numeric"
            value={aadhaar}
            onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
          />

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-12 w-full rounded-2xl bg-gradient-primary text-base font-bold shadow-glow disabled:opacity-70"
          >
            {loading ? "Saving…" : passenger ? "Save Passenger" : "Add Passenger"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
