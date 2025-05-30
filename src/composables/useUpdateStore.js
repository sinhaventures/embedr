import { ref, readonly } from 'vue';

const updateAvailable = ref(false);
const newVersion = ref('');
const releaseNotesInternal = ref(''); // For storing release notes or message
const isManualDownloadInternal = ref(false); // To know if it's manual download flow

export function useUpdateStore() {
  const showUpdateNotification = (details) => {
    console.log('[useUpdateStore] Showing update notification with details:', details);
    newVersion.value = details.version || '';
    releaseNotesInternal.value = details.releaseNotes || 'A new version is ready.';
    isManualDownloadInternal.value = details.isManualDownload || false;
    updateAvailable.value = true;
  };

  const hideUpdateNotification = () => {
    console.log('[useUpdateStore] Hiding update notification.');
    updateAvailable.value = false;
    newVersion.value = '';
    releaseNotesInternal.value = '';
    isManualDownloadInternal.value = false;
  };

  return {
    updateAvailable: readonly(updateAvailable),
    newVersion: readonly(newVersion),
    releaseNotes: readonly(releaseNotesInternal), // Expose releaseNotes
    isManualDownload: readonly(isManualDownloadInternal), // Expose isManualDownload
    showUpdateNotification,
    hideUpdateNotification,
  };
} 