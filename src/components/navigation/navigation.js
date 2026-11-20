import { LayoutDashboard, UserRound } from 'lucide-react'

// Navigation grows as each phase adds pages (enquiries, quotations, dishes, …).

export const CUSTOMER_NAV = [
  { to: '/account', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/account/profile', label: 'Profile', icon: UserRound },
]

export const ADMIN_NAV = [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }]
