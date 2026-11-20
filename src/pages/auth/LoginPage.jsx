import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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

export default function LoginPage() {
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
      <AuthHeading title="Welcome back" description="Sign in to manage your enquiries and quotations." />

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

      <p className="mt-8 text-center text-sm text-ink-500">
        New to Surinder Caterers?{' '}
        <Link to={registerLink} className="font-semibold text-forest-700 hover:text-forest-900">
          Create an account
        </Link>
      </p>
    </>
  )
}
