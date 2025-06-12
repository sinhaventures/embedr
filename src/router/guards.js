import { auth } from '../firebase/config'

export function requireAuth(to, from, next) {
  return new Promise((resolve) => {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    unsubscribe()
    if (!user) {
        resolve(next({ 
        name: 'auth',
        query: { redirect: to.fullPath }
        }))
    } else if (!user.emailVerified) {
        resolve(next({ 
        name: 'auth',
        query: { 
          message: 'verify-email',
          redirect: to.fullPath
        }
        }))
    } else {
        resolve(next())
    }
    })
  })
}

export function redirectIfAuthenticated(to, from, next) {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    unsubscribe()
    
    if (user?.emailVerified) {
      // If there's a redirect query param, use that, otherwise go to home
      const redirectPath = to.query.redirect || '/home'
      next(redirectPath)
    } else {
      next()
    }
  })
} 