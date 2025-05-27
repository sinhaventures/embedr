import { ref, readonly } from 'vue';

const updateAvailable = ref(false);
const newVersion = ref('');

export function useUpdateStore() {
  const showUpdateNotification = (version) => {
    console.log('[useUpdateStore] Showing update notification for version:', version);
    newVersion.value = version;
    updateAvailable.value = true;
  };

  const hideUpdateNotification = () => {
    console.log('[useUpdateStore] Hiding update notification.');
    updateAvailable.value = false;
    newVersion.value = '';
  };

  return {
    updateAvailable: readonly(updateAvailable),
    newVersion: readonly(newVersion),
    showUpdateNotification,
    hideUpdateNotification,
  };
} 