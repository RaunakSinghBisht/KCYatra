import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin224151/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin224151/users" });
  },
});
