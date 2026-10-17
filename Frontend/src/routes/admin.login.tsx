import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_ADMIN, useAdminAuth } from "@/features/admin/lib/admin-auth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — Krishna Conscious Yatra" },
      { name: "description", content: "Secure admin sign-in for managing yatras, bookings and travellers." },
      { property: "og:title", content: "Admin Login — Krishna Conscious Yatra" },
      { property: "og:description", content: "Secure admin sign-in for the Krishna Conscious Yatra control panel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { admin, signIn } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (admin) navigate({ to: "/admin/users" });
  }, [admin, navigate]);

  const submit = () => {
    if (signIn(email, password)) {
      toast.success("Welcome back, admin");
      navigate({ to: "/admin/users" });
    } else {
      toast.error("Invalid admin credentials");
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-xl flex-col justify-center px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight">Admin Login</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Restricted area — for Krishna Conscious Yatra staff only.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@krishnaconsciousyatra.com"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••••"
              className="h-12"
            />
          </div>
          <Button onClick={submit} size="lg" className="w-full bg-gradient-primary font-bold shadow-glow">
            Sign in to Admin Panel
          </Button>
          <p className="rounded-xl bg-muted p-3 text-center text-xs text-muted-foreground">
            Demo credentials — {DEMO_ADMIN.email} / {DEMO_ADMIN.password}
          </p>
        </div>
      </div>
    </main>
  );
}
