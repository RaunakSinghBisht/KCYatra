import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
} from "lucide-react";
import { AdminShell, ExportButtons } from "@/features/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportCsv, exportExcel } from "@/features/admin/lib/export-records";
import { BASE_URL } from "@/lib/api";

export interface PassengerRecord {
  id: number;
  user_id: number;
  full_name: string;
  gender: string;
  year_of_birth: number;
  special_assistance: string;
  state: string | null;
  district: string | null;
  city: string | null;
  phone_no: string | null;
  created_at: string;
  is_deleted: boolean;
  login_phone: string | null;
  bookings_count: number;
  latest_transaction_id: string | null;
}

export const Route = createFileRoute("/admin224151/users")({
  head: () => ({
    meta: [
      { title: "Passengers — Krishna Conscious Yatra Admin" },
      { name: "description", content: "Manage registered travellers on Krishna Conscious Yatra." },
      { property: "og:title", content: "Passengers — Krishna Conscious Yatra Admin" },
      { property: "og:description", content: "Manage registered travellers on Krishna Conscious Yatra." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsers,
});

function formatDate(isoString?: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    return d.toISOString().split("T")[0]!;
  } catch {
    return "—";
  }
}

function formatGender(gender?: string): string {
  if (!gender) return "—";
  const g = gender.trim().toLowerCase();
  if (g === "male" || g === "m") return "Male";
  if (g === "female" || g === "f") return "Female";
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

async function patchSiteSettings(patch: { otp_enabled?: boolean; accept_payments?: boolean }) {
  const res = await fetch(`${BASE_URL}/dam-page/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to save setting");
  return res.json() as Promise<{ otp_enabled: boolean; accept_payments: boolean }>;
}

function AdminUsers() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [otpEnabled, setOtpEnabled] = useState(true);
  const [acceptPayments, setAcceptPayments] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);

  // Load site settings on mount
  useEffect(() => {
    fetch(`${BASE_URL}/dam-page/`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { otp_enabled: boolean; accept_payments: boolean }) => {
        setOtpEnabled(data.otp_enabled);
        setAcceptPayments(data.accept_payments);
      })
      .catch(() => { /* keep defaults */ });
  }, []);
  const [editing, setEditing] = useState<PassengerRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingPassenger, setDeletingPassenger] = useState<PassengerRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch live passengers from backend passenger table
  const {
    data: passengers = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<PassengerRecord[]>({
    queryKey: ["admin", "passengers"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/passengers/`);
      if (!res.ok) {
        throw new Error(`Failed to fetch passengers from server (HTTP ${res.status})`);
      }
      return res.json();
    },
  });

  // Filter passengers based on search input
  const filteredPassengers = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return passengers;
    return passengers.filter((p) => {
      const matchFields = [
        p.full_name,
        p.login_phone,
        p.phone_no,
        p.city,
        p.district,
        p.state,
        `kcy${p.id}`,
        `kcy-${p.id}`,
        `ps-${p.id}`,
        String(p.id),
        String(p.user_id),
        p.gender,
        p.special_assistance,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchFields.includes(query);
    });
  }, [passengers, q]);

  // Export helper — columns in user-specified order
  const getExportData = () =>
    filteredPassengers.map((p, i) => ({
      "S. No.": i + 1,
      "Parent Phone No": p.login_phone ? `+91 ${p.login_phone}` : "—",
      "Name": p.full_name,
      "Gender": formatGender(p.gender),
      "Year of Birth": p.year_of_birth,
      "Phone No.": p.phone_no ? `+91 ${p.phone_no}` : "—",
      "City": p.city || "—",
      "District": p.district || "—",
      "State": p.state || "—",
      "Special Assistance": p.special_assistance || "—",
    }));

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!editing.year_of_birth || isNaN(Number(editing.year_of_birth))) {
      toast.error("Valid year of birth is required");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`${BASE_URL}/passengers/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editing.full_name.trim(),
          gender: editing.gender.toLowerCase(),
          year_of_birth: Number(editing.year_of_birth),
          special_assistance: editing.special_assistance?.trim() || "Not Required",
          phone_no: editing.phone_no ? editing.phone_no.trim() : null,
          state: editing.state ? editing.state.trim() : null,
          district: editing.district ? editing.district.trim() : null,
          city: editing.city ? editing.city.trim() : null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to update passenger (HTTP ${res.status})`);
      }

      toast.success("Passenger updated successfully");
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "passengers"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update passenger";
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingPassenger) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/passengers/${deletingPassenger.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete passenger (HTTP ${res.status})`);
      }

      toast.success(`Passenger "${deletingPassenger.full_name}" deleted`);
      setDeletingPassenger(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "passengers"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete passenger";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminShell
      title="Users"
      description="Registered travellers with quick edit and delete."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="font-semibold"
            disabled={isFetching}
            onClick={() => {
              refetch();
              toast.info("Refreshed passenger data");
            }}
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <ExportButtons
            onCsv={() => {
              const data = getExportData();
              if (exportCsv(data, "kcy-passengers")) {
                toast.success("CSV downloaded");
              } else {
                toast.error("No passengers to export");
              }
            }}
            onExcel={() => {
              const data = getExportData();
              if (exportExcel(data, "kcy-passengers")) {
                toast.success("Excel downloaded");
              } else {
                toast.error("No passengers to export");
              }
            }}
          />
        </div>
      }
    >
      <p className="text-sm font-semibold text-muted-foreground">
        {passengers.length} registered users
      </p>

      {/* Top Toggle: Enable OTP Login */}
      <div className="flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="min-w-0">
          <Label htmlFor="otp-login-switch" className="text-sm font-bold">
            Enable OTP Login
          </Label>
          <p className="text-xs text-muted-foreground">
            {otpEnabled
              ? "Users verify a one-time password after entering their phone number."
              : "Users log in with just their phone number — no OTP needed."}
          </p>
        </div>
        <Switch
          id="otp-login-switch"
          checked={otpEnabled}
          disabled={savingToggle}
          onCheckedChange={async (on) => {
            setOtpEnabled(on);
            setSavingToggle(true);
            try {
              await patchSiteSettings({ otp_enabled: on });
              toast.success(on ? "OTP Login enabled" : "OTP Login disabled — phone number alone will sign users in");
            } catch {
              setOtpEnabled(!on);
              toast.error("Failed to save setting");
            } finally {
              setSavingToggle(false);
            }
          }}
          aria-label="Toggle OTP Login"
        />
      </div>

      {/* Top Toggle: Accept Payment */}
      <div className="flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="min-w-0">
          <Label htmlFor="accept-payment-switch" className="text-sm font-bold">
            Accept Payment
          </Label>
          <p className="text-xs text-muted-foreground">
            {acceptPayments
              ? "Users can pay for their bookings normally."
              : "Payments are stopped — users cannot pay for bookings right now."}
          </p>
        </div>
        <Switch
          id="accept-payment-switch"
          checked={acceptPayments}
          disabled={savingToggle}
          onCheckedChange={async (on) => {
            setAcceptPayments(on);
            setSavingToggle(true);
            try {
              await patchSiteSettings({ accept_payments: on });
              toast.success(on ? "Payments enabled" : "Payments disabled — users cannot pay");
            } catch {
              setAcceptPayments(!on);
              toast.error("Failed to save setting");
            } finally {
              setSavingToggle(false);
            }
          }}
          aria-label="Toggle Accept Payment"
        />
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search passengers by name, phone, city..."
          className="pl-9"
        />
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading passengers from database...
          </div>
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40 p-4"
            />
          ))}
        </div>
      )}

      {/* Error Banner */}
      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive shadow-soft">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 translate-y-0.5" />
            <div className="flex-1">
              <p className="font-bold">Failed to load passenger data</p>
              <p className="mt-1 text-xs opacity-90">
                {error instanceof Error ? error.message : "Could not connect to the backend API."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-3 border-destructive/30 bg-card text-foreground font-semibold hover:bg-destructive/15"
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Passenger List */}
      {!isLoading && !isError && (
        <>
          {q.trim() && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredPassengers.length} of {passengers.length} users matching "{q}"
            </p>
          )}

          <div className="space-y-3">
            {filteredPassengers.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:border-border/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID : PSG{p.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-semibold"
                      onClick={() => setEditing({ ...p })}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeletingPassenger(p)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Primary table fields displayed in card grid */}
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <Cell
                    label="Login Phone No"
                    value={p.login_phone ? `+91 ${p.login_phone}` : "—"}
                  />
                  <Cell label="Gender" value={formatGender(p.gender)} />
                  <Cell label="Year of Birth" value={p.year_of_birth ? String(p.year_of_birth) : "—"} />
                  <Cell
                    label="Special Assistance"
                    value={p.special_assistance || "Not Required"}
                  />
                  <Cell
                    label="Alternate Phone No"
                    value={p.phone_no ? `+91 ${p.phone_no}` : "—"}
                  />
                  <Cell label="State" value={p.state || "—"} />
                  <Cell label="District" value={p.district || "—"} />
                  <Cell label="City" value={p.city || "—"} />
                  <Cell
                    label="Is Deleted"
                    value={p.is_deleted ? "True" : "False"}
                  />
                </dl>
              </article>
            ))}

            {filteredPassengers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <UserCheck className="mx-auto size-8 opacity-40 mb-2" />
                <p className="font-semibold text-foreground">No passengers found</p>
                <p className="mt-1 text-xs">
                  {q.trim()
                    ? "Try adjusting your search query to find the passenger."
                    : "There are currently no passenger records in the database."}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Edit Passenger Dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Passenger</DialogTitle>
            <DialogDescription>
              ID : PSG{editing?.id}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label>Gender</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                      { value: "other", label: "Other" },
                    ] as const
                  ).map((g) => (
                    <Button
                      key={g.value}
                      type="button"
                      variant="outline"
                      aria-pressed={editing.gender.toLowerCase() === g.value}
                      onClick={() => setEditing({ ...editing, gender: g.value })}
                      className={
                        editing.gender.toLowerCase() === g.value
                          ? "border-primary bg-accent text-accent-foreground font-bold"
                          : ""
                      }
                    >
                      {g.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-passenger-name">Full Name *</Label>
                <Input
                  id="edit-passenger-name"
                  maxLength={50}
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-passenger-yob">Year of Birth *</Label>
                  <Input
                    id="edit-passenger-yob"
                    inputMode="numeric"
                    maxLength={4}
                    value={editing.year_of_birth ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        year_of_birth: Number(e.target.value.replace(/\D/g, "")),
                      })
                    }
                    placeholder="e.g. 1995"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-passenger-assistance">Special Assistance</Label>
                  <select
                    id="edit-passenger-assistance"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    value={
                      editing.special_assistance === "Required" ||
                      editing.special_assistance === "Not Required"
                        ? editing.special_assistance
                        : "Required"
                    }
                    onChange={(e) =>
                      setEditing({ ...editing, special_assistance: e.target.value })
                    }
                  >
                    <option value="Not Required">Not Required</option>
                    <option value="Required">Required</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-passenger-phone">Alternate Phone No (Optional)</Label>
                <Input
                  id="edit-passenger-phone"
                  inputMode="tel"
                  maxLength={10}
                  value={editing.phone_no ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, phone_no: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="10 digit phone number"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-passenger-state">State</Label>
                  <Input
                    id="edit-passenger-state"
                    value={editing.state ?? ""}
                    onChange={(e) => setEditing({ ...editing, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-passenger-district">District</Label>
                  <Input
                    id="edit-passenger-district"
                    value={editing.district ?? ""}
                    onChange={(e) => setEditing({ ...editing, district: e.target.value })}
                    placeholder="District"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-passenger-city">City</Label>
                  <Input
                    id="edit-passenger-city"
                    value={editing.city ?? ""}
                    onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="font-semibold">
              {savingEdit ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deletingPassenger !== null}
        onOpenChange={(open) => !open && setDeletingPassenger(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete passenger record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{deletingPassenger?.full_name}</strong> (ID : PSG{deletingPassenger?.id})? This will perform a safe soft-delete so past registration
              and booking history remains intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Passenger"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
