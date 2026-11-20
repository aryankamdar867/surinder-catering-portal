import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Field from './Field.jsx'

export default function PasswordField(props) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="grid size-9 place-items-center rounded-lg text-ink-400 transition hover:bg-ivory-100 hover:text-ink-700"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      }
    />
  )
}
