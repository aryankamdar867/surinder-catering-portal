// Client-side validation. These rules mirror the database CHECK constraints in
// supabase/migrations so users get friendly messages before the server rejects.

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/
export const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const PASSWORD_HINT = 'At least 8 characters, including a letter and a number.'

export function validateEmail(value) {
  const v = value.trim()
  if (!v) return 'Email is required.'
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address.'
  return undefined
}

export function validatePassword(value) {
  if (!value) return 'Password is required.'
  if (value.length < 8) return 'Password must be at least 8 characters.'
  if (value.length > 72) return 'Password must be 72 characters or fewer.'
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Include at least one letter and one number.'
  return undefined
}

export function validatePasswordConfirmation(password, confirmation) {
  if (!confirmation) return 'Please confirm your password.'
  if (password !== confirmation) return 'Passwords do not match.'
  return undefined
}

export function validateFullName(value) {
  const v = value.trim()
  if (!v) return 'Full name is required.'
  if (v.length < 2) return 'Name must be at least 2 characters.'
  if (v.length > 120) return 'Name must be 120 characters or fewer.'
  return undefined
}

export function validatePhone(value, { required = false } = {}) {
  const v = value.trim()
  if (!v) return required ? 'Phone number is required.' : undefined
  if (!PHONE_RE.test(v)) return 'Enter a valid phone number (digits, spaces, +, - and brackets only).'
  return undefined
}

export function validateGst(value) {
  const v = value.trim().toUpperCase()
  if (!v) return undefined
  if (!GST_RE.test(v)) return 'Enter a valid 15-character GSTIN, e.g. 27ABCDE1234F1Z5.'
  return undefined
}

export function validateMaxLength(value, max, label) {
  if (value.trim().length > max) return `${label} must be ${max} characters or fewer.`
  return undefined
}

/** Trim a string and convert empty strings to null (for optional DB columns). */
export function emptyToNull(value) {
  const v = typeof value === 'string' ? value.trim() : value
  return v === '' ? null : v
}
