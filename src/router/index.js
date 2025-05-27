import { createRouter, createWebHashHistory } from 'vue-router'
import { requireAuth, redirectIfAuthenticated } from './guards'

const routes = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/auth',
    name: 'auth',
    component: () => import('../components/AuthPage.vue'),
    beforeEnter: redirectIfAuthenticated,
    meta: { requiresGuest: true }
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('../components/HomePage.vue'),
    beforeEnter: requireAuth,
    meta: { requiresAuth: true }
  },
  {
    path: '/editor',
    name: 'editor',
    component: () => import('../components/EditorPage.vue'),
    beforeEnter: requireAuth,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// Global navigation guard
router.beforeEach((to, from, next) => {
  // If route requires auth, the beforeEnter guard will handle it
  if (to.meta.requiresAuth || to.meta.requiresGuest) {
    next()
  } else {
    // For routes without specific auth requirements
    next()
  }
})

export default router 