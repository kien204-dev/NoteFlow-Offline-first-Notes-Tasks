import { registerSW } from 'virtual:pwa-register'

export const registerServiceWorker = () => {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl) {
      console.info(`Service worker registered: ${swUrl}`)
    },
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })
}
