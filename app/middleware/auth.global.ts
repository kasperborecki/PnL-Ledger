export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  const publicRoutes = new Set(['/login'])
  const auth = useAuth()

  await auth.ensureAuthReady()

  if (!auth.user.value && !publicRoutes.has(to.path)) {
    return navigateTo({
      path: '/login',
      query: to.path === '/' ? undefined : { redirect: to.fullPath },
    })
  }

  if (auth.user.value && to.path === '/login') {
    const redirect = typeof to.query.redirect === 'string' && to.query.redirect.startsWith('/')
      ? to.query.redirect
      : '/dashboard'

    return navigateTo(redirect)
  }
})
