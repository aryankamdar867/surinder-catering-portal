// Turn Supabase / network errors into messages that are safe and useful to show users.

const AUTH_MESSAGES = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email address before signing in.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  email_exists: 'An account with this email already exists. Try signing in instead.',
  email_address_invalid: 'Please enter a real email address you can receive mail at.',
  weak_password: 'That password is too weak. Use at least 8 characters with letters and numbers.',
  same_password: 'Your new password must be different from your current password.',
  over_email_send_rate_limit: 'Too many emails have been sent. Please wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  email_address_not_authorized:
    'Emails cannot be sent to this address yet. The site owner needs to finish setting up email delivery.',
  session_not_found: 'Your session has expired. Please sign in again.',
  refresh_token_not_found: 'Your session has expired. Please sign in again.',
  reauthentication_needed: 'For security, please sign out and use "Forgot password" to change your password.',
  signup_disabled: 'New registrations are currently closed.',
}

const DB_MESSAGES = {
  22003: 'One of the amounts is too large.',
  23505: 'This record already exists.',
  23514: 'Some of the details entered are not valid.',
  23503: 'This item is linked to other records and cannot be changed.',
  42501: 'You do not have permission to do that.',
  PGRST116: 'The requested record was not found.',
}

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (error.code && AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code]
  if (error.code && DB_MESSAGES[error.code]) return DB_MESSAGES[error.code]
  if (error.name === 'AuthRetryableFetchError' || /failed to fetch|network/i.test(error.message ?? '')) {
    return 'Network error. Check your internet connection and try again.'
  }
  return error.message || fallback
}
