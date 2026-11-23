import { createContext, useContext } from 'react'

export const NotificationsContext = createContext(null)

/**
 * The signed-in user's notifications, kept live by <NotificationsProvider>:
 *   recent       – newest notifications (up to 20), or [] while loading
 *   unread       – number of unread notifications
 *   loading      – true until the first load finishes
 *   error        – last load error, if any
 *   markRead(id), markAllRead(), remove(id), refresh()
 */
export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return context
}
