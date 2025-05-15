import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { auth } from './firebase/config'
import './index.css'

// Create the app instance
const app = createApp(App)

// Use router
app.use(router)

let appHasMounted = false

// Wait for Firebase Auth to initialize before mounting
auth.onAuthStateChanged(() => {
  if (!appHasMounted) {
  app.mount('#app')
    appHasMounted = true
  }
})
