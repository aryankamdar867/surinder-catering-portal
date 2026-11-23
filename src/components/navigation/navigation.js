import { Bell, ClipboardList, LayoutDashboard, Tags, UserRound, UtensilsCrossed } from 'lucide-react'

// Navigation grows as each phase adds pages (enquiries, quotations, …).

export const CUSTOMER_NAV = [
  { to: '/account', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/account/enquiries', label: 'Enquiries', icon: ClipboardList },
  { to: '/account/menu', label: 'Menu', icon: UtensilsCrossed },
  { to: '/account/profile', label: 'Profile', icon: UserRound },
]

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/enquiries', label: 'Enquiries', icon: ClipboardList },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/dishes', label: 'Dishes', icon: UtensilsCrossed },
  { to: '/admin/catalogue', label: 'Categories & cuisines', icon: Tags },
]
