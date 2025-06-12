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
        
        // Handle specific error types
        if (result.data?.details === 'IAM_PERMISSION_REQUIRED') {
          throw new Error('Service temporarily unavailable. Please try again later or contact support if the issue persists.');
        } else if (result.data?.details === 'INSUFFICIENT_PERMISSIONS') {
          throw new Error('Authentication service is temporarily unavailable. Please try again later.');
        } else {
          throw new Error(result.error || 'Failed to generate authentication token for portal.');
        }
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
      
      // Show appropriate error message based on error type
      let title = "Error";
      let description = error.value;
      
      if (error.value.includes('Service temporarily unavailable') || 
          error.value.includes('Authentication service is temporarily unavailable')) {
        title = "Service Temporarily Unavailable";
        description = error.value;
      } else if (error.value.includes('Electron API')) {
        title = "Application Error";
        description = "Please restart the application and try again.";
      }
      
      toast({
        title,
        description,
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