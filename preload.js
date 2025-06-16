console.log('[Preload Script] Executing preload.js');

const { contextBridge, ipcRenderer } = require('electron');

// --- Direct Listener Test ---
ipcRenderer.on('board-selected-by-agent', (_event, fqbn) => {
  console.log(`[Preload Direct Listener] Received 'board-selected-by-agent': ${fqbn}`);
});
ipcRenderer.on('port-selected-by-agent', (_event, portPath) => {
    console.log(`[Preload Direct Listener] Received 'port-selected-by-agent': ${portPath}`);
});
// --------------------------

// --- Direct Listener Test for Agent CLI Output ---
ipcRenderer.on('show-agent-cli-output', (_event, output) => {
  console.log(`[Preload Direct Listener] Received 'show-agent-cli-output'. Output length: ${output?.length}`);
});
// -----------------------------------------------

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  compileSketch: (baseFqbn, options, sketchPath) => ipcRenderer.invoke('compile-sketch', baseFqbn, options, sketchPath),
  uploadSketch: (baseFqbn, options, port, sketchPath) => ipcRenderer.invoke('upload-sketch', baseFqbn, options, port, sketchPath),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  createProject: (projectName) => ipcRenderer.invoke('create-project', projectName),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  forceRefreshFile: (filePath) => ipcRenderer.invoke('force-refresh-file', filePath),
  listBoards: () => ipcRenderer.invoke('list-boards'),
  listAllBoards: () => ipcRenderer.invoke('list-all-boards'),
  searchLibrary: (query) => ipcRenderer.invoke('lib-search', query),
  installLibrary: (name, version) => ipcRenderer.invoke('lib-install', name, version),
  uninstallLibrary: (name) => ipcRenderer.invoke('lib-uninstall', name),
  listLibraries: () => ipcRenderer.invoke('lib-list'),
  updateLibraryIndex: () => ipcRenderer.invoke('lib-update-index'),
  
  // --- Arduino Core Management API ---
  updateCoreIndex: () => ipcRenderer.invoke('core-update-index'),
  listCores: () => ipcRenderer.invoke('core-list'),
  searchCores: (query) => ipcRenderer.invoke('core-search', query),
  installCore: (platformPackage) => ipcRenderer.invoke('core-install', platformPackage),
  uninstallCore: (platformPackage) => ipcRenderer.invoke('core-uninstall', platformPackage),
  upgradeCore: (platformPackage) => ipcRenderer.invoke('core-upgrade', platformPackage),
  onCoreInstallProgress: (callback) => ipcRenderer.on('core-install-progress', (_event, data) => callback(data)),
  clearCoreInstallProgressListener: () => {
    ipcRenderer.removeAllListeners('core-install-progress');
  },
  onArduinoAvrSetupStatus: (callback) => ipcRenderer.on('arduino-avr-setup-status', (_event, data) => callback(data)),
  clearArduinoAvrSetupStatusListener: () => {
    ipcRenderer.removeAllListeners('arduino-avr-setup-status');
  },
  getArduinoSetupStatus: () => ipcRenderer.invoke('get-arduino-setup-status'),
  onRefreshBoardList: (callback) => ipcRenderer.on('refresh-board-list', (_event, data) => callback(data)),
  clearRefreshBoardListListener: () => {
    ipcRenderer.removeAllListeners('refresh-board-list');
  },
  // --- END Arduino Core Management API ---

  // --- Custom Board URL Management API ---
  getBoardManagerConfig: () => ipcRenderer.invoke('board-manager-config-get'),
  addBoardManagerUrl: (url) => ipcRenderer.invoke('board-manager-add-url', url),
  removeBoardManagerUrl: (url) => ipcRenderer.invoke('board-manager-remove-url', url),
  // --- END Custom Board URL Management API ---

  // --- Arduino Update Management API ---
  outdated: () => ipcRenderer.invoke('outdated'),
  libUpgrade: (libraryName) => ipcRenderer.invoke('lib-upgrade', libraryName),
  libUpgradeAll: () => ipcRenderer.invoke('lib-upgrade-all'),
  coreUpgradeAll: () => ipcRenderer.invoke('core-upgrade-all'),
  // --- END Arduino Update Management API ---

  // --- Custom Library Installation API ---
  installLibraryGit: (gitUrl, version) => ipcRenderer.invoke('lib-install-git', gitUrl, version),
  installLibraryZip: (zipPath) => ipcRenderer.invoke('lib-install-zip', zipPath),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  // --- END Custom Library Installation API ---
  
  saveVersion: (filePath) => ipcRenderer.invoke('save-version', filePath),
  listVersions: (filePath) => ipcRenderer.invoke('list-versions', filePath),
  readVersion: (versionPath) => ipcRenderer.invoke('read-version', versionPath),
  deleteVersion: (versionPath) => ipcRenderer.invoke('delete-version', versionPath),
  deleteProject: (projectDir) => ipcRenderer.invoke('delete-project', projectDir),
  updateProjectName: (projectDir, newName) => ipcRenderer.invoke('update-project-name', projectDir, newName),
  updateProjectLastOpened: (projectDir) => ipcRenderer.invoke('update-project-last-opened', projectDir),

  // --- Co-pilot Chat API ---
  sendCopilotMessage: (userInput, threadId, projectPath, selectedBoardFqbn, selectedPortPath, selectedModel) => ipcRenderer.invoke('copilot-chat-message', userInput, threadId, projectPath, selectedBoardFqbn, selectedPortPath, selectedModel),
  listProjectChats: (projectPath) => ipcRenderer.invoke('list-project-chats', projectPath),
  getChatHistory: (projectPath, threadId) => ipcRenderer.invoke('get-chat-history', projectPath, threadId),
  deleteProjectChat: (projectPath, threadId) => ipcRenderer.invoke('delete-project-chat', projectPath, threadId),
  sendCopilotMessageStream: (userInput, threadId, projectPath, selectedBoardFqbn, selectedPortPath, selectedModel, imageDataUrl) => ipcRenderer.send('copilot-chat-message-stream', userInput, threadId, projectPath, selectedBoardFqbn, selectedPortPath, selectedModel, imageDataUrl),
  onCopilotChatStream: (callback) => ipcRenderer.on('copilot-chat-stream', (_event, data) => callback(data)),
  clearCopilotChatStream: () => ipcRenderer.removeAllListeners('copilot-chat-stream'),
  restoreCheckpoint: (projectPath, checkpointPath) => ipcRenderer.invoke('restore-checkpoint', projectPath, checkpointPath),
  migrateChatHistories: () => ipcRenderer.invoke('migrate-chat-histories'),
  getFullChatHistory: (projectPath, threadId) => ipcRenderer.invoke('get-full-chat-history', projectPath, threadId),

  // --- Serial Monitor API --- 
  listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),
  connectSerial: (portPath, baudRate) => ipcRenderer.invoke('serial-connect', portPath, baudRate),
  disconnectSerial: () => ipcRenderer.invoke('serial-disconnect'),
  sendSerialData: (data) => ipcRenderer.invoke('serial-send', data),
  // Listener registration (main -> renderer)
  onSerialData: (callback) => ipcRenderer.on('serial-data', (_event, value) => callback(value)),
  onSerialStatus: (callback) => ipcRenderer.on('serial-status', (_event, value) => callback(value)),
  // Listener cleanup
  clearSerialListeners: () => {
    ipcRenderer.removeAllListeners('serial-data');
    ipcRenderer.removeAllListeners('serial-status');
  },
  
  // --- File Change Notification ---
  onFileChanged: (callback) => ipcRenderer.on('file-changed', (_event, data) => callback(data)),
  clearFileChangeListener: () => {
    ipcRenderer.removeAllListeners('file-changed');
  },
  setWindowTitle: (title) => ipcRenderer.invoke('set-window-title', title),

  // --- Firebase Auth Token Management (NEW) ---
  setFirebaseAuthToken: (token, expiryTime) => ipcRenderer.invoke('set-firebase-auth-token', token, expiryTime),
  onRequestAuthToken: (callback) => {
    const listener = (_event) => callback();
    ipcRenderer.on('request-auth-token', listener);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener('request-auth-token', listener);
  },
  // --- END Firebase Auth Token Management ---

  // --- Board/Port Selection Sync ---
  setSelectedBoard: (fqbn) => ipcRenderer.invoke('set-selected-board', fqbn),
  setSelectedPort: (portPath) => ipcRenderer.invoke('set-selected-port', portPath),
  getBoardOptions: (baseFqbn) => ipcRenderer.invoke('get-board-options', baseFqbn),
  setSelectedBoardOptions: (options) => ipcRenderer.invoke('set-selected-board-options', options),
  onBoardSelectedByAgent: (callback) => {
    const listener = (_event, fqbn) => {
      console.log(`[Preload onBoardSelectedByAgent] Event received, calling callback for FQBN: ${fqbn}`);
      callback(fqbn);
    };
    ipcRenderer.on('board-selected-by-agent', listener);
    // Return a function to remove the listener
    return () => {
        console.log(`[Preload onBoardSelectedByAgent] Removing listener for FQBN: ${fqbn}`); // Note: fqbn in closure might be stale here
        ipcRenderer.removeListener('board-selected-by-agent', listener);
    }
  },
  onPortSelectedByAgent: (callback) => {
    const listener = (_event, portPath) => {
      console.log(`[Preload onPortSelectedByAgent] Event received, calling callback for Port: ${portPath}`);
      callback(portPath);
    };
    ipcRenderer.on('port-selected-by-agent', listener);
    // Return a function to remove the listener
     return () => {
        console.log(`[Preload onPortSelectedByAgent] Removing listener for Port: ${portPath}`); // Note: portPath in closure might be stale here
        ipcRenderer.removeListener('port-selected-by-agent', listener);
     }
  },
  // --- END Board/Port Selection Sync ---

  // --- Agent CLI Output Display ---
  onShowAgentCliOutput: (callback) => {
    const listener = (_event, output) => {
      console.log(`[Preload onShowAgentCliOutput] Event received, calling callback. Output length: ${output?.length}`); // Log when bridge listener fires
      callback(output);
    };
    ipcRenderer.on('show-agent-cli-output', listener);
    return () => ipcRenderer.removeListener('show-agent-cli-output', listener);
  },
  // --- END Agent CLI Output Display ---

  // Error Handling
  // ... existing code ...

  // New function
  cancelCopilotStream: () => ipcRenderer.send('cancel-copilot-stream'),

  // --- MonacoPilot Completion API (NEW) ---
  invokeMonacopilotCompletion: (body) => ipcRenderer.invoke('invoke-monacopilot-completion', body),
  // --- END MonacoPilot Completion API ---

  // === Checkpoint/Version related API for CopilotChat ===
  getLatestCheckpointPathForProject: (projectPath) => ipcRenderer.invoke('get-latest-checkpoint-path', projectPath),
  onProjectVersionChanged: (callback) => {
    const listener = (_event, projectPath) => callback(projectPath);
    ipcRenderer.on('project-version-changed', listener);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener('project-version-changed', listener);
  },
  // ===================================================

  // === Firebase Function Invocation & External URL (NEW) ===
  invokeFirebaseFunction: (functionName, payload) => ipcRenderer.invoke('invoke-firebase-function', functionName, payload),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  // =======================================================

  // === App Update Checking API (NEW) ===
  checkAppUpdate: () => ipcRenderer.invoke('check-app-update'),
  // ====================================

});

console.log('Preload script loaded and contextBridge executed.');
