import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  Filter,
  Loader2,
  Pencil,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { authFetch } from "@/lib/auth-client";
import { AdminShell, ExportButtons } from "@/features/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportCsv, exportExcel } from "@/features/admin/lib/export-records";
import { BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/admin224151/notices")({
  head: () => ({
    meta: [
      { title: "Notices — Krishna Conscious Yatra Admin" },
      { name: "description", content: "Publish important notices shown to travellers in their dashboard." },
      { property: "og:title", content: "Notices — Krishna Conscious Yatra Admin" },
      { property: "og:description", content: "Publish important notices shown to travellers in their dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminNotices,
});

// ── Types ──────────────────────────────────────────────────────────────────────
export type NoticeRow = {
  id: number;
  title: string;
  body: string;
  sender_name: string;
  tag: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type CreateNoticePayload = {
  title: string;
  body: string;
  sender_name: string;
  tag: string;
  is_published: boolean;
};

type UpdateNoticePayload = Partial<CreateNoticePayload>;

// ── API Helpers ────────────────────────────────────────────────────────────────
async function fetchNotices(): Promise<NoticeRow[]> {
  const res = await authFetch(`${BASE_URL}/notices/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to fetch notices");
  }
  return res.json();
}

async function createNoticeApi(payload: CreateNoticePayload): Promise<NoticeRow> {
  const res = await authFetch(`${BASE_URL}/notices/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to create notice");
  }
  return res.json();
}

async function updateNoticeApi(id: number, payload: UpdateNoticePayload): Promise<NoticeRow> {
  const res = await authFetch(`${BASE_URL}/notices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to update notice");
  }
  return res.json();
}

async function deleteNoticeApi(id: number): Promise<void> {
  const res = await authFetch(`${BASE_URL}/notices/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to delete notice");
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatNoticeDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoDate.split("T")[0] ?? isoDate;
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────
function AdminNotices() {
  const queryClient = useQueryClient();

  // Form state for creating a notice
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [senderName, setSenderName] = useState("Yatra Admin");
  const [tag, setTag] = useState("Important");
  const [isLive, setIsLive] = useState(true);

  // Filters & search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "draft">("all");

  // Edit dialog state
  const [editingNotice, setEditingNotice] = useState<NoticeRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSender, setEditSender] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editIsLive, setEditIsLive] = useState(true);

  // Queries & Mutations
  const {
    data: notices = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-notices"],
    queryFn: fetchNotices,
  });

  const createMutation = useMutation({
    mutationFn: createNoticeApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-notices"] });
      setTitle("");
      setBody("");
      setIsLive(true);
      toast.success("Notice published successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to publish notice");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateNoticePayload }) =>
      updateNoticeApi(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-notices"] });
      setEditingNotice(null);
      toast.success("Notice updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update notice");
    },
  });

  const toggleLiveMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: number; is_published: boolean }) =>
      updateNoticeApi(id, { is_published }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-notices"] });
      toast.success(
        variables.is_published
          ? "Notice is now Live for travellers"
          : "Notice moved to Draft (hidden from travellers)"
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to toggle notice status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNoticeApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-notices"] });
      toast.success("Notice deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete notice");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      sender_name: senderName.trim() || "Yatra Admin",
      tag: tag.trim() || "General",
      is_published: isLive,
    });
  };

  const openEditModal = (notice: NoticeRow) => {
    setEditingNotice(notice);
    setEditTitle(notice.title);
    setEditBody(notice.body);
    setEditSender(notice.sender_name);
    setEditTag(notice.tag);
    setEditIsLive(notice.is_published);
  };

  const handleSaveEdit = () => {
    if (!editingNotice) return;
    if (!editTitle.trim() || !editBody.trim()) {
      toast.error("Title and message are required");
      return;
    }
    updateMutation.mutate({
      id: editingNotice.id,
      payload: {
        title: editTitle.trim(),
        body: editBody.trim(),
        sender_name: editSender.trim() || "Yatra Admin",
        tag: editTag.trim() || "General",
        is_published: editIsLive,
      },
    });
  };

  // Filtered notices
  const filteredNotices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notices.filter((n) => {
      if (statusFilter === "live" && !n.is_published) return false;
      if (statusFilter === "draft" && n.is_published) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.sender_name.toLowerCase().includes(q) ||
        n.tag.toLowerCase().includes(q) ||
        `nt${n.id}`.includes(q)
      );
    });
  }, [notices, search, statusFilter]);

  // Export handlers
  const handleExportCsv = () => {
    const exportData = filteredNotices.map((n) => ({
      ID: `NT${n.id}`,
      Title: n.title,
      Message: n.body,
      Sender: n.sender_name,
      Tag: n.tag,
      Status: n.is_published ? "Live" : "Draft",
      Created_At: n.created_at,
    }));
    exportCsv(exportData, "kcy-notices");
  };

  const handleExportExcel = () => {
    const exportData = filteredNotices.map((n) => ({
      ID: `NT${n.id}`,
      Title: n.title,
      Message: n.body,
      Sender: n.sender_name,
      Tag: n.tag,
      Status: n.is_published ? "Live" : "Draft",
      Created_At: n.created_at,
    }));
    exportExcel(exportData, "kcy-notices");
  };

  return (
    <AdminShell
      title="Notices"
      description="Publish important notices and broadcast messages shown to travellers in their dashboard."
      actions={
        <ExportButtons
          onCsv={handleExportCsv}
          onExcel={handleExportExcel}
        />
      }
    >
      {/* ── Create Notice Section ────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bell className="size-4" />
          </div>
          <h2 className="text-base font-extrabold text-foreground">Create New Notice</h2>
        </div>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Boarding time changed or Weather update"
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Notice Message *</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write the full update that travellers will see on their dashboard…"
                rows={3}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sender Name</Label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Yatra Admin or Govinda Das"
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category / Tag</Label>
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. Important, Schedule, General"
                maxLength={50}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                id="publish-immediately"
                checked={isLive}
                onCheckedChange={setIsLive}
              />
              <Label htmlFor="publish-immediately" className="text-xs font-semibold cursor-pointer">
                {isLive ? "Publish immediately (Live for travellers)" : "Save as Draft (Hidden)"}
              </Label>
            </div>

            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-gradient-primary font-bold shadow-glow"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Publishing…
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" /> Publish notice
                </>
              )}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Search & Filter Controls ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notices, tags, authors…"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="size-3.5 text-muted-foreground mr-1" />
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            className="h-8 text-xs font-medium"
            onClick={() => setStatusFilter("all")}
          >
            All ({notices.length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "live" ? "default" : "outline"}
            className="h-8 text-xs font-medium"
            onClick={() => setStatusFilter("live")}
          >
            Live ({notices.filter((n) => n.is_published).length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "draft" ? "default" : "outline"}
            className="h-8 text-xs font-medium"
            onClick={() => setStatusFilter("draft")}
          >
            Drafts ({notices.filter((n) => !n.is_published).length})
          </Button>
        </div>
      </div>

      {/* ── Notice List ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive">
          <p className="font-bold">Failed to load notices from server.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            Try again
          </Button>
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Bell className="mx-auto size-9 text-muted-foreground/60" />
          <h3 className="mt-3 text-sm font-bold text-foreground">No notices found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {search || statusFilter !== "all"
              ? "No notices match your current filters."
              : "Create your first notice above to notify travellers."}
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          {filteredNotices.map((n) => (
            <article
              key={n.id}
              className={`rounded-2xl border transition-colors bg-card p-4 shadow-soft ${
                n.is_published ? "border-border" : "border-dashed border-muted-foreground/30 opacity-80"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-extrabold text-foreground">{n.title}</p>
                    <Badge variant={n.is_published ? "secondary" : "outline"} className="text-[10px]">
                      {n.tag}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{n.sender_name}</span> ·{" "}
                    {formatNoticeDate(n.created_at)} ·{" "}
                    <span className="font-mono text-[11px] font-semibold text-primary">NT{n.id}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Live switch */}
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1">
                    <span
                      className={`text-xs font-semibold ${
                        n.is_published ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      }`}
                    >
                      {n.is_published ? "Live" : "Draft"}
                    </span>
                    <Switch
                      checked={n.is_published}
                      disabled={toggleLiveMutation.isPending}
                      onCheckedChange={(val) =>
                        toggleLiveMutation.mutate({ id: n.id, is_published: val })
                      }
                      aria-label="Toggle notice visibility"
                    />
                  </div>

                  {/* Edit button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit notice"
                    onClick={() => openEditModal(n)}
                    className="size-8 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </Button>

                  {/* Delete button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete notice"
                    disabled={deleteMutation.isPending}
                    className="size-8 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete notice "NT${n.id}"?`)) {
                        deleteMutation.mutate(n.id);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {n.body}
              </p>
            </article>
          ))}
        </section>
      )}

      {/* ── Edit Notice Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editingNotice} onOpenChange={(open) => !open && setEditingNotice(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Notice NT{editingNotice?.id}</DialogTitle>
            <DialogDescription>
              Update the content or publishing status of this notice.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Message</Label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Sender Name</Label>
                <Input
                  value={editSender}
                  onChange={(e) => setEditSender(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tag</Label>
                <Input
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  maxLength={50}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="edit-is-live"
                checked={editIsLive}
                onCheckedChange={setEditIsLive}
              />
              <Label htmlFor="edit-is-live" className="text-xs font-semibold cursor-pointer">
                {editIsLive ? "Notice is Live for travellers" : "Notice is Draft (Hidden)"}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNotice(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              className="bg-gradient-primary font-bold shadow-glow"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" /> Save changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
