import { ref } from 'vue';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// --- Global Singleton State ---
const globalSubscription = ref(null); // Will hold { planId: 'free', status: 'active', ... }
const globalIsLoadingSubscription = ref(true);
const auth = getAuth();
let globalUnsubscribeFirestore = null;
// --- End Global Singleton State ---

// --- Module-level function to manage subscription fetching ---
const manageSubscriptionFetching = (userId) => {
  if (globalUnsubscribeFirestore) {
    globalUnsubscribeFirestore();
    globalUnsubscribeFirestore = null;
  }

  if (!userId) {
    globalSubscription.value = null;
    globalIsLoadingSubscription.value = false;
    return;
  }

  globalIsLoadingSubscription.value = true;
  const db = getFirestore();
  const subscriptionRef = doc(db, 'users', userId, 'subscription', 'plan');

  globalUnsubscribeFirestore = onSnapshot(subscriptionRef, (docSnap) => {
    if (docSnap.exists()) {
      globalSubscription.value = docSnap.data();
    } else {
      globalSubscription.value = { planId: 'free', status: 'active' };
      console.warn(`Global subscription: Document not found for user: ${userId}. Defaulting to free plan.`);
    }
    globalIsLoadingSubscription.value = false;
  }, (error) => {
    console.error('Global subscription: Error fetching status:', error);
    globalSubscription.value = { planId: 'free', status: 'error' };
    globalIsLoadingSubscription.value = false;
  });
};
// --- End Module-level function ---

// --- Setup Auth Listener once when module is loaded ---
const unsubscribeAuth = auth.onAuthStateChanged(user => {
  if (user) {
    manageSubscriptionFetching(user.uid);
  } else {
    if (globalUnsubscribeFirestore) {
      globalUnsubscribeFirestore();
      globalUnsubscribeFirestore = null;
    }
    globalSubscription.value = null;
    globalIsLoadingSubscription.value = false;
  }
});

// Initial check in case auth state is already known when module loads
if (auth.currentUser) {
  manageSubscriptionFetching(auth.currentUser.uid);
} else {
  globalIsLoadingSubscription.value = false; // Not loading if no user initially
}
// --- End Auth Listener Setup ---

/**
 * Composable function to access the global subscription status.
 * @returns {object} An object containing reactive refs for subscription and isLoadingSubscription.
 */
export function useSubscription() {
  // Simply return the global reactive refs
  return {
    subscription: globalSubscription,
    isLoadingSubscription: globalIsLoadingSubscription,
    // No cleanup function is returned as components do not manage the lifecycle of this global state.
    // The auth listener (unsubscribeAuth) could be cleaned up if the app has a top-level unmount, 
    // but typically for global stores like this, it lives for the app's lifetime.
  };
}

// Optional: If you foresee a scenario where the entire app/module might be unloaded 
// and you need to explicitly tear down the auth listener (rare for typical SPAs).
// export function cleanupGlobalSubscriptionListeners() {
//   if (globalUnsubscribeFirestore) {
//     globalUnsubscribeFirestore();
//   }
//   unsubscribeAuth(); 
// } 