import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LinkIcon } from 'lucide-react'
import { toast } from 'sonner'
import AuthHeading from './AuthHeading.jsx'
import { useAuth } from '@/auth/AuthContext.js'
import Alert from '@/components/feedback/Alert.jsx'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import Button from '@/components/ui/Button.jsx'
import PasswordField from '@/components/ui/PasswordField.jsx'
import { useForm } from '@/hooks/useForm.js'
import { updatePassword } from '@/services/authService.js'
import { getErrorMessage } from '@/utils/errors.js'
import { PASSWORD_HINT, validatePassword, validatePasswordConfirmation } from '@/utils/validation.js'

const validate = (v) => ({
  password: validatePassword(v.password),
  confirmPassword: validatePasswordConfirmation(v.password, v.confirmPassword),
})

/** Error details Supabase appends to the redirect URL when a link is invalid or expired. */
function readLinkError() {
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return params.get('error_description') || hash.get('error_description')
}

export default function ResetPasswordPage() {
  const { loading, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [linkError] = useState(readLinkError)
  const { values, errors, handleChange, handleSubmit } = useForm({ password: '', confirmPassword: '' }, validate)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)

  const onSubmit = handleSubmit(async ({ password }) => {
    setSubmitting(true)
    setFailure(null)
    try {
      await updatePassword(password)
      toast.success('Your password has been updated.')
      navigate(isAdmin ? '/admin' : '/account', { replace: true })
    } catch (error) {
      setFailure(getErrorMessage(error))
      setSubmitting(false)
    }
  })

  if (loading) return <PageLoader label="Verifying your reset link…" />

  if (!user) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-burgundy-50 text-burgundy-600">
          <LinkIcon className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-4xl font-semibold text-forest-900">Link expired or invalid</h1>
        <p className="mt-3 text-ink-500">
          {linkError ??
            'This password reset link is no longer valid. Reset links expire after a short time and must be opened in the same browser you requested them from.'}
        </p>
        <Button to="/forgot-password" className="mt-8">
          Request a new link
        </Button>
      </div>
    )
  }

  return (
    <>
      <AuthHeading title="Choose a new password" description={`For ${user.email}`} />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {failure && <Alert tone="error">{failure}</Alert>}
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          value={values.password}
          onChange={handleChange}
          error={errors.password}
        />
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Update password
        </Button>
      </form>
    </>
  )
}
