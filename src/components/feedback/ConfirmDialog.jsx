import { useEffect, useRef } from 'react'
import Button from '@/components/ui/Button.jsx'

/**
 * Modal confirmation built on the native <dialog> element (focus trapping and Esc for free).
 * Render it with `open`; `onCancel` fires on Esc, backdrop click or the Cancel button.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        if (!loading) onCancel()
      }}
      onClick={(event) => event.target === ref.current && !loading && onCancel()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-ivory-200 bg-ivory-50 p-0 text-ink-900 shadow-card backdrop:bg-ink-900/50"
      aria-labelledby="confirm-title"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-2xl font-semibold text-forest-900">
          {title}
        </h2>
        {message && <div className="mt-2 text-sm leading-relaxed text-ink-500">{message}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'accent' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
