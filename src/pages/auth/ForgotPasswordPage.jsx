import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import AuthHeading from './AuthHeading.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import Button from '@/components/ui/Button.jsx'
import Field from '@/components/ui/Field.jsx'
import { useForm } from '@/hooks/useForm.js'
import { requestPasswordReset } from '@/services/authService.js'
import { getErrorMessage } from '@/utils/errors.js'
import { validateEmail } from '@/utils/validation.js'

const validate = (v) => ({ email: validateEmail(v.email) })

export default function ForgotPasswordPage() {
  const { values, errors, handleChange, handleSubmit } = useForm({ email: '' }, validate)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)
  const [sentTo, setSentTo] = useState(null)

  const onSubmit = handleSubmit(async ({ email }) => {
    setSubmitting(true)
    setFailure(null)
    try {
      await requestPasswordReset(email.trim())
      setSentTo(email.trim())
    } catch (error) {
      setFailure(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  })

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-forest-50 text-forest-700">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-4xl font-semibold text-forest-900">Check your email</h1>
        <p className="mt-3 text-ink-500">
          If an account exists for <strong className="text-ink-900">{sentTo}</strong>, we&rsquo;ve sent a link to
          reset your password. Open it on this device and browser.
        </p>
        <Button to="/login" variant="secondary" className="mt-8">
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <>
      <AuthHeading
        title="Reset your password"
        description="Enter the email you registered with and we'll send you a reset link."
      />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {failure && <Alert tone="error">{failure}</Alert>}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={handleChange}
          error={errors.email}
        />
        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Send reset link
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-ink-500">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-forest-700 hover:text-forest-900">
          Sign in
        </Link>
      </p>
    </>
  )
}
