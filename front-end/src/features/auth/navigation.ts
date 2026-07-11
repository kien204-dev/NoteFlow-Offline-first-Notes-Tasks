const routeChangeEvent = 'noteflow-route-change'

export type AppRoute = '/' | '/login' | '/register'

export const getCurrentRoute = (): AppRoute => {
  const path = window.location.pathname
  if (path === '/login' || path === '/register') return path
  return '/'
}

export const navigateTo = (route: AppRoute) => {
  if (window.location.pathname !== route) {
    window.history.pushState({}, '', route)
  }
  window.dispatchEvent(new Event(routeChangeEvent))
}

export const subscribeToRouteChanges = (listener: () => void) => {
  window.addEventListener('popstate', listener)
  window.addEventListener(routeChangeEvent, listener)

  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(routeChangeEvent, listener)
  }
}
