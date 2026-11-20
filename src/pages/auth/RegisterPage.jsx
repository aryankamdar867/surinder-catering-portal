import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import AuthHeading from './AuthHeading.jsx'
import Alert from '@/components/feedback/Alert.jsx'
import Button from '@/components/ui/Button.jsx'
import Field from '@/components/ui/Field.jsx'
import PasswordField from '@/components/ui/PasswordField.jsx'
import { useForm } from '@/hooks/useForm.js'
import { resendConfirmation, signUp } from '@/services/authService.js'
import { getErrorMessage } from '@/utils/errors.js'
import {
  PASSWORD_HINT,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
} from '@/utils/validation.js'

const initialValues = { fullName: '', email: '', phone: '', password: '', confirmPassword: '' }

const validate = (v) => ({
  fullName: validateFullName(v.fullName),
  email: validateEmail(v.email),
  phone: validatePhone(v.phone),
  password: validatePassword(v.password),
  confirmPassword: validatePasswordConfirmation(v.password, v.confirmPassword),
})

export default function RegisterPage() {
  const { values, errors, handleChange, handleSubmit } = useForm(initialValues, validate)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)
  const [sentTo, setSentTo] = useState(null)
  const [resending, setResending] = useState(false)

  const onSubmit = handleSubmit(async (v) => {
    setSubmitting(true)
    setFailure(null)
    try {
      const email = v.email.trim()
      const { needsConfirmation } = await signUp({
        fullName: v.fullName.trim(),
        email,
        phone: v.phone.trim(),
        password: v.password,
      })
      if (needsConfirmation) {
        setSentTo(email)
      } else {
        toast.success('Your account is ready. Welcome!')
      }
    } catch (error) {
      setFailure(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  })

  async function onResend() {
    setResending(true)
    try {
      await resendConfirmation(sentTo)
      toast.success('Confirmation email sent again.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setResending(false)
    }
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-forest-50 text-forest-700">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-4xl font-semibold text-forest-900">Check your email</h1>
        <p className="mt-3 text-ink-500">
          We&rsquo;ve sent a confirmation link to <strong className="text-ink-900">{sentTo}</strong>. Open it on
          this device to activate your account.
        </p>
        <p className="mt-2 text-sm text-ink-400">Can&rsquo;t find it? Check your spam folder.</p>
        <div className="mt-8 flex flex-col gap-3">
          <Button variant="secondary" onClick={onResend} loading={resending}>
            Resend email
          </Button>
          <Button to="/login" variant="ghost">
            Back to sign in
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <AuthHeading title="Create your account" description="Plan your event menu and track your enquiries." />

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {failure && <Alert tone="error">{failure}</Alert>}

        <Field
          label="Full name"
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={handleChange}
          error={errors.fullName}
        />
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
        <Field
          label="Phone number"
          name="phone"
          type="tel"
          autoComplete="tel"
          optional
          placeholder="+91 98765 43210"
          value={values.phone}
          onChange={handleChange}
          error={errors.phone}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          value={values.password}
          onChange={handleChange}
          error={errors.password}
        />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-forest-700 hover:text-forest-900">
          Sign in
        </Link>
      </p>
    </>
  )
}
