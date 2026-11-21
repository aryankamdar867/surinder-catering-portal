import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import AuthHeading from './AuthHeading.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import Button from '@/components/ui/Button.jsx'
import Field from '@/components/ui/Field.jsx'
import PasswordField from '@/components/ui/PasswordField.jsx'
import { useForm } from '@/hooks/useForm.js'
import { resendConfirmation, signIn } from '@/services/authService.js'
import { getErrorMessage } from '@/utils/errors.js'
import { validateEmail } from '@/utils/validation.js'

const validate = (v) => ({
  email: validateEmail(v.email),
  password: v.password ? undefined : 'Password is required.',
})

const COPY = {
  customer: {
    eyebrow: null,
    title: 'Welcome back',
    description: 'Sign in to manage your enquiries and quotations.',
  },
  admin: {
    eyebrow: 'Owner portal',
    title: 'Admin login',
    description: 'For the Surinder Caterers team. Use the email and password of an owner account.',
  },
}

/**
 * One sign-in form for everyone (same Supabase auth). `variant="admin"` only changes
 * the wording and links; where the user lands is decided by GuestOnly / AdminGuestOnly
 * from their profile role, and owner data is protected by RLS.
 */
export default function LoginPage({ variant = 'customer' }) {
  const isAdminLogin = variant === 'admin'
  const copy = COPY[variant]
  const [searchParams] = useSearchParams()
  const { values, errors, handleChange, handleSubmit } = useForm({ email: '', password: '' }, validate)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)
  const [resending, setResending] = useState(false)

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitting(true)
    setFailure(null)
    try {
      await signIn({ email: email.trim(), password })
      toast.success('Welcome back!')
      // <GuestOnly> redirects once the session and profile are loaded.
    } catch (error) {
      setFailure({ message: getErrorMessage(error), unconfirmed: error.code === 'email_not_confirmed' })
      setSubmitting(false)
    }
  })

  async function onResend() {
    setResending(true)
    try {
      await resendConfirmation(values.email.trim())
      toast.success('Confirmation email sent. Please check your inbox.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setResending(false)
    }
  }

  const registerLink = searchParams.get('redirect')
    ? `/register?redirect=${encodeURIComponent(searchParams.get('redirect'))}`
    : '/register'

  return (
    <>
      {copy.eyebrow && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-gold-300/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          {copy.eyebrow}
        </p>
      )}
      <AuthHeading title={copy.title} description={copy.description} />

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {failure && (
          <Alert tone="error">
            {failure.message}
            {failure.unconfirmed && (
              <button
                type="button"
                onClick={onResend}
                disabled={resending}
                className="mt-1 block font-semibold underline underline-offset-2 disabled:opacity-60"
              >
                {resending ? 'Sending…' : 'Resend confirmation email'}
              </button>
            )}
          </Alert>
        )}

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

        <div>
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            value={values.password}
            onChange={handleChange}
            error={errors.password}
          />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-sm font-medium text-forest-700 hover:text-forest-900">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Sign in
        </Button>
      </form>

      {isAdminLogin ? (
        <p className="mt-8 text-center text-sm text-ink-500">
          Not part of the team?{' '}
          <Link to="/login" className="font-semibold text-forest-700 hover:text-forest-900">
            Customer login
          </Link>
        </p>
      ) : (
        <>
          <p className="mt-8 text-center text-sm text-ink-500">
            New to Surinder Caterers?{' '}
            <Link to={registerLink} className="font-semibold text-forest-700 hover:text-forest-900">
              Create an account
            </Link>
          </p>
          <p className="mt-3 text-center text-sm text-ink-500">
            Surinder Caterers team?{' '}
            <Link to="/admin/login" className="font-semibold text-forest-700 hover:text-forest-900">
              Admin login
            </Link>
          </p>
        </>
      )}
    </>
  )
}
