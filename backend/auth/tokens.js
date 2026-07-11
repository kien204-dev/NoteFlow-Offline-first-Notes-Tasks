import jwt from 'jsonwebtoken'

const accessTokenExpiresIn = () => process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m'
const refreshTokenExpiresIn = () => process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d'

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required')
  }

  return process.env.JWT_SECRET
}

const signToken = ({ user, type, expiresIn }) =>
  jwt.sign({ userId: user.id, email: user.email, type }, getJwtSecret(), { expiresIn })

export const createAccessToken = (user) =>
  signToken({ user, type: 'access', expiresIn: accessTokenExpiresIn() })

export const createRefreshToken = (user) =>
  signToken({ user, type: 'refresh', expiresIn: refreshTokenExpiresIn() })

export const verifyRefreshToken = (token) => {
  const payload = jwt.verify(token, getJwtSecret())

  if (!payload || typeof payload !== 'object' || payload.type !== 'refresh') {
    throw new Error('Invalid refresh token')
  }

  return {
    userId: payload.userId,
    email: payload.email,
  }
}

export const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, getJwtSecret())

  if (!payload || typeof payload !== 'object' || payload.type !== 'access') {
    throw new Error('Invalid access token')
  }

  return {
    userId: payload.userId,
    email: payload.email,
  }
}
