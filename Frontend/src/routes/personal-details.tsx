import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BadgeCheck, LogOut, Pencil, Trash2, UserRound, Users, Headphones, Mail, Phone, MessageCircle } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useYatraAuth } from "@/lib/yatra-auth";
import { AddPassengerDialog, type Passenger } from "@/components/AddPassengerDialog";

export const Route = createFileRoute("/personal-details")({
  head: () => ({
    meta: [
      { title: "Personal Details — Krishna Conscious Yatra" },
      { name: "description", content: "Manage your Krishna Conscious Yatra profile and saved passengers for faster bookings." },
      { property: "og:title", content: "Personal Details — Krishna Conscious Yatra" },
      { property: "og:description", content: "Your profile and saved passengers." },
    ],
  }),
  component: PersonalDetails,
});

const initialPassengers: Passenger[] = [
  { id: "PSG-1", name: "Avishkar Jaiswal", age: "20", gender: "M", berth: "NC", food: "Veg" },
  { id: "PSG-2", name: "Shivang Pandey", age: "21", gender: "M", berth: "NC", food: "Veg" },
];

function PersonalDetails() {
  const { signOut } = useYatraAuth();
  const [passengers, setPassengers] = useState(initialPassengers);

  const save = (p: Passenger) =>
    setPassengers((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p]));

  return (
    <DashboardShell>
      {(user) => (
        <>
          {/* Profile hero */}
          <section className="rounded-3xl bg-gradient-primary px-6 py-8 text-center text-primary-foreground shadow-glow">
            <span className="mx-auto grid size-24 place-items-center rounded-full bg-primary-foreground/20 backdrop-blur">
              <UserRound className="size-12" />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">+91 {user.phone}</h1>
            <p className="mt-1 text-sm text-primary-foreground/85">{user.name}</p>
          </section>



          {/* Saved passengers */}
          <section className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-accent px-4 py-4">
              <Users className="size-6 text-primary" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-extrabold text-accent-foreground">Saved Passengers</h2>
                <p className="truncate text-xs text-accent-foreground/75">Add / Edit passenger info</p>
              </div>
              <AddPassengerDialog
                onSave={save}
                trigger={
                  <Button className="rounded-full bg-gradient-primary px-6 font-bold shadow-glow">Add</Button>
                }
              />
            </header>

            <ul className="divide-y divide-border">
              {passengers.map((p) => (
                <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <UserRound className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-bold">
                      {p.name} <BadgeCheck className="size-4 shrink-0 text-primary" />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.age} Y, {p.gender}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AddPassengerDialog
                      passenger={p}
                      onSave={save}
                      trigger={
                        <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} className="text-primary">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${p.name}`}
                      className="text-destructive"
                      onClick={() => setPassengers((prev) => prev.filter((x) => x.id !== p.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
              {passengers.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">No saved passengers yet.</li>
              )}
            </ul>
          </section>

          {/* Contact Us - compact footer row */}
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
            <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Headphones className="size-4" />
              Contact Us
            </span>
            <div className="flex items-center gap-2">
              <a
                href="mailto:krishna.con.yatra@gmail.com"
                className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label="Email"
              >
                <Mail className="size-4" />
              </a>
              <a
                href="tel:+917020391800"
                className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label="Phone"
              >
                <Phone className="size-4" />
              </a>
              <a
                href="https://wa.me/918796976009"
                target="_blank"
                rel="noreferrer"
                className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label="WhatsApp"
              >
                <MessageCircle className="size-4" />
              </a>
            </div>
          </div>

          <Button variant="outline" className="mt-6 w-full font-bold sm:w-auto" onClick={signOut}>
            <LogOut className="size-4" /> Logout
          </Button>
        </>
      )}
    </DashboardShell>
  );
}
