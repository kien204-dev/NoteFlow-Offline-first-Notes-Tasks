import jwt from 'jsonwebtoken'
import { verifyAccessToken } from './tokens.js'

const unauthorized = (response, code, message) =>
  response.status(401).json({ error: message, code })

const readBearerToken = (request) => {
  const header = request.headers.authorization
  if (!header) return null

  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) return null

  return token
}

export const requireAuth = (request, response, next) => {
  const token = readBearerToken(request)

  if (!token) {
    return unauthorized(response, 'missing_token', 'access token required')
  }

  try {
    const payload = verifyAccessToken(token)
    request.userId = payload.userId
    request.user = payload
    return next()
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return unauthorized(response, 'token_expired', 'access token expired')
    }

    return unauthorized(response, 'invalid_token', 'invalid access token')
  }
}
