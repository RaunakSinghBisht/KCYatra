import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SessionsPanel } from "@/components/SessionsPanel";
import { authFetch } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  BadgeCheck,
  Pencil,
  Trash2,
  UserRound,
  Users,
  Headphones,
  Mail,
  Phone,
  MessageCircle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardShell } from "@/components/DashboardShell";
import { useYatraAuth } from "@/lib/yatra-auth";
import { AddPassengerDialog, type Passenger } from "@/components/AddPassengerDialog";
import { BASE_URL } from "@/lib/api";
import { toast } from "sonner";

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

function PersonalDetails() {
  const { user, signOut, signOutAll } = useYatraAuth();
  const navigate = useNavigate();
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteDialogData, setDeleteDialogData] = useState<{ id: number; name: string; hasRegistrations: boolean } | null>(null);
  // ── Fetch passengers on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchPassengers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchPassengers() {
    if (!user?.user_id) {
      toast.error("Session expired — please log in again.");
      signOut();
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`${BASE_URL}/passengers/user/${user!.user_id}`);
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data: Passenger[] = await res.json();
      setPassengers(data);
    } catch (err) {
      toast.error("Could not load passengers — " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setLoading(false);
    }
  }

  // ── Called by AddPassengerDialog on success (add or edit) ─────────────────
  function handleSave(saved: Passenger) {
    setPassengers((prev) =>
      prev.some((x) => x.id === saved.id)
        ? prev.map((x) => (x.id === saved.id ? saved : x))
        : [...prev, saved],
    );
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDeleteRequest(id: number, name: string) {
    setDeletingId(id);
    try {
      const res = await authFetch(`${BASE_URL}/passengers/${id}/has-registrations`);
      if (!res.ok) throw new Error("Could not check registrations");
      const data = await res.json();
      setDeleteDialogData({ id, name, hasRegistrations: data.has_registrations });
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      setDeletingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteDialogData) return;
    const { id, name } = deleteDialogData;
    setDeletingId(id); // Use the same loader id for the button inside dialog
    try {
      const res = await authFetch(`${BASE_URL}/passengers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setPassengers((prev) => prev.filter((x) => x.id !== id));
      toast.success(`${name} removed.`);
    } catch (err) {
      toast.error("Could not delete — " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setDeletingId(null);
      setDeleteDialogData(null);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function ageFromYOB(yob: number) {
    return new Date().getFullYear() - yob;
  }

  function genderInitial(g: Passenger["gender"]) {
    return g === "male" ? "M" : "F";
  }

  return (
    <DashboardShell>
      {(user) => (
        <>
          {/* Profile hero */}
          <section className="rounded-3xl px-6 py-8 text-center shadow-glow" style={{ background: "linear-gradient(to bottom, oklch(0.68 0.19 45), oklch(0.96 0.09 80))" }}>
            <span className="mx-auto grid size-24 place-items-center rounded-full bg-white/80 backdrop-blur">
              <UserRound className="size-12 text-accent-foreground" />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-accent-foreground">Hare Krishna !</h1>
            <p className="mt-1 text-sm text-accent-foreground/75">{user.name}</p>
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
                userId={user.user_id}
                onSuccess={handleSave}
                trigger={
                  <Button className="rounded-full bg-gradient-primary px-6 font-bold shadow-glow">Add</Button>
                }
              />
            </header>

            <ul className="divide-y divide-border">
              {/* Loading state */}
              {loading && (
                <li className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading passengers…
                </li>
              )}

              {/* Empty state */}
              {!loading && passengers.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No passengers added yet. Tap <span className="font-semibold text-primary">Add</span> to get started.
                </li>
              )}

              {/* Passenger rows */}
              {!loading &&
                passengers.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                      <UserRound className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-bold">
                        {p.full_name} <BadgeCheck className="size-4 shrink-0 text-primary" />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ageFromYOB(p.year_of_birth)} Y, {genderInitial(p.gender)}
                        {p.city ? ` · ${p.city}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {/* Edit */}
                      <AddPassengerDialog
                        userId={user.user_id}
                        passenger={p}
                        onSuccess={handleSave}
                        trigger={
                          <Button size="icon" variant="ghost" aria-label={`Edit ${p.full_name}`} className="text-primary">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      {/* Delete */}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${p.full_name}`}
                        className="text-destructive"
                        disabled={deletingId === p.id}
                        onClick={() => handleDeleteRequest(p.id, p.full_name)}
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>

          <p className="mt-4 text-center text-sm text-black">
            After Adding Passengers goto{" "}
            <Link to="/select-yatra" className="font-bold text-blue-600 underline underline-offset-2 hover:text-blue-700">
              Select Yatra
            </Link>{" "}
            to Book Your Seat
          </p>

          <div className="mt-6">
            <SessionsPanel
              realm="user"
              onLogout={signOut}
              onLogoutAll={signOutAll}
              afterLogoutAll={() => navigate({ to: "/auth" })}
            />
          </div>

          {/* Contact Us */}
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

          <Dialog open={!!deleteDialogData} onOpenChange={(open) => !open && setDeleteDialogData(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Passenger</DialogTitle>
                <DialogDescription>
                  {deleteDialogData?.hasRegistrations
                    ? "Passenger Already Registered in a Yatra."
                    : `Are you sure you want to remove "${deleteDialogData?.name}" from your saved passengers?`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogData(null)}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete} disabled={deletingId !== null}>
                  {deletingId !== null ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </DashboardShell>
  );
}
