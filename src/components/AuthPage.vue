<template>
  <div class="fixed inset-0 flex items-center justify-center bg-[#1E1E1E] text-white/90">
    <div class="w-full max-w-md p-8">
      <!-- Logo and Header -->
      <div class="flex items-center justify-center gap-3 mb-12">
        <div class="w-12 h-12 bg-[#2A2A2A] rounded-lg flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 class="text-2xl font-semibold">Embedr</h1>
          <div class="flex items-center gap-2 text-sm text-white/60">
            <span>Pro</span>
            <span>•</span>
            <a href="#" class="text-[#5B8EFF] hover:text-[#5B8EFF]/90 transition-colors">Settings</a>
          </div>
        </div>
      </div>

      <!-- Auth Container -->
      <div class="bg-[#1A1A1A] rounded-xl border border-white/10 overflow-hidden">
        <!-- Auth Tabs -->
        <div class="flex border-b border-white/10">
          <button 
            v-for="tab in ['Login', 'Sign Up', 'Reset Password']" 
            :key="tab"
            @click="activeTab = tab"
            :class="[
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab 
                ? 'text-white bg-white/5' 
                : 'text-white/60 hover:text-white/90'
            ]"
          >
            {{ tab }}
          </button>
        </div>

        <!-- Auth Forms -->
        <div class="p-6">
          <!-- Error/Success Messages -->
          <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm">
            {{ successMessage }}
          </div>

          <!-- Verify Email State -->
          <div v-if="activeTab === 'Verify Email'" class="text-center py-4">
            <div class="mb-6">
              <div class="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h3 class="text-xl font-semibold mb-2">Check your email</h3>
              <p class="text-white/60 mb-4">
                We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
              </p>
              <p class="text-sm text-white/40">
                Didn't receive the email? 
                <button 
                  @click="sendEmailVerification(auth.currentUser)"
                  class="text-[#5B8EFF] hover:text-[#5B8EFF]/90 transition-colors"
                >
                  Resend verification email
                </button>
              </p>
            </div>
            <button 
              @click="activeTab = 'Login'"
              class="text-white/60 hover:text-white/90 transition-colors text-sm"
            >
              ← Back to login
            </button>
          </div>

          <!-- Login Form -->
          <form v-else-if="activeTab === 'Login'" @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="block text-sm text-white/60 mb-1">Email</label>
              <input 
                type="email" 
                v-model="email"
                required
                class="w-full px-4 py-2 bg-[#252525] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B8EFF]/50 text-white/90"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label class="block text-sm text-white/60 mb-1">Password</label>
              <input 
                type="password" 
                v-model="password"
                required
                class="w-full px-4 py-2 bg-[#252525] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B8EFF]/50 text-white/90"
                placeholder="Enter your password"
              />
            </div>
            <button 
              type="submit"
              :disabled="loading"
              class="w-full py-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {{ loading ? 'Loading...' : 'Login' }}
            </button>
          </form>

          <!-- Sign Up Form -->
          <form v-else-if="activeTab === 'Sign Up'" @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="block text-sm text-white/60 mb-1">Name</label>
              <input 
                type="text" 
                v-model="name"
                required
                class="w-full px-4 py-2 bg-[#252525] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B8EFF]/50 text-white/90"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label class="block text-sm text-white/60 mb-1">Email</label>
              <input 
                type="email" 
                v-model="email"
                required
                class="w-full px-4 py-2 bg-[#252525] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B8EFF]/50 text-white/90"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label class="block text-sm text-white/60 mb-1">Password</label>
              <input 
                type="password" 
                v-model="password"
                required
                class="w-full px-4 py-2 bg-[#252525] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B8EFF]/50 text-white/90"
                placeholder="Choose a password"
              />
            </div>
            <button 
              type="submit"
              :disabled="loading"
              class="w-full py-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {{ loading ? 'Loading...' : 'Create Account' }}
            </button>
          </form>

          <!-- Reset Password Form -->
          <form v-else-if="activeTab === 'Reset Password'" @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="block text-sm text-white/60 mb-1">Email</label>
              <input 
                type="email" 
                v-model="email"
                required
                class="w-full px-4 py-2 bg-[#252525] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B8EFF]/50 text-white/90"
                placeholder="Enter your email"
              />
            </div>
            <button 
              type="submit"
              :disabled="loading"
              class="w-full py-2 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {{ loading ? 'Loading...' : 'Send Reset Link' }}
            </button>
          </form>

          <!-- Form Footer -->
          <div v-if="activeTab !== 'Verify Email'" class="mt-6 text-center text-sm text-white/60">
            <p v-if="activeTab === 'Login'">
              Don't have an account? 
              <button @click="activeTab = 'Sign Up'" class="text-[#5B8EFF] hover:text-[#5B8EFF]/90 transition-colors">
                Sign up
              </button>
            </p>
            <p v-if="activeTab === 'Sign Up'">
              Already have an account? 
              <button @click="activeTab = 'Login'" class="text-[#5B8EFF] hover:text-[#5B8EFF]/90 transition-colors">
                Login
              </button>
            </p>
            <p v-if="activeTab === 'Login'">
              <button @click="activeTab = 'Reset Password'" class="text-[#5B8EFF] hover:text-[#5B8EFF]/90 transition-colors">
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
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth'
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
/* Add any additional component-specific styles here */
</style> 