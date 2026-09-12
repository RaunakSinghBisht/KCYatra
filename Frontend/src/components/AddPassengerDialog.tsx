import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { states, stateOptions } from "@/lib/location-data";
import { cn } from "@/lib/utils";
import { Mars, Venus, X } from "lucide-react";

export type Passenger = {
  id: string;
  name: string;
  age: string;
  gender: "M" | "F";
  berth: string;
  food: string;
};

const genders = [
  { value: "M" as const, label: "Male", icon: Mars },
  { value: "F" as const, label: "Female", icon: Venus },
];

export function AddPassengerDialog({
  trigger,
  passenger,
  onSave,
}: {
  trigger: ReactNode;
  passenger?: Passenger;
  onSave: (p: Passenger) => void;
}) {
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState<Passenger["gender"]>(passenger?.gender ?? "M");
  const [ability, setAbility] = useState("not-required");
  const [name, setName] = useState(passenger?.name ?? "");
  const [year, setYear] = useState("");
  const [food, setFood] = useState(passenger?.food ?? "Veg");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");

  const districtOptions = useMemo(
    () => (state ? (states[state] ?? []).map((d) => ({ value: d, label: d })) : []),
    [state],
  );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const age = year ? String(new Date().getFullYear() - Number(year)) : (passenger?.age ?? "—");
    onSave({
      id: passenger?.id ?? `PSG-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      name: name.trim() || "Unnamed traveller",
      age,
      gender,
      berth: ability === "not-required" ? "NC" : "HC",
      food,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

          <Select value={ability} onValueChange={setAbility}>
            <SelectTrigger className="h-12 rounded-2xl font-semibold">
              <SelectValue placeholder="Special Assistance?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not-required">Special assistance- Not Required</SelectItem>
              <SelectItem value="required">Special assistance- Required</SelectItem>
            </SelectContent>
          </Select>


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

          <Input
            className="h-12 rounded-2xl"
            placeholder="Year of Birth"
            inputMode="numeric"
            maxLength={4}
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
          />
          <Input className="h-12 rounded-2xl" placeholder="Alternate Phone No (Optional)" inputMode="tel" />

          <div className="grid grid-cols-3 gap-2">
            <Select
              value={state}
              onValueChange={(value) => {
                setState(value);
                setDistrict("");
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

            <Select value={district} onValueChange={setDistrict} disabled={!state}>
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
            <Input className="h-12 rounded-2xl" placeholder="City" />
          </div>

          <Input className="h-12 rounded-2xl" placeholder="Aadhaar ID / Virtual ID (Optional)" inputMode="numeric" />



          <Button type="submit" className="mt-2 h-12 w-full rounded-2xl bg-gradient-primary text-base font-bold shadow-glow">
            {passenger ? "Save Passenger" : "Add Passenger"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
