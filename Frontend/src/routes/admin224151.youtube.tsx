import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Eye, Plus, Trash2, Youtube } from "lucide-react";
import { authFetch } from "@/lib/auth-client";
import { AdminShell } from "@/features/admin/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_URL } from "@/lib/api";
import { youtubeEmbedUrl } from "@/features/admin/lib/admin-store";

export const Route = createFileRoute("/admin224151/youtube")({
  head: () => ({
    meta: [
      { title: "YouTube Links — Krishna Conscious Yatra Admin" },
      { name: "description", content: "Embed up to 3 YouTube videos in the landing page glimpse section." },
      { property: "og:title", content: "YouTube Links — Krishna Conscious Yatra Admin" },
      { property: "og:description", content: "Embed up to 3 YouTube videos in the landing page glimpse section." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminYoutube,
});

const MAX_LINKS = 3;

type YTLink = { id: number; url: string; position: number };

async function fetchLinks(): Promise<YTLink[]> {
  const res = await authFetch(`${BASE_URL}/youtube-links/`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function saveLinks(urls: string[]): Promise<YTLink[]> {
  const res = await authFetch(`${BASE_URL}/youtube-links/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: urls.filter((u) => u.trim()) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Save failed");
  }
  return res.json();
}

function AdminYoutube() {
  const [links, setLinks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchLinks()
      .then((rows) => setLinks(rows.map((r) => r.url)))
      .catch(() => toast.error("Failed to load YouTube links"));
  }, []);

  const persist = useCallback((urls: string[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveLinks(urls);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    }, 600);
  }, []);

  const onChange = (index: number, value: string) => {
    const next = links.map((l, i) => (i === index ? value : l));
    setLinks(next);
    persist(next);
  };

  const addLink = () => {
    if (links.length >= MAX_LINKS) return;
    const next = [...links, ""];
    setLinks(next);
  };

  const removeLink = (index: number) => {
    const next = links.filter((_, i) => i !== index);
    setLinks(next);
    persist(next);
    toast.success("Video removed");
  };

  const validEmbeds = links
    .map((l) => ({ link: l, embed: youtubeEmbedUrl(l.trim()) }))
    .filter((e) => e.embed);

  return (
    <AdminShell
      title="YouTube Links"
      description={`Embed up to ${MAX_LINKS} YouTube videos in the "Our Past Yatra's Glimpse" section of the landing page.`}
      actions={
        <Button
          size="sm"
          className="font-semibold"
          onClick={addLink}
          disabled={links.length >= MAX_LINKS}
        >
          <Plus className="size-4" /> Add video
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {links.length} of {MAX_LINKS} videos
            </p>
            {saving && (
              <p className="text-xs text-muted-foreground">Saving…</p>
            )}
          </div>

          {links.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              No videos yet — tap "Add video" to embed one.
            </p>
          ) : (
            links.map((link, i) => {
              const invalid = link.trim() !== "" && !youtubeEmbedUrl(link.trim());
              return (
                <div key={i} className="space-y-2">
                  <Label htmlFor={`yt-${i}`}>Video {i + 1} link</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`yt-${i}`}
                      value={link}
                      onChange={(e) => onChange(i, e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=…"
                      className="h-11"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0 text-destructive"
                      onClick={() => removeLink(i)}
                      aria-label={`Remove video ${i + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  {invalid && (
                    <p className="text-xs text-destructive">
                      This doesn't look like a YouTube link — it won't show on the website.
                    </p>
                  )}
                </div>
              );
            })
          )}
          <p className="text-xs text-muted-foreground">
            Changes save automatically — visitors see them once saved.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Eye className="size-3.5" /> Visitor preview
          </p>
          {validEmbeds.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Youtube className="size-7" />
              </span>
              <p className="mt-4 text-sm text-muted-foreground">
                Add a valid YouTube link to preview it here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {validEmbeds.map((e, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-border">
                  <div className="aspect-video w-full">
                    <iframe
                      className="h-full w-full"
                      src={e.embed!}
                      title={`Past yatra glimpse ${i + 1}`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
