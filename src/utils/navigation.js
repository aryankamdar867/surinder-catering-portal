/**
 * Only allow same-site relative redirects (prevents open-redirect attacks via ?redirect=).
 */
export function safeRedirect(path, fallback) {
  if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')) {
    return path
  }
  return fallback
}
