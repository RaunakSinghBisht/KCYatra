import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar, ImagePlus, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminShell, ExportButtons } from "@/features/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { exportCsv, exportExcel } from "@/features/admin/lib/export-records";

export const Route = createFileRoute("/admin224151/yatras")({
  head: () => ({
    meta: [
      { title: "Manage Yatras — Krishna Conscious Yatra Admin" },
      { name: "description", content: "Create, edit and publish yatras with hotel and travel packages." },
      { property: "og:title", content: "Manage Yatras — Krishna Conscious Yatra Admin" },
      { property: "og:description", content: "Create, edit and publish yatras with hotel and travel packages." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminYatras,
});

// ── Types ──────────────────────────────────────────────────────────────────────
type HotelPkg = { title: string; price: number };
type TravelPkg = { title: string; price: number };

type YatraStatus = "upcoming" | "open" | "close";

type YatraRow = {
  id: number;
  title: string;
  image_url: string | null;
  start_date: string;
  is_start_date_fixed: boolean;
  end_date: string;
  is_end_date_fixed: boolean;
  hotel_packages: HotelPkg[] | null;
  travel_packages: TravelPkg[] | null;
  description: string | null;
  whatsapp_group_link: string | null;
  allow_whatsapp_before_payment: boolean;
  status: YatraStatus;
  created_at?: string;
};

type DraftForm = {
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  whatsapp_group_link: string;
  allow_whatsapp_before_payment: boolean;
  status: YatraStatus;
  hotel_packages: HotelPkg[];
  travel_packages: TravelPkg[];
};

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const emptyDraft: DraftForm = {
  title: "",
  start_date: "",
  end_date: "",
  description: "",
  whatsapp_group_link: "",
  allow_whatsapp_before_payment: false,
  status: "upcoming",
  hotel_packages: [],
  travel_packages: [],
};

// ── API helpers ────────────────────────────────────────────────────────────────
async function fetchYatras(): Promise<YatraRow[]> {
  const res = await fetch(`${BASE_URL}/yatras/`);
  if (!res.ok) throw new Error("Failed to fetch yatras");
  return res.json();
}

async function createYatraApi(draft: DraftForm, imageFile: File | null): Promise<YatraRow> {
  const form = new FormData();
  form.append("title", draft.title);
  form.append("start_date", draft.start_date);
  form.append("end_date", draft.end_date);
  form.append("status", draft.status);
  if (draft.description) form.append("description", draft.description);
  if (draft.whatsapp_group_link) form.append("whatsapp_group_link", draft.whatsapp_group_link);
  form.append("allow_whatsapp_before_payment", String(draft.allow_whatsapp_before_payment));
  if (draft.hotel_packages.length) form.append("hotel_packages", JSON.stringify(draft.hotel_packages));
  if (draft.travel_packages.length) form.append("travel_packages", JSON.stringify(draft.travel_packages));
  if (imageFile) form.append("image", imageFile);

  const res = await fetch(`${BASE_URL}/yatras/`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to create yatra");
  }
  return res.json();
}

async function updateYatraApi(id: number, draft: DraftForm, imageFile: File | null): Promise<YatraRow> {
  const form = new FormData();
  form.append("title", draft.title);
  form.append("start_date", draft.start_date);
  form.append("end_date", draft.end_date);
  form.append("status", draft.status);
  form.append("description", draft.description);
  form.append("whatsapp_group_link", draft.whatsapp_group_link);
  form.append("allow_whatsapp_before_payment", String(draft.allow_whatsapp_before_payment));
  form.append("hotel_packages", JSON.stringify(draft.hotel_packages));
  form.append("travel_packages", JSON.stringify(draft.travel_packages));
  if (imageFile) form.append("image", imageFile);

  const res = await fetch(`${BASE_URL}/yatras/${id}`, { method: "PUT", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to update yatra");
  }
  return res.json();
}

async function deleteYatraApi(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/yatras/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete yatra");
}

// ── Status badge colours ───────────────────────────────────────────────────────
const statusBadge: Record<YatraStatus, "default" | "secondary" | "destructive"> = {
  open: "default",
  upcoming: "secondary",
  close: "destructive",
};

const statusLabel: Record<YatraStatus, string> = {
  open: "Open",
  upcoming: "Upcoming",
  close: "Closed",
};

// ── Main component ─────────────────────────────────────────────────────────────
function AdminYatras() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: yatras = [], isLoading, isError } = useQuery({
    queryKey: ["admin-yatras"],
    queryFn: fetchYatras,
  });

  const createMut = useMutation({
    mutationFn: (draft: DraftForm) => createYatraApi(draft, imageFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-yatras"] });
      toast.success("Yatra created successfully");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: DraftForm }) => updateYatraApi(id, draft, imageFile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-yatras"] });
      toast.success("Yatra updated");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteYatraApi,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-yatras"] });
      toast.success("Yatra deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditId(null);
    setDraft(emptyDraft);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setOpen(true);
  };

  const openEdit = (y: YatraRow) => {
    setEditId(y.id);
    setDraft({
      title: y.title,
      start_date: y.start_date,
      end_date: y.end_date,
      description: y.description ?? "",
      whatsapp_group_link: y.whatsapp_group_link ?? "",
      allow_whatsapp_before_payment: y.allow_whatsapp_before_payment ?? false,
      status: y.status,
      hotel_packages: y.hotel_packages ?? [],
      travel_packages: y.travel_packages ?? [],
    });
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(y.image_url);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditId(null);
    setDraft(emptyDraft);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const save = () => {
    if (!draft.title.trim()) { toast.error("Yatra title is required"); return; }
    if (!draft.start_date) { toast.error("Start date is required"); return; }
    if (!draft.end_date) { toast.error("End date is required"); return; }
    if (draft.end_date < draft.start_date) { toast.error("End date must be on or after start date"); return; }
    if (editId !== null) {
      updateMut.mutate({ id: editId, draft });
    } else {
      createMut.mutate(draft);
    }
  };

  const isBusy = createMut.isPending || updateMut.isPending;

  return (
    <AdminShell
      title="Yatra Packages"
      description="Create a yatra and define its hotel and travel packages in one place."
      actions={
        <>
          <ExportButtons
            onCsv={() => exportCsv(yatras, "kcy-yatras")}
            onExcel={() => exportExcel(yatras, "kcy-yatras")}
          />
          <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary font-bold shadow-glow" onClick={openCreate}>
                <Plus className="size-4" /> New Yatra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit yatra" : "Create new yatra"}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Title */}
                <Field label="Yatra title" className="sm:col-span-2">
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. Dwarka Yatra 2026"
                    maxLength={50}
                  />
                </Field>

                {/* Dates */}
                <Field label="Start date">
                  <Input
                    type="date"
                    value={draft.start_date}
                    onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  />
                </Field>
                <Field label="End date">
                  <Input
                    type="date"
                    value={draft.end_date}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  />
                </Field>

                {/* Status */}
                <Field label="Status">
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setDraft({ ...draft, status: v as YatraStatus })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="close">Close</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {/* WhatsApp */}
                <Field label="WhatsApp group link">
                  <Input
                    value={draft.whatsapp_group_link}
                    onChange={(e) => setDraft({ ...draft, whatsapp_group_link: e.target.value })}
                    placeholder="https://chat.whatsapp.com/..."
                  />
                </Field>

                {/* Description */}
                <Field label="Description" className="sm:col-span-2">
                  <Textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Brief description of the yatra (max 500 chars)"
                    maxLength={500}
                    rows={3}
                  />
                  <p className="text-right text-xs text-muted-foreground">{draft.description.length}/500</p>
                </Field>


                {/* Banner image upload */}
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-xs font-semibold">Yatra Banner Image</Label>
                  <div
                    className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 transition hover:border-primary/60 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-36 w-full rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); clearImage(); }}
                          className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-destructive hover:bg-destructive hover:text-white transition"
                          aria-label="Remove image"
                        >
                          <X className="size-4" />
                        </button>
                      </>
                    ) : existingImageUrl ? (
                      <>
                        <img
                          src={existingImageUrl}
                          alt="Current banner"
                          className="h-36 w-full rounded-lg object-cover opacity-70"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Current image · click to replace</p>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 py-4 text-muted-foreground">
                        <ImagePlus className="size-8 opacity-50" />
                        <p className="text-sm font-medium">Click to upload banner image</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    📐 Recommended resolution: <strong>1200 × 450 px</strong> (landscape, 8:3 ratio) · JPG, PNG or WebP · max ~2 MB
                  </p>
                </div>
              </div>

              {/* Package editors */}
              <PackageEditor
                title="Hotel packages"
                rows={draft.hotel_packages}
                onChange={(pkgs) => setDraft({ ...draft, hotel_packages: pkgs })}
              />
              <PackageEditor
                title="Travel packages"
                rows={draft.travel_packages}
                onChange={(pkgs) => setDraft({ ...draft, travel_packages: pkgs })}
              />

              {/* WhatsApp join toggle */}
              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
                <Checkbox
                  id="allow_whatsapp"
                  checked={draft.allow_whatsapp_before_payment}
                  onCheckedChange={(v) => setDraft({ ...draft, allow_whatsapp_before_payment: Boolean(v) })}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="allow_whatsapp" className="cursor-pointer text-sm font-semibold">
                    Allow Devotees to Join WhatsApp without Payment
                  </label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    When enabled, a "Join WhatsApp" button appears on the Select Yatra page alongside "Book Now" — even before payment.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={save} disabled={isBusy} className="bg-gradient-primary font-bold shadow-glow">
                  {isBusy ? "Saving…" : editId ? "Save changes" : "Create yatra"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      {/* Loading / Error states */}
      {isLoading && (
        <p className="text-center text-muted-foreground py-8">Loading yatras…</p>
      )}
      {isError && (
        <p className="text-center text-destructive py-8">Failed to load yatras. Is the backend running?</p>
      )}

      {/* Yatra cards */}
      {!isLoading && !isError && (
        <section className="grid gap-4 lg:grid-cols-2">
          {yatras.length === 0 && (
            <p className="text-muted-foreground col-span-2 text-center py-8">
              No yatras yet. Click <strong>New Yatra</strong> to create one.
            </p>
          )}
          {yatras.map((y) => (
            <YatraCard
              key={y.id}
              yatra={y}
              onEdit={() => openEdit(y)}
              onDelete={() => deleteMut.mutate(y.id)}
              deleteLoading={deleteMut.isPending && deleteMut.variables === y.id}
            />
          ))}
        </section>
      )}
    </AdminShell>
  );
}

// ── Yatra Card ─────────────────────────────────────────────────────────────────
function YatraCard({
  yatra: y,
  onEdit,
  onDelete,
  deleteLoading,
}: {
  yatra: YatraRow;
  onEdit: () => void;
  onDelete: () => void;
  deleteLoading: boolean;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold">{y.title}</h2>
          <p className="text-xs text-muted-foreground">Yatra ID: YTR{y.id}</p>
        </div>
        <Badge variant={statusBadge[y.status] ?? "secondary"}>
          {statusLabel[y.status] ?? y.status}
        </Badge>
      </div>

      {/* Info grid */}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Info
          label="Dates"
          value={`${y.start_date || "—"} → ${y.end_date || "—"}`}
          icon={<Calendar className="size-3" />}
        />
        {y.whatsapp_group_link && (
          <Info
            label="WhatsApp"
            value="Group Link"
            icon={<Link2 className="size-3" />}
            href={y.whatsapp_group_link}
          />
        )}
      </dl>

      {/* Description */}
      {y.description && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{y.description}</p>
      )}

      {/* Hotel packages list */}
      {(y.hotel_packages?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Hotel packages</p>
          <ul className="space-y-0.5">
            {y.hotel_packages!.map((p, i) => (
              <li key={i} className="flex justify-between text-xs">
                <span className="truncate text-muted-foreground">{p.title}</span>
                <span className="font-bold text-primary">₹{Number(p.price).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Travel packages list */}
      {(y.travel_packages?.length ?? 0) > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Travel packages</p>
          <ul className="space-y-0.5">
            {y.travel_packages!.map((p, i) => (
              <li key={i} className="flex justify-between text-xs">
                <span className="truncate text-muted-foreground">{p.title}</span>
                <span className="font-bold text-primary">₹{Number(p.price).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="font-semibold" onClick={onEdit}>
          <Pencil className="size-4" /> Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="font-semibold text-destructive"
          onClick={onDelete}
          disabled={deleteLoading}
        >
          <Trash2 className="size-4" /> {deleteLoading ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </article>
  );
}

// ── Package Editor ─────────────────────────────────────────────────────────────
function PackageEditor({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: HotelPkg[] | TravelPkg[];
  onChange: (pkgs: HotelPkg[]) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const add = () => {
    if (!name.trim()) { toast.error("Package name is required"); return; }
    const p = Number(price);
    if (isNaN(p) || p < 0) { toast.error("Enter a valid price"); return; }
    onChange([...rows, { title: name.trim(), price: p }] as HotelPkg[]);
    setName("");
    setPrice("");
  };

  const remove = (i: number) => {
    onChange(rows.filter((_, idx) => idx !== i) as HotelPkg[]);
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3 mt-2">
      <h3 className="text-sm font-extrabold">{title}</h3>
      {rows.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((p, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{p.title}</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-extrabold text-primary">
                  ₹{Number(p.price).toLocaleString("en-IN")}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${p.title}`}
                  className="text-destructive"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No packages added yet.</p>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Field label="Package name">
          <Input
            placeholder="Package name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Price (₹)">
          <Input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Button type="button" onClick={add} variant="outline" className="self-end font-bold sm:col-span-2">
          <Plus className="size-4" /> Add package
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function Info({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  href?: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon} {label}
      </dt>
      <dd className="truncate text-sm font-semibold">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
