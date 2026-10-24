import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/features/admin/components/AdminShell";
import { SessionsPanel } from "@/components/SessionsPanel";
import { useAdminAuth } from "@/features/admin/lib/admin-auth";

export const Route = createFileRoute("/admin224151/sessions")({
  head: () => ({
    meta: [
      { title: "Sessions — Krishna Conscious Yatra Admin" },
      { name: "description", content: "Devices signed in to the admin panel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSessions,
});

function AdminSessions() {
  const { signOutAll } = useAdminAuth();
  const navigate = useNavigate();

  return (
    <AdminShell title="Sessions" description="Devices signed in to the admin panel. Log out any you don't recognise.">
      <SessionsPanel
        realm="admin"
        onLogoutAll={signOutAll}
        afterLogoutAll={() => navigate({ to: "/admin224151/login" })}
      />
    </AdminShell>
  );
}
