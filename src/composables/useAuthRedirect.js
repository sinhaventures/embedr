import { ref } from 'vue';
import { useToast } from "@/components/ui/toast/use-toast";

export function useAuthRedirect() {
  const isLoading = ref(false);
  const error = ref(null);
  const { toast } = useToast();

  const redirectToSubscriptionPortal = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      // 1. Get the current Firebase user's ID token from the main process
      //    (assuming your main process can provide this securely)
      //    For now, we'll call an Electron API that invokes the cloud function.
      //    This Electron API will need to handle getting the current user's ID token
      //    to authenticate the call to 'generateAuthRedirectToken'.
      if (!window.electronAPI || typeof window.electronAPI.invokeFirebaseFunction !== 'function') {
        throw new Error('Electron API for invoking Firebase function is not available.');
      }

      const result = await window.electronAPI.invokeFirebaseFunction('generateAuthRedirectToken', {});

      if (result.error || !result.data?.token) {
        console.error('Error generating auth redirect token:', result.error || 'No token in response');
        throw new Error(result.error || 'Failed to generate authentication token for portal.');
      }

      const customToken = result.data.token;
      const redirectUrl = `https://embedr.cc/login-via?token=${customToken}`;

      // 2. Open the URL in the default browser
      if (!window.electronAPI || typeof window.electronAPI.openExternalUrl !== 'function') {
        throw new Error('Electron API for opening external URL is not available.');
      }
      await window.electronAPI.openExternalUrl(redirectUrl);
      
      toast({
        title: "Redirecting...",
        description: "Opening the subscription management portal.",
      });

    } catch (err) {
      console.error('Error in redirectToSubscriptionPortal:', err);
      error.value = err.message || 'An unexpected error occurred.';
      toast({
        title: "Error",
        description: `Could not open subscription portal: ${error.value}`,
        variant: "destructive",
      });
    } finally {
      isLoading.value = false;
    }
  };

  return {
    redirectToSubscriptionPortal,
    isLoading,
    error,
  };
} 