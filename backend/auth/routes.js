import express from 'express'
import { logger } from '../logger.js'
import { createAuthRepository } from './authRepository.js'
import { getRefreshCookieName, getRefreshCookieOptions, readCookie } from './cookies.js'
import { hashPassword, verifyPassword } from './password.js'
import { createAccessToken, createRefreshToken, verifyRefreshToken } from './tokens.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const minPasswordLength = 8

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '')
const normalizePassword = (password) => (typeof password === 'string' ? password : '')

const isValidEmail = (email) => emailPattern.test(email)
const isValidPassword = (password) => password.length >= minPasswordLength

const publicUser = (user) => ({ id: user.id, email: user.email })

const issueSession = (response, user) => {
  const accessToken = createAccessToken(user)
  const refreshToken = createRefreshToken(user)

  response.cookie(getRefreshCookieName(), refreshToken, getRefreshCookieOptions())
  return response.json({ accessToken, user: publicUser(user) })
}

export const createAuthRouter = ({ pool }) => {
  const router = express.Router()
  const authRepository = createAuthRepository(pool)

  router.post('/register', async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email)
      const password = normalizePassword(request.body?.password)

      if (!isValidEmail(email)) {
        logger.warn('Auth register rejected: invalid email')
        return response.status(400).json({ error: 'invalid email' })
      }

      if (!isValidPassword(password)) {
        logger.warn('Auth register rejected: weak password')
        return response.status(400).json({ error: 'password must be at least 8 characters' })
      }

      const existingUser = await authRepository.findUserByEmail(email)
      if (existingUser) {
        logger.warn('Auth register rejected: duplicate email')
        return response.status(409).json({ error: 'email already registered' })
      }

      const passwordHash = await hashPassword(password)
      const user = await authRepository.createUser({ email, passwordHash })

      response.status(201)
      return issueSession(response, user)
    } catch (error) {
      next(error)
    }
  })

  router.post('/login', async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email)
      const password = normalizePassword(request.body?.password)
      const user = await authRepository.findUserByEmail(email)
      const isPasswordValid = user ? await verifyPassword(password, user.passwordHash) : false

      if (!user || !isPasswordValid) {
        logger.warn('Auth login rejected: invalid credentials')
        return response.status(401).json({ error: 'invalid credentials' })
      }

      return issueSession(response, user)
    } catch (error) {
      next(error)
    }
  })

  router.post('/refresh', async (request, response) => {
    try {
      const refreshToken = readCookie(request, getRefreshCookieName())
      if (!refreshToken) {
        logger.warn('Auth refresh rejected: missing refresh token')
        return response.status(401).json({ error: 'refresh token required' })
      }

      const payload = verifyRefreshToken(refreshToken)
      return response.json({
        accessToken: createAccessToken({ id: payload.userId, email: payload.email }),
      })
    } catch {
      logger.warn('Auth refresh rejected: invalid refresh token')
      return response.status(401).json({ error: 'invalid refresh token' })
    }
  })

  router.post('/logout', (_request, response) => {
    // Refresh tokens are stateless JWTs in this step, so logout clears the
    // httpOnly cookie. Server-side token revocation can be added later if we
    // introduce a persisted session table or token blacklist.
    response.clearCookie(getRefreshCookieName(), getRefreshCookieOptions())
    response.status(204).send()
  })

  return router
}
