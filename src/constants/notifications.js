import { Bell, CalendarClock, CircleCheck, CircleX, ClipboardList, FilePen, FileText, Inbox } from 'lucide-react'

// Icon and colour per notification type. Keys MUST match the CHECK constraint on
// public.notifications.type in supabase/migrations/20261120090000_core_schema.sql.
export const NOTIFICATION_TYPES = {
  enquiry_submitted: { icon: Inbox, tone: 'forest' },
  enquiry_status_changed: { icon: ClipboardList, tone: 'gold' },
  quotation_sent: { icon: FileText, tone: 'forest' },
  quotation_revised: { icon: FilePen, tone: 'gold' },
  quotation_accepted: { icon: CircleCheck, tone: 'forest' },
  quotation_rejected: { icon: CircleX, tone: 'burgundy' },
  event_reminder: { icon: CalendarClock, tone: 'gold' },
  general: { icon: Bell, tone: 'neutral' },
}

export const notificationMeta = (type) => NOTIFICATION_TYPES[type] ?? NOTIFICATION_TYPES.general
