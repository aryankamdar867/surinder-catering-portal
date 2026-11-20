import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext.js'
import Alert from '@/components/feedback/Alert.jsx'
import Button from '@/components/ui/Button.jsx'
import Card, { CardBody, CardHeader } from '@/components/ui/Card.jsx'
import Field from '@/components/ui/Field.jsx'
import PageHeader from '@/components/ui/PageHeader.jsx'
import PasswordField from '@/components/ui/PasswordField.jsx'
import { useForm } from '@/hooks/useForm.js'
import { updatePassword } from '@/services/authService.js'
import { updateProfile } from '@/services/profileService.js'
import { getErrorMessage } from '@/utils/errors.js'
import {
  PASSWORD_HINT,
  emptyToNull,
  validateFullName,
  validateGst,
  validateMaxLength,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
} from '@/utils/validation.js'

const toFormValues = (p) => ({
  full_name: p.full_name ?? '',
  phone: p.phone ?? '',
  address: p.address ?? '',
  company_name: p.company_name ?? '',
  gst_number: p.gst_number ?? '',
})

const validateDetails = (v) => ({
  full_name: validateFullName(v.full_name),
  phone: validatePhone(v.phone),
  address: validateMaxLength(v.address, 500, 'Address'),
  company_name: validateMaxLength(v.company_name, 150, 'Company name'),
  gst_number: validateGst(v.gst_number),
})

function DetailsForm() {
  const { profile, setProfile } = useAuth()
  const initial = toFormValues(profile)
  const { values, errors, handleChange, handleSubmit, reset } = useForm(initial, validateDetails)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)
  const dirty = Object.keys(initial).some((key) => values[key].trim() !== initial[key])

  const onSubmit = handleSubmit(async (v) => {
    setSaving(true)
    setFailure(null)
    try {
      const updated = await updateProfile(profile.id, {
        full_name: v.full_name.trim(),
        phone: emptyToNull(v.phone),
        address: emptyToNull(v.address),
        company_name: emptyToNull(v.company_name),
        gst_number: emptyToNull(v.gst_number.toUpperCase()),
      })
      setProfile(updated)
      reset(toFormValues(updated))
      toast.success('Your profile has been saved.')
    } catch (error) {
      setFailure(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  })

  return (
    <Card>
      <CardHeader title="Personal details" description="Used to pre-fill your enquiries and quotations." />
      <CardBody>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {failure && <Alert tone="error">{failure}</Alert>}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Full name"
              name="full_name"
              autoComplete="name"
              value={values.full_name}
              onChange={handleChange}
              error={errors.full_name}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              value={profile.email}
              disabled
              hint="Contact us to change your login email."
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
            <Field
              label="Company name"
              name="company_name"
              autoComplete="organization"
              optional
              value={values.company_name}
              onChange={handleChange}
              error={errors.company_name}
            />
            <Field
              as="textarea"
              label="Address"
              name="address"
              autoComplete="street-address"
              optional
              rows={3}
              className="sm:col-span-2"
              value={values.address}
              onChange={handleChange}
              error={errors.address}
            />
            <Field
              label="GST number"
              name="gst_number"
              optional
              placeholder="27ABCDE1234F1Z5"
              hint="Needed only if you want GST invoices in your company's name."
              inputClassName="uppercase placeholder:normal-case"
              maxLength={15}
              value={values.gst_number}
              onChange={handleChange}
              error={errors.gst_number}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" disabled={!dirty || saving} onClick={() => reset(initial)}>
              Discard
            </Button>
            <Button type="submit" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

const validatePasswords = (v) => ({
  password: validatePassword(v.password),
  confirmPassword: validatePasswordConfirmation(v.password, v.confirmPassword),
})

function PasswordForm() {
  const empty = { password: '', confirmPassword: '' }
  const { values, errors, handleChange, handleSubmit, reset } = useForm(empty, validatePasswords)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)

  const onSubmit = handleSubmit(async ({ password }) => {
    setSaving(true)
    setFailure(null)
    try {
      await updatePassword(password)
      reset(empty)
      toast.success('Your password has been changed.')
    } catch (error) {
      setFailure(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  })

  return (
    <Card>
      <CardHeader title="Change password" />
      <CardBody>
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
          <Button type="submit" variant="secondary" loading={saving} className="w-full">
            Update password
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader eyebrow="My account" title="Profile" description="Manage your contact details and password." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <DetailsForm />
        <PasswordForm />
      </div>
    </>
  )
}
