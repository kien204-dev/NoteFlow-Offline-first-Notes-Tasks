const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const minPasswordLength = 8

export const validateAuthInput = ({ email, password }: { email: string; password: string }) => {
  if (!emailPattern.test(email.trim())) {
    return 'invalid email'
  }

  if (password.length < minPasswordLength) {
    return 'password must be at least 8 characters'
  }

  return null
}
