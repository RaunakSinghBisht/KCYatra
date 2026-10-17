import { createFileRoute, redirect } from "@tanstack/react-router";

// Admin Accounts was removed from the panel; this keeps old bookmarks working.
export const Route = createFileRoute("/admin/admins")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/users" });
  },
});
