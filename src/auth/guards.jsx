import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { ShieldAlert, TriangleAlert } from 'lucide-react'
import { useAuth } from './AuthContext.js'
import PageLoader from '@/components/feedback/PageLoader.jsx'
import StatusScreen from '@/components/feedback/StatusScreen.jsx'
import Button from '@/components/ui/Button.jsx'
import { getErrorMessage } from '@/utils/errors.js'
import { safeRedirect } from '@/utils/navigation.js'

/** Signed-in users only. Sends others to /login and brings them back afterwards. */
export function RequireAuth() {
  const { loading, user, profile, profileError, reloadProfile, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="Checking your session…" />

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    // Owner pages send visitors to the owner sign-in page (same auth, different wording).
    const loginPath = location.pathname === '/admin' || location.pathname.startsWith('/admin/') ? '/admin/login' : '/login'
    return <Navigate to={`${loginPath}?redirect=${redirect}`} replace />
  }

  if (!profile) {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="error"
        title="We couldn't load your account"
        message={getErrorMessage(profileError)}
        actions={
          <>
            <Button onClick={reloadProfile}>Try again</Button>
            <Button variant="secondary" onClick={signOut}>
              Sign out
            </Button>
          </>
        }
      />
    )
  }

  return <Outlet />
}

/**
 * Admin area. This only controls what the UI shows; the database's RLS policies
 * are what actually stop non-admins from reading or changing admin data.
 */
export function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return (
      <StatusScreen
        icon={ShieldAlert}
        tone="error"
        title="Owner access only"
        message="This area is reserved for the Surinder Caterers team."
        actions={<Button to="/account">Go to my account</Button>}
      />
    )
  }
  return <Outlet />
}

/**
 * Owner sign-in page. Signed-in admins go to the owner portal. A signed-in customer
 * is told this isn't an owner account (instead of being silently sent elsewhere),
 * and can sign out to use a different account.
 */
export function AdminGuestOnly() {
  const { loading, user, isAdmin, profile, signOut } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) return <PageLoader />
  if (user && isAdmin) return <Navigate to={safeRedirect(searchParams.get('redirect'), '/admin')} replace />
  if (user) {
    return (
      <StatusScreen
        icon={ShieldAlert}
        tone="error"
        title="Not an owner account"
        message={`You're signed in as ${profile?.email ?? user.email}, which is a customer account. Sign out to sign in with an owner account.`}
        actions={
          <>
            <Button to="/account">Go to my account</Button>
            <Button variant="secondary" onClick={signOut}>
              Sign out
            </Button>
          </>
        }
      />
    )
  }
  return <Outlet />
}

/** Login/register pages: signed-in users are sent on to their portal. */
export function GuestOnly() {
  const { loading, user, isAdmin } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) return <PageLoader />
  if (user) {
    return <Navigate to={safeRedirect(searchParams.get('redirect'), isAdmin ? '/admin' : '/account')} replace />
  }
  return <Outlet />
}
