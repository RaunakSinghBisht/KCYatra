import { createFileRoute, redirect } from '@tanstack/react-router'

// Redirect /admin/user (singular) → /admin/users (plural)
export const Route = createFileRoute('/admin/user')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/users', replace: true })
  },
})
