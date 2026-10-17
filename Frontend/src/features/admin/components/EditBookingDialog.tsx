import { useState } from "react";
import { toast } from "sonner";
import { Mars, Venus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, useAdminStore, type AdminBooking } from "@/features/admin/lib/admin-store";
import { states, stateOptions } from "@/features/admin/lib/location-data";
import { cn } from "@/lib/utils";

const statuses: AdminBooking["status"][] = ["Paid", "Interested", "Pending"];

export function EditBookingDialog({ booking }: { booking: AdminBooking }) {
  const { data, update } = useAdminStore();
  const [open, setOpen] = useState(false);

  const initialYatra = data.yatras.find((y) => y.name === booking.yatra);
  const [yatraId, setYatraId] = useState(initialYatra?.id ?? "");
  const [name, setName] = useState(booking.passenger);
  const [year, setYear] = useState(booking.yearOfBirth ?? "");
  const [assistance, setAssistance] = useState<"Required" | "Not Required">(booking.assistance ?? "Not Required");
  const [state, setState] = useState(booking.state ?? "");
  const [district, setDistrict] = useState(booking.district ?? "");
  const [city, setCity] = useState(booking.city ?? "");
  const [aadhaar, setAadhaar] = useState(booking.aadhaar ?? "");
  const [gender, setGender] = useState<"M" | "F">(booking.gender);
  const [phone, setPhone] = useState(booking.phone ?? "");
  const [hotelId, setHotelId] = useState(
    data.hotelPackages.find((p) => p.yatraId === (initialYatra?.id ?? "") && p.name === booking.hotelPackage)?.id ?? "",
  );
  const [travelId, setTravelId] = useState(
    data.travelPackages.find((p) => p.yatraId === (initialYatra?.id ?? "") && p.name === booking.travelPackage)?.id ?? "",
  );
  const [concession, setConcession] = useState(String(booking.concession));
  const [status, setStatus] = useState<AdminBooking["status"]>(booking.status);

  const yatra = data.yatras.find((y) => y.id === yatraId);
  const hotels = data.hotelPackages.filter((p) => p.yatraId === yatraId);
  const travels = data.travelPackages.filter((p) => p.yatraId === yatraId);
  const hotel = hotels.find((p) => p.id === hotelId);
  const travel = travels.find((p) => p.id === travelId);
  const total = Math.max(0, (hotel?.price ?? 0) + (travel?.price ?? 0) - (Number(concession) || 0));

  const save = () => {
    if (!yatra) { toast.error("Select a yatra"); return; }
    if (!name.trim()) { toast.error("Enter passenger name"); return; }
    const ageNum = new Date().getFullYear() - Number(year);
    if (year.length !== 4 || ageNum < 1 || ageNum > 120) { toast.error("Enter a valid year of birth"); return; }

    const oldHotelId = data.hotelPackages.find((p) => p.name === booking.hotelPackage && data.yatras.find((y) => y.id === p.yatraId)?.name === booking.yatra)?.id;
    const oldTravelId = data.travelPackages.find((p) => p.name === booking.travelPackage && data.yatras.find((y) => y.id === p.yatraId)?.name === booking.yatra)?.id;

    const next: AdminBooking = {
      ...booking,
      passenger: name.trim(),
      age: ageNum,
      gender,
      yearOfBirth: year,
      assistance,
      phone: phone.trim(),
      state, district, city: city.trim(), aadhaar: aadhaar.trim(),
      yatra: yatra.name,
      hotelPackage: hotel?.name ?? "—",
      travelPackage: travel?.name ?? "—",
      concession: Number(concession) || 0,
      total,
      journeyDate: yatra.startDate,
      status,
    };
    update({
      bookings: data.bookings.map((b) => (b.id === booking.id ? next : b)),
      hotelPackages: data.hotelPackages.map((p) => {
        let seats = p.seatsBooked;
        if (p.id === oldHotelId && oldHotelId !== hotelId) seats = Math.max(0, seats - 1);
        if (p.id === hotelId && hotelId !== oldHotelId) seats = seats + 1;
        return { ...p, seatsBooked: seats };
      }),
      travelPackages: data.travelPackages.map((p) => {
        let seats = p.seatsBooked;
        if (p.id === oldTravelId && oldTravelId !== travelId) seats = Math.max(0, seats - 1);
        if (p.id === travelId && travelId !== oldTravelId) seats = seats + 1;
        return { ...p, seatsBooked: seats };
      }),
    });
    toast.success(`${next.passenger}'s booking updated`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={`Edit ${booking.passenger}`}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-h-[92dvh] w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-lg [&>button]:hidden">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-extrabold tracking-normal">Edit Booking · {booking.id}</DialogTitle>
            <DialogClose asChild>
              <Button type="button" size="icon" aria-label="Close" className="size-9 rounded-full border-2 border-card shadow-glow"><X className="size-4" /></Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); save(); }} className="grid gap-3 px-4 py-4 [&_input]:h-11 [&_input]:min-w-0 [&_input]:rounded-full [&_input]:shadow-sm [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full [&_button[role=combobox]]:min-w-0 [&_button[role=combobox]]:rounded-full [&_button[role=combobox]]:shadow-sm">
          <div className="grid gap-1.5">
            <Label>Yatra</Label>
            <Select value={yatraId} onValueChange={(v) => { setYatraId(v); setHotelId(""); setTravelId(""); }}>
              <SelectTrigger aria-label="Yatra"><SelectValue placeholder="Select yatra" /></SelectTrigger>
              <SelectContent>{data.yatras.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([{ value: "M", label: "Male", icon: Mars }, { value: "F", label: "Female", icon: Venus }] as const).map((g) => (
              <Button key={g.value} type="button" variant="outline" aria-pressed={gender === g.value} onClick={() => setGender(g.value)} className={cn("h-16 flex-col gap-1 rounded-2xl text-xs text-muted-foreground", gender === g.value && "border-primary bg-accent text-accent-foreground")}>
                <g.icon className="size-5" />{g.label}
              </Button>
            ))}
          </div>
          <Select value={assistance} onValueChange={(value) => setAssistance(value as typeof assistance)}>
            <SelectTrigger aria-label="Special assistance"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Not Required">Special assistance- Not Required</SelectItem>
              <SelectItem value="Required">Special assistance- Required</SelectItem>
            </SelectContent>
          </Select>
          <Input aria-label="Full Name" placeholder="Full Name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <p className="-mt-1 text-[10px] text-muted-foreground">Please submit Name (Max. 60 char) and Date of Birth as per Aadhaar.</p>
          <Input aria-label="Year of Birth" placeholder="Year of Birth" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} />
          <Input aria-label="Alternate Phone No (Optional)" placeholder="Alternate Phone No (Optional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="grid min-w-0 grid-cols-3 gap-2">
            <Select value={state} onValueChange={(v) => { setState(v); setDistrict(""); }}>
              <SelectTrigger aria-label="State"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>{stateOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={district} onValueChange={setDistrict} disabled={!state}>
              <SelectTrigger aria-label="District"><SelectValue placeholder={state ? "District" : "Select state"} /></SelectTrigger>
              <SelectContent>{(states[state] ?? []).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <Input aria-label="City" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <Input aria-label="Aadhaar ID / Virtual ID (Optional)" placeholder="Aadhaar ID / Virtual ID (Optional)" inputMode="numeric" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid min-w-0 gap-1.5">
              <Label>Hotel package</Label>
              <Select value={hotelId} onValueChange={setHotelId} disabled={!yatraId || hotels.length === 0}>
                <SelectTrigger aria-label="Hotel package"><SelectValue placeholder={hotels.length ? "Select" : "None"} /></SelectTrigger>
                <SelectContent>{hotels.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {inr(p.price)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>Travel package</Label>
              <Select value={travelId} onValueChange={setTravelId} disabled={!yatraId || travels.length === 0}>
                <SelectTrigger aria-label="Travel package"><SelectValue placeholder={travels.length ? "Select" : "None"} /></SelectTrigger>
                <SelectContent>{travels.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {inr(p.price)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`eb-con-${booking.id}`}>Concession (₹)</Label>
              <Input id={`eb-con-${booking.id}`} type="number" inputMode="numeric" value={concession} onChange={(e) => setConcession(e.target.value)} />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label>Payment status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AdminBooking["status"])}>
                <SelectTrigger aria-label="Payment status"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm font-bold">Total: {inr(total)}</p>
          <Button type="submit" className="h-11 w-full rounded-full bg-gradient-primary font-bold shadow-glow">Save Changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
