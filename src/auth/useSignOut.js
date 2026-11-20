import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from './AuthContext.js'
import { getErrorMessage } from '@/utils/errors.js'

export function useSignOut() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/', { replace: true })
      toast.success('You have been signed out.')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not sign out. Please try again.'))
    } finally {
      setSigningOut(false)
    }
  }, [signOut, navigate])

  return { signOut: handleSignOut, signingOut }
}
