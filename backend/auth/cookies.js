const cookieName = () => process.env.REFRESH_TOKEN_COOKIE_NAME || 'noteflow_refresh'

const isSecureCookie = () => process.env.REFRESH_TOKEN_COOKIE_SECURE === 'true'

const sameSite = () => {
  const value = process.env.REFRESH_TOKEN_COOKIE_SAME_SITE || 'lax'
  return ['lax', 'strict', 'none'].includes(value) ? value : 'lax'
}

export const getRefreshCookieName = cookieName

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isSecureCookie(),
  sameSite: sameSite(),
  path: '/api/auth',
})

export const readCookie = (request, name) => {
  const cookieHeader = request.headers.cookie
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim())
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`))

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}
