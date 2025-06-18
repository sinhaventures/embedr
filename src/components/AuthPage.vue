<template>
  <div class="fixed inset-0 flex items-center justify-center bg-[#1A1A1A] bg-opacity-95 backdrop-blur-xl text-[#EBEBF5] overflow-auto">
    <div class="w-full max-w-[420px] flex flex-col items-center">
      <!-- Logo and Header -->
      <div class="flex items-center gap-3 mb-10">
        <div class="w-14 h-14 bg-[#2A2A2A] rounded-2xl flex items-center justify-center shadow-sm">
          <img src="../assets/logo-small.png" alt="Embedr Logo" class="w-10 h-10">
        </div>
        <div>
          <h1 class="text-xl font-medium tracking-tight">Embedr</h1>
        </div>
      </div>

      <!-- Auth Container -->
      <div class="w-full bg-[#2A2A2A]/80 backdrop-blur-md rounded-2xl border border-[#3A3A3C] shadow-xl overflow-hidden">
        <!-- Auth Tabs -->
        <div class="px-4 pt-4">
          <div class="flex bg-[#1C1C1E] p-0.5 rounded-lg text-xs font-medium">
            <button 
              v-for="tab in ['Login', 'Sign Up', 'Reset Password']" 
              :key="tab"
              @click="activeTab = tab"
              :class="[
                'flex-1 py-2 px-3 transition-all rounded-md',
                activeTab === tab 
                  ? 'bg-[#323234] text-white shadow-sm' 
                  : 'bg-transparent text-[#EBEBF5]/60 hover:text-[#EBEBF5] hover:bg-[#2A2A2A]/50'
              ]"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <!-- Auth Forms -->
        <div class="p-5">
          <!-- Error/Success Messages -->
          <div v-if="errorMessage" class="mb-5 p-3 bg-[#FF453A]/10 border border-[#FF453A]/20 rounded-lg text-[#FF453A] text-xs">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="mb-5 p-3 bg-[#32D74B]/10 border border-[#32D74B]/20 rounded-lg text-[#32D74B] text-xs">
            {{ successMessage }}
          </div>

          <!-- Verify Email State -->
          <div v-if="activeTab === 'Verify Email'" class="text-center py-3">
            <div class="mb-6">
              <div class="w-14 h-14 bg-[#32D74B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#32D74B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h3 class="text-lg font-medium mb-2">Check your email</h3>
              <p class="text-[#EBEBF5]/60 text-sm mb-5">
                We've sent a verification link to your email address.
              </p>
              <button 
                @click="sendEmailVerification(auth.currentUser)"
                class="text-rose-400 hover:text-rose-300 transition-colors text-xs font-medium bg-rose-400/10 px-4 py-2 rounded-lg"
              >
                Resend verification email
              </button>
            </div>
            <button 
              @click="activeTab = 'Login'"
              class="text-[#EBEBF5]/60 hover:text-[#EBEBF5] transition-colors text-xs"
            >
              ← Back to login
            </button>
          </div>

          <!-- Login Form -->
          <form v-else-if="activeTab === 'Login'" @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <input 
                type="email" 
                v-model="email"
                required
                class="w-full px-3.5 py-2.5 bg-[#232325] border border-[#3A3A3C] rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm text-[#EBEBF5]/90"
                placeholder="Email address"
              />
            </div>
            <div>
              <input 
                type="password" 
                v-model="password"
                required
                class="w-full px-3.5 py-2.5 bg-[#232325] border border-[#3A3A3C] rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm text-[#EBEBF5]/90"
                placeholder="Password"
              />
            </div>
            <button 
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 bg-rose-500 rounded-lg text-white text-sm font-medium hover:bg-rose-400 transition-colors disabled:opacity-50 mt-2 flex items-center justify-center"
            >
              <span v-if="loading" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              {{ loading ? 'Signing in...' : 'Sign In' }}
            </button>
          </form>

          <!-- Sign Up Form -->
          <form v-else-if="activeTab === 'Sign Up'" @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <input 
                type="text" 
                v-model="name"
                required
                class="w-full px-3.5 py-2.5 bg-[#232325] border border-[#3A3A3C] rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm text-[#EBEBF5]/90"
                placeholder="Your name"
              />
            </div>
            <div>
              <input 
                type="email" 
                v-model="email"
                required
                class="w-full px-3.5 py-2.5 bg-[#232325] border border-[#3A3A3C] rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm text-[#EBEBF5]/90"
                placeholder="Email address"
              />
            </div>
            <div>
              <input 
                type="password" 
                v-model="password"
                required
                class="w-full px-3.5 py-2.5 bg-[#232325] border border-[#3A3A3C] rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm text-[#EBEBF5]/90"
                placeholder="Choose a password"
              />
            </div>
            <button 
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 bg-rose-500 rounded-lg text-white text-sm font-medium hover:bg-rose-400 transition-colors disabled:opacity-50 mt-2 flex items-center justify-center"
            >
              <span v-if="loading" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              {{ loading ? 'Creating account...' : 'Create Account' }}
            </button>
          </form>

          <!-- Reset Password Form -->
          <form v-else-if="activeTab === 'Reset Password'" @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <input 
                type="email" 
                v-model="email"
                required
                class="w-full px-3.5 py-2.5 bg-[#232325] border border-[#3A3A3C] rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 text-sm text-[#EBEBF5]/90"
                placeholder="Email address"
              />
            </div>
            <button 
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 bg-rose-500 rounded-lg text-white text-sm font-medium hover:bg-rose-400 transition-colors disabled:opacity-50 mt-2 flex items-center justify-center"
            >
              <span v-if="loading" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              {{ loading ? 'Sending...' : 'Send Reset Link' }}
            </button>
          </form>

          <!-- Form Footer -->
          <div v-if="activeTab !== 'Verify Email'" class="mt-6 text-center text-xs text-[#EBEBF5]/60">
            <p v-if="activeTab === 'Login'">
              Don't have an account? 
              <button @click="activeTab = 'Sign Up'" class="text-rose-400 hover:text-rose-300 transition-colors ml-1 bg-transparent">
                Sign up
              </button>
            </p>
            <p v-if="activeTab === 'Sign Up'">
              Already have an account? 
              <button @click="activeTab = 'Login'" class="text-rose-400 hover:text-rose-300 transition-colors ml-1">
                Login
              </button>
            </p>
            <p v-if="activeTab === 'Login'" class="mt-2">
              <button @click="activeTab = 'Reset Password'" class="text-rose-400 hover:text-rose-300 transition-colors">
                Forgot password?
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { auth } from '../firebase/config'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile } from 'firebase/auth'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const route = useRoute()
const { user, isAuthenticated, isEmailVerified } = useAuth()

const activeTab = ref(route.query.message === 'verify-email' ? 'Verify Email' : 'Login')
const email = ref('')
const password = ref('')
const name = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  loading.value = true

  try {
    if (activeTab.value === 'Login') {
      const { user: signedInUser } = await signInWithEmailAndPassword(auth, email.value, password.value)
      if (!signedInUser.emailVerified) {
        activeTab.value = 'Verify Email'
        errorMessage.value = 'Please verify your email before logging in.'
        await sendEmailVerification(signedInUser)
        return
      }
      router.push('/home')
    } 
    else if (activeTab.value === 'Sign Up') {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email.value, password.value)
      
      // Save the user's name to their profile
      if (name.value.trim()) {
        try {
          await updateProfile(newUser, {
            displayName: name.value.trim()
          });
          console.log('User profile updated with name:', name.value.trim());
        } catch (profileError) {
          console.error('Error updating user profile:', profileError);
        }
      }
      
      await sendEmailVerification(newUser)
      activeTab.value = 'Verify Email'
      successMessage.value = 'Registration successful! Please check your email for verification.'
    }
    else if (activeTab.value === 'Reset Password') {
      await sendPasswordResetEmail(auth, email.value)
      successMessage.value = 'Password reset email sent! Please check your inbox.'
    }
  } catch (error) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage.value = 'This email is already registered.'
        break
      case 'auth/invalid-email':
        errorMessage.value = 'Invalid email address.'
        break
      case 'auth/operation-not-allowed':
        errorMessage.value = 'Email/password accounts are not enabled.'
        break
      case 'auth/weak-password':
        errorMessage.value = 'Password should be at least 6 characters.'
        break
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        errorMessage.value = 'Invalid email or password.'
        break
      default:
        errorMessage.value = error.message
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
input, button {
  transition: all 0.2s ease;
}

input::placeholder {
  color: rgba(235, 235, 245, 0.5);
}

input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px #232325 inset;
  -webkit-text-fill-color: rgba(235, 235, 245, 0.9);
  transition: background-color 5000s ease-in-out 0s;
}

/* Windows 10 and older browser fallbacks for text buttons (excluding tab buttons) */
.mt-6 button[class*="text-rose-400"] {
  background-color: rgba(244, 63, 94, 0.1) !important;
  border: 1px solid rgba(244, 63, 94, 0.3) !important;
  color: rgba(244, 63, 94, 0.9) !important;
  padding: 0.25rem 0.75rem !important;
  border-radius: 0.5rem !important;
}

.mt-6 button[class*="text-rose-400"]:hover {
  background-color: rgba(244, 63, 94, 0.2) !important;
  border-color: rgba(244, 63, 94, 0.5) !important;
  color: rgba(244, 63, 94, 1) !important;
}

.mt-6 button[class*="text-[#EBEBF5]"] {
  background-color: rgba(235, 235, 245, 0.05) !important;
  border: 1px solid rgba(235, 235, 245, 0.2) !important;
  color: rgba(235, 235, 245, 0.6) !important;
  padding: 0.25rem 0.5rem !important;
  border-radius: 0.25rem !important;
}

.mt-6 button[class*="text-[#EBEBF5]"]:hover {
  background-color: rgba(235, 235, 245, 0.1) !important;
  border-color: rgba(235, 235, 245, 0.3) !important;
  color: rgba(235, 235, 245, 0.9) !important;
}

/* Windows 10 specific adjustments */
@media screen and (-ms-high-contrast: active), (-ms-high-contrast: none) {
  .mt-6 button[class*="text-rose-400"] {
    background-color: rgba(244, 63, 94, 0.15) !important;
    border: 1px solid rgba(244, 63, 94, 0.4) !important;
    color: rgba(244, 63, 94, 1) !important;
  }
  
  .mt-6 button[class*="text-rose-400"]:hover {
    background-color: rgba(244, 63, 94, 0.25) !important;
    border-color: rgba(244, 63, 94, 0.6) !important;
  }
  
  .mt-6 button[class*="text-[#EBEBF5]"] {
    background-color: rgba(235, 235, 245, 0.1) !important;
    border: 1px solid rgba(235, 235, 245, 0.25) !important;
    color: rgba(235, 235, 245, 0.7) !important;
  }
  
  .mt-6 button[class*="text-[#EBEBF5]"]:hover {
    background-color: rgba(235, 235, 245, 0.15) !important;
    border-color: rgba(235, 235, 245, 0.4) !important;
    color: rgba(235, 235, 245, 0.95) !important;
  }
}

/* Fallback for browsers that don't support CSS custom properties */
@supports not (color: var(--bg-background)) {
  .mt-6 button[class*="text-rose-400"] {
    background-color: rgba(244, 63, 94, 0.15) !important;
    border: 1px solid rgba(244, 63, 94, 0.4) !important;
    color: rgba(244, 63, 94, 1) !important;
  }
  
  .mt-6 button[class*="text-rose-400"]:hover {
    background-color: rgba(244, 63, 94, 0.25) !important;
    border-color: rgba(244, 63, 94, 0.6) !important;
  }
  
  .mt-6 button[class*="text-[#EBEBF5]"] {
    background-color: rgba(235, 235, 245, 0.1) !important;
    border: 1px solid rgba(235, 235, 245, 0.25) !important;
    color: rgba(235, 235, 245, 0.7) !important;
  }
  
  .mt-6 button[class*="text-[#EBEBF5]"]:hover {
    background-color: rgba(235, 235, 245, 0.15) !important;
    border-color: rgba(235, 235, 245, 0.4) !important;
    color: rgba(235, 235, 245, 0.95) !important;
  }
}

/* IE9+ fallbacks */
@media screen and (min-width: 0\0) {
  .mt-6 button[class*="text-rose-400"] {
    background-color: #f43f5e !important;
    background-color: rgba(244, 63, 94, 0.15) !important;
    border: 1px solid #f43f5e !important;
    color: #f43f5e !important;
  }
  
  .mt-6 button[class*="text-[#EBEBF5]"] {
    background-color: #ebebf5 !important;
    background-color: rgba(235, 235, 245, 0.1) !important;
    border: 1px solid #ebebf5 !important;
    color: #ebebf5 !important;
  }
}
</style> 