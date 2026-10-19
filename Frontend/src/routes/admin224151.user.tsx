import { createFileRoute, redirect } from '@tanstack/react-router'

// Redirect /admin224151/user (singular) → /admin224151/users (plural)
export const Route = createFileRoute('/admin224151/user')({
  beforeLoad: () => {
    throw redirect({ to: '/admin224151/users', replace: true })
  },
})
