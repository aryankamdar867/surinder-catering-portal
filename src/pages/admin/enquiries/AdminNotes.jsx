import { useState } from 'react'
import { Lock, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext.js'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import { addNote, deleteNote, updateNote } from '@/services/adminEnquiryService.js'
import { getErrorMessage } from '@/utils/errors.js'

const MAX = 5000
const stamp = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Internal notes: never visible to customers (RLS). System notes (no author) record customer responses. */
export default function AdminNotes({ enquiryId, notes, onChange }) {
  const { user } = useAuth()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null) // { id, body }
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!draft.trim()) return
    setSaving(true)
    try {
      const note = await addNote(enquiryId, draft, user.id)
      onChange([note, ...notes])
      setDraft('')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (!editing.body.trim()) return
    setSaving(true)
    try {
      const note = await updateNote(editing.id, editing.body)
      onChange(notes.map((n) => (n.id === note.id ? note : n)))
      setEditing(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteNote(toDelete.id)
      onChange(notes.filter((n) => n.id !== toDelete.id))
      setToDelete(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Internal notes"
        description={
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden="true" />
            Only owners can see these
          </span>
        }
      />
      <CardBody className="space-y-5">
        <form onSubmit={submit} className="space-y-2">
          <Field
            label="Add a note"
            as="textarea"
            rows={3}
            maxLength={MAX}
            placeholder="Call notes, tasting dates, special requests…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={saving && !editing} disabled={!draft.trim()}>
              Add note
            </Button>
          </div>
        </form>

        {notes.length > 0 && (
          <ul className="space-y-4 border-t border-ivory-200 pt-4">
            {notes.map((note) => {
              const mine = note.author_id === user.id
              const system = note.author_id === null
              const author = system ? 'System' : mine ? 'You' : note.author?.full_name || note.author?.email || 'Former owner'
              return (
                <li key={note.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-ink-400">
                      <span className="font-semibold text-ink-700">{author}</span> · {stamp.format(new Date(note.created_at))}
                      {note.updated_at !== note.created_at && ' · edited'}
                    </p>
                    {mine && editing?.id !== note.id && (
                      <div className="flex">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing({ id: note.id, body: note.body })} aria-label="Edit note">
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-burgundy-600 hover:bg-burgundy-50"
                          onClick={() => setToDelete(note)}
                          aria-label="Delete note"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {editing?.id === note.id ? (
                    <div className="mt-2 space-y-2">
                      <Field
                        label="Edit note"
                        as="textarea"
                        rows={3}
                        maxLength={MAX}
                        value={editing.body}
                        onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={saving}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveEdit} loading={saving} disabled={!editing.body.trim()}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className={system ? 'mt-1 whitespace-pre-line rounded-lg bg-ivory-100 px-3 py-2 text-ink-700' : 'mt-1 whitespace-pre-line text-ink-900'}>
                      {note.body}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this note?"
        message="This can't be undone."
        confirmLabel="Delete note"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  )
}
