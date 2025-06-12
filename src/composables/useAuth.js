import { ref, onUnmounted } from 'vue'
import { auth } from '../firebase/config'
import { onAuthStateChanged } from 'firebase/auth'

const user = ref(null)
const isLoading = ref(true)

// Initialize auth state listener immediately
const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
  user.value = firebaseUser
  isLoading.value = false
})

export function useAuth() {
  const isAuthenticated = () => !!user.value
  const isEmailVerified = () => user.value?.emailVerified ?? false
  
  // Cleanup subscription when the last component using auth is unmounted
  // onUnmounted(() => {
  //   unsubscribe()
  // })

  return {
    user,
    isLoading,
    isAuthenticated,
    isEmailVerified,
  }
} 