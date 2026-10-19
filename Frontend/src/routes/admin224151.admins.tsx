import { createFileRoute, redirect } from "@tanstack/react-router";

// Admin Accounts was removed from the panel; this keeps old bookmarks working.
export const Route = createFileRoute("/admin224151/admins")({
  beforeLoad: () => {
    throw redirect({ to: "/admin224151/users" });
  },
});
