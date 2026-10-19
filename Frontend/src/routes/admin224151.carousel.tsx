import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { AdminShell } from "@/features/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import { BASE_URL } from "@/lib/api";

export const Route = createFileRoute("/admin224151/carousel")({
  head: () => ({
    meta: [
      { title: "Carousel Manager — Krishna Conscious Yatra Admin" },
      { name: "description", content: "Upload and order the banner images shown on the home page." },
      { property: "og:title", content: "Carousel Manager — Krishna Conscious Yatra Admin" },
      { property: "og:description", content: "Upload and order the banner images shown on the home page." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCarousel,
});

type Slide = { id: number; filename: string; position: number };

function imgUrl(filename: string) {
  return `/carousel/${filename}`;
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res;
}

function AdminCarousel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await apiFetch("/carousel/");
      setSlides(await res.json());
    } catch (err) {
      toast.error("Failed to load carousel: " + (err instanceof Error ? err.message : "error"));
    }
  };

  useEffect(() => { load(); }, []);

  const pushOrder = async (ordered: Slide[]) => {
    setSlides(ordered);
    try {
      await apiFetch("/carousel/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ordered.map((s) => s.id) }),
      });
    } catch (err) {
      toast.error("Reorder failed: " + (err instanceof Error ? err.message : "error"));
      load();
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item!);
    pushOrder(next);
  };

  const onDrop = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const from = slides.findIndex((s) => s.id === dragId);
    const to = slides.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...slides];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    pushOrder(next);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        form.append("images", f);
      }
      const res = await apiFetch("/carousel/", { method: "POST", body: form });
      const created: Slide[] = await res.json();
      setSlides((prev) => [...prev, ...created]);
      toast.success(`${created.length} image${created.length === 1 ? "" : "s"} added`);
    } catch (err) {
      toast.error("Upload failed: " + (err instanceof Error ? err.message : "error"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: number) => {
    try {
      await apiFetch(`/carousel/${id}`, { method: "DELETE" });
      setSlides((prev) => prev.filter((s) => s.id !== id));
      toast.success("Image removed");
    } catch (err) {
      toast.error("Delete failed: " + (err instanceof Error ? err.message : "error"));
    }
  };

  return (
    <AdminShell
      title="Carousel Manager"
      description="Upload banner images for the home page and set the order they appear in."
      actions={
        <>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" /> {busy ? "Uploading…" : "Upload images"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {slides.length} image{slides.length === 1 ? "" : "s"} in the carousel · first image shows first · drag an image to reorder it. Wide images (about 1920×650) look best.
      </p>
      <section className="space-y-3">
        {slides.map((s, i) => (
          <article
            key={s.id}
            draggable
            onDragStart={(e) => { setDragId(s.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); if (dragId !== null && dragId !== s.id) setOverId(s.id); }}
            onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); onDrop(s.id); setDragId(null); setOverId(null); }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            className={`flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-soft transition sm:flex-row sm:items-center ${
              dragId === s.id
                ? "border-primary opacity-50"
                : overId === s.id
                  ? "border-primary border-dashed ring-2 ring-primary/30"
                  : "border-border"
            }`}
          >
            <div className="flex items-center gap-3 sm:contents">
              <GripVertical className="size-5 shrink-0 cursor-grab text-muted-foreground" aria-label="Drag to reorder" />
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <img
                src={imgUrl(s.filename)}
                alt={`Carousel image ${i + 1}`}
                className="h-20 w-full rounded-lg object-cover sm:w-56"
              />
            </div>
            <p className="flex-1 truncate text-xs text-muted-foreground sm:px-2">{s.filename}</p>
            <div className="flex justify-end gap-1">
              <Button size="icon" variant="outline" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" />
              </Button>
              <Button size="icon" variant="outline" aria-label="Move down" disabled={i === slides.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Delete image" className="text-destructive" onClick={() => remove(s.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </article>
        ))}
        {slides.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No images yet — upload some to show the home page carousel.
          </p>
        )}
      </section>
    </AdminShell>
  );
}
