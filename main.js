const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const { SerialPort } = require('serialport');
const { v4: uuidv4 } = require('uuid');
// const { ChatGoogleGenerativeAI } = require('@langchain/google-genai'); // Commented out
const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { MemorySaver, StateGraph, Command } = require('@langchain/langgraph');
const { tool, StructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const { AIMessageChunk } = require("@langchain/core/messages");



// === AI Co-pilot/Agent dependencies ===
//require('dotenv').config();

// === Gemini LLM Model Initialization (OLD - COMMENTED OUT) === 
// console.log('GOOGLE_API_KEY loaded:', process.env.GOOGLE_API_KEY ? 'Yes' : 'No');
// // If you want to see the key itself (use with caution, remove after debugging):
// // console.log('Loaded API Key:', process.env.GOOGLE_API_KEY);
// 
// const chatModel = new ChatGoogleGenerativeAI({  // This global instance is no longer the primary chat model
//   apiKey: process.env.GOOGLE_API_KEY,
//   model: 'gemini-2.5-pro-preview-05-06',
//   // temperature: 0.2, // Removed for testing
//   streaming: true, // Enable streaming capabilities
//   maxOutputTokens: 2048, // Set a reasonable token limit
// });
// 
// // After model initialization, log detailed info about the model
// console.log('Old ChatGoogleGenerativeAI model was initialized:', {
//   hasStreamMethod: typeof chatModel.stream === 'function',
//   hasStreamCallMethod: typeof chatModel.streamCall === 'function',
//   hasInvokeMethod: typeof chatModel.invoke === 'function',
//   modelApiVersion: chatModel.modelApiVersion || 'unknown',
//   apiKey: process.env.GOOGLE_API_KEY ? '[REDACTED]' : undefined,
//   model: chatModel.model || 'unknown',
//   modelProperties: Object.keys(chatModel),
// });
// 
// // Log information about @langchain/google-genai version
// try {
//   console.log('Checking @langchain/google-genai package details:');
//   const packageJsonPath = require.resolve('@langchain/google-genai/package.json');
//   const packageInfo = require(packageJsonPath);
//   console.log('  Version:', packageInfo.version);
//   console.log('  Dependencies:', packageInfo.dependencies);
// } catch (err) {
//   console.error('Error loading @langchain/google-genai package details:', err.message);
// }
// === END OLD Gemini LLM Model Initialization ===

let activeSerialPort = null; // Variable to hold the active serial connection
let fileChangeDebounceTimers = {};

// === Centralized State for Board/Port ===
let currentSelectedBoardFqbn = null; // Holds the currently selected FQBN
let currentSelectedPortPath = null;  // Holds the currently selected Port Path
let currentSelectedBoardOptions = {}; // Holds the selected options { key: value, ... }
// =======================================

// Get the app root directory
const APP_ROOT = __dirname;
console.log('App root directory:', APP_ROOT);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;

function createWindow () {
  // Log the current working directory and relevant paths
  console.log('Current working directory:', process.cwd());
  console.log('__dirname:', __dirname);
  
  // Determine the icon path based on the platform and environment
  let iconPath;
  
  if (process.env.NODE_ENV === 'development') {
    // In development, use the icon from the build directory
    if (process.platform === 'win32') {
      iconPath = path.resolve(APP_ROOT, 'build', 'icons', 'win', 'icon.ico');
    } else if (process.platform === 'darwin') {
      iconPath = path.resolve(APP_ROOT, 'build', 'icons', 'mac', 'icon.icns');
    } else {
      iconPath = path.resolve(APP_ROOT, 'build', 'icons', 'png', '256x256.png');
    }
    
    // Fallback to PNG if platform-specific icon doesn't exist
    if (!fs.existsSync(iconPath)) {
      iconPath = path.resolve(APP_ROOT, 'public', 'icon.png');
    }
  } else {
    // In production, the icon might not be needed in BrowserWindow if properly embedded in exe
    // But let's try to set it anyway for runtime display
    if (process.platform === 'win32') {
      iconPath = path.resolve(APP_ROOT, 'build', 'icons', 'win', 'icon.ico');
      // Alternative path in production
      if (!fs.existsSync(iconPath)) {
        iconPath = path.resolve(APP_ROOT, 'build', 'icons', 'icon.ico');
      }
    } else if (process.platform === 'darwin') {
      iconPath = path.resolve(APP_ROOT, 'build', 'icons', 'mac', 'icon.icns');
    } else {
      iconPath = path.resolve(APP_ROOT, 'build', 'icons', 'png', '256x256.png');
    }
    
    // If icon still doesn't exist, set to undefined to let OS use embedded icon
    if (!fs.existsSync(iconPath)) {
      console.log('Icon file not found at:', iconPath);
      console.log('Letting OS use embedded executable icon instead');
      iconPath = undefined;
    }
  }
  
  console.log('Using icon path:', iconPath);
  
  const windowOptions = {
    width: 1200,
    height: 800,
    minWidth: 1100,
    minHeight: 800,
    webPreferences: {
      preload: path.resolve(APP_ROOT, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Add partition to avoid database conflicts with other instances
      partition: 'persist:embedr-main'
    }
  };
  
  // Only set icon if we have a valid path
  if (iconPath) {
    windowOptions.icon = iconPath;
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  // In development, use the Vite dev server
  if (process.env.NODE_ENV === 'development') {
    console.log('Loading development server...');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    const indexPath = path.resolve(APP_ROOT, 'dist', 'index.html');
    console.log('Loading production file:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Handle window errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Handle potential database errors
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('Renderer process crashed:', { killed });
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('Renderer process became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    console.log('Renderer process became responsive again');
  });

  // Prevent window from being garbage collected
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Set the app user model ID for Windows (helps with proper taskbar icon display)
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.embedr.app');
  }
  
  createWindow();

  // Ensure arduino:avr core is installed after window is created
  // Wait a bit for the window to fully load before starting Arduino setup
  setTimeout(() => {
    ensureArduinoAvrCore();
  }, 2000);

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(err => {
  console.error('Failed to initialize app:', err);
});



// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});



// Helper function to get the projects directory
function getProjectsDirectory() {
  return path.join(os.homedir(), 'EmbedrProjects');
}

// Helper function to get the Embedr data directory within projects
function getEmbedrDataDirectory() {
  const projectsDir = getProjectsDirectory();
  const dataDir = path.join(projectsDir, '.embedr');
  
  // Ensure the data directory exists
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return dataDir;
}

let PROJECTS_FILE;
// Always store projects.json in the projects directory
const embedrDataDir = getEmbedrDataDirectory();
PROJECTS_FILE = path.join(embedrDataDir, 'projects.json');

function getProjectsMetadata() {
  if (!fs.existsSync(PROJECTS_FILE)) return [];
  try {
    // Reads only the metadata stored in projects.json
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
  } catch (err) {
    console.error('Error reading projects metadata file:', err);
    return [];
  }
}

function getProjects() {
  const storedProjects = getProjectsMetadata();
  const liveProjects = [];

  for (const proj of storedProjects) {
    const inoPath = proj.ino || getMainInoPath(proj.dir); // Use helper to find ino
    if (inoPath && fs.existsSync(inoPath)) {
      try {
        const stats = fs.statSync(inoPath);
        liveProjects.push({
          ...proj, // Keep stored name, dir, ino
          birthtimeMs: stats.birthtimeMs, // Actual creation time
          mtimeMs: stats.mtimeMs, // Actual last modified time (proxy for last opened)
          // Keep original 'created' from JSON for compatibility if needed, but prefer stats
          created: proj.created || new Date(stats.birthtimeMs).toISOString() 
        });
      } catch (statErr) {
        console.warn(`Could not get stats for project ${proj.name} at ${inoPath}:`, statErr.message);
        // Optionally push project even without stats, or filter it out
        // liveProjects.push(proj); 
      }
    } else {
       console.warn(`Project directory or .ino file not found for ${proj.name}, skipping.`);
    }
  }
  return liveProjects;
}

function saveProjectsMetadata(projectsMetadata) {
   try {
    // Only save essential, non-volatile metadata
    const metadataToSave = projectsMetadata.map(p => ({
      name: p.name,
      dir: p.dir,
      ino: p.ino,
      created: p.created // Store original creation timestamp if needed elsewhere
    }));
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(metadataToSave, null, 2));
  } catch (err) {
    console.error('Error saving projects metadata file:', err);
  }
}

// Function to determine the correct arduino-cli executable name based on platform and architecture
function getArduinoCliExecutableName(platform, arch) {
  if (platform === 'win32') {
    return 'arduino-cli.exe'; // Windows usually has one binary, often x64 compatible
  } else if (platform === 'darwin') { // macOS
    if (arch === 'arm64') {
      return 'arduino-cli-arm64';
    } else if (arch === 'x64') {
      return 'arduino-cli-x64';
    } else {
      console.warn(`[getBundledArduinoCliPath] Unsupported macOS architecture: ${arch}. Falling back to generic 'arduino-cli'. This might fail.`);
      return 'arduino-cli'; // Fallback, might not be present or correct
    }
  } else if (platform === 'linux') {
    if (arch === 'arm64') {
      return 'arduino-cli-arm64';
    } else if (arch === 'x64') {
      return 'arduino-cli-x64';
    } else {
      console.warn(`[getBundledArduinoCliPath] Unsupported Linux architecture: ${arch}. Falling back to generic 'arduino-cli'. This might fail.`);
      return 'arduino-cli'; // Fallback
    }
  }
  console.error(`[getBundledArduinoCliPath] Unsupported platform: ${platform}.`);
  return 'arduino-cli'; // Should ideally throw an error or handle more gracefully
}

// Helper function to get the path to the bundled arduino-cli resources
function getBundledArduinoCliPath() {
  const platform = process.platform;
  const arch = process.arch; // Get the runtime architecture
  const executableName = getArduinoCliExecutableName(platform, arch);

  const platformDir = platform === 'win32' ? 'win' : (platform === 'darwin' ? 'mac' : 'linux');

  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'arduino-cli', 'bin', platformDir, executableName);
  } else {
    // Development path from project root (__dirname)
    return path.resolve(__dirname, 'resources', 'arduino-cli', 'bin', platformDir, executableName);
  }
}

function getArduinoCliDataDir() {
  // Store Arduino CLI data in the projects directory instead of app resources
  const embedrDataDir = getEmbedrDataDirectory();
  const arduinoDataDir = path.join(embedrDataDir, 'arduino-cli');
  
  // Ensure the Arduino CLI data directory exists
  if (!fs.existsSync(arduinoDataDir)) {
    fs.mkdirSync(arduinoDataDir, { recursive: true });
  }
  
  return arduinoDataDir;
}

function getArduinoCliConfigFile() {
  // The config file is within the data directory
  return path.join(getArduinoCliDataDir(), 'arduino-cli.yaml');
}

// Helper function to create default Arduino CLI configuration
function createDefaultArduinoCliConfig() {
  const configFile = getArduinoCliConfigFile();
  
  // Only create if it doesn't exist
  if (!fs.existsSync(configFile)) {
    const defaultConfig = `# Arduino CLI Configuration for Embedr
# This configuration ensures portable operation with user projects

directories:
  data: .
  downloads: ./downloads
  user: ./user

# Network configuration for reliable downloads
network:
  connection_timeout: 1800s  # 30 minutes for slow connections
  user_agent_ext: "embedr-app"

# Disable telemetry for privacy
telemetry:
  enabled: false

# Updater configuration
updater:
  enable_notification: false

# Board manager settings
board_manager:
  additional_urls: []

# Library settings
library:
  enable_unsafe_install: false

# Logging
logging:
  level: "info"
`;
    
    try {
      fs.writeFileSync(configFile, defaultConfig, 'utf-8');
      console.log(`Created default Arduino CLI config at: ${configFile}`);
    } catch (error) {
      console.error(`Failed to create Arduino CLI config: ${error.message}`);
    }
  }
}



const arduinoCliPath = getBundledArduinoCliPath();
const arduinoDataDir = getArduinoCliDataDir();
const arduinoConfigFile = getArduinoCliConfigFile();

console.log(`Using arduino-cli: ${arduinoCliPath}`);
console.log(`Using arduino-cli data dir: ${arduinoDataDir}`);
console.log(`Using arduino-cli config file: ${arduinoConfigFile}`);

// Create default Arduino CLI configuration
createDefaultArduinoCliConfig();

// Sanity check (optional, but good for debugging)
if (!fs.existsSync(arduinoCliPath)) {
  console.error(`ERROR: Bundled arduino-cli not found at ${arduinoCliPath}. Please ensure it is downloaded and placed correctly, then run 'npm run prepare-arduino'.`);
}

// Ensure Arduino CLI is configured with extended network timeout
async function ensureArduinoCliTimeout() {
  try {
    console.log('[setup] Configuring Arduino CLI network timeout...');
    const timeoutCommand = `"${arduinoCliPath}" config set network.connection_timeout 1800s --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;
    await new Promise((resolve, reject) => {
      exec(timeoutCommand, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
        if (error) {
          console.warn('[setup] Failed to set Arduino CLI timeout:', error.message);
          reject(error);
        } else {
          console.log('[setup] Arduino CLI network timeout set to 30 minutes');
          resolve(stdout);
        }
      });
    });
  } catch (error) {
    console.warn('[setup] Could not configure Arduino CLI timeout:', error.message);
  }
}

// Track if user has explicitly uninstalled arduino:avr to prevent re-installation
function hasUserUninstalledArduinoAvr() {
  try {
    const flagFile = path.join(getEmbedrDataDirectory(), '.arduino_avr_uninstalled');
    return fs.existsSync(flagFile);
  } catch (error) {
    return false;
  }
}

function markArduinoAvrAsUninstalled() {
  try {
    const flagFile = path.join(getEmbedrDataDirectory(), '.arduino_avr_uninstalled');
    fs.writeFileSync(flagFile, new Date().toISOString());
  } catch (error) {
    console.warn('[setup] Could not create uninstall flag:', error.message);
  }
}

// Ensure arduino:avr core is installed (runs once on startup)
async function ensureArduinoAvrCore() {
  try {
    console.log('[setup] Checking for arduino:avr core...');
    
    // Check if user has explicitly uninstalled arduino:avr
    if (hasUserUninstalledArduinoAvr()) {
      console.log('[setup] User has previously uninstalled arduino:avr core, skipping auto-installation');
      // Send status to frontend
      sendArduinoSetupStatus({
        status: 'skipped',
        reason: 'User previously uninstalled',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Send initial status to frontend
    sendArduinoSetupStatus({
      status: 'checking',
      message: 'Checking for arduino:avr core...',
      timestamp: new Date().toISOString()
    });
    
    // First check if core is already installed
    const listCommand = `"${arduinoCliPath}" core list --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;
    
    const isInstalled = await new Promise((resolve) => {
      exec(listCommand, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
        if (error) {
          console.log('[setup] Core list failed, will attempt fresh installation');
          resolve(false);
          return;
        }
        
        try {
          const data = JSON.parse(stdout);
          const platforms = data.platforms || [];
          const avrCore = platforms.find(p => p.id === 'arduino:avr');
          
          if (avrCore) {
            console.log(`[setup] arduino:avr core already installed (version ${avrCore.installed})`);
            resolve(true);
          } else {
            console.log('[setup] arduino:avr core not found, will install');
            resolve(false);
          }
        } catch (parseError) {
          console.log('[setup] Failed to parse core list, will attempt installation');
          resolve(false);
        }
      });
    });
    
    if (isInstalled) {
      // Send completion status to frontend
      sendArduinoSetupStatus({
        status: 'already-installed',
        message: 'arduino:avr core already installed',
        timestamp: new Date().toISOString()
      });
      // Trigger board list refresh even if already installed to ensure boards are populated
      setTimeout(() => {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('refresh-board-list', { 
            reason: 'arduino:avr already installed',
            timestamp: new Date().toISOString()
          });
          console.log('[setup] Sent refresh-board-list event for already installed arduino:avr');
        }
      }, 1000);
      return;
    }
    
    console.log('[setup] Installing arduino:avr core...');
    
    // Send installation start status to frontend
    sendArduinoSetupStatus({
      status: 'installing',
      message: 'Installing arduino:avr core...',
      timestamp: new Date().toISOString()
    });
    
    // Update index first
    const updateCommand = `"${arduinoCliPath}" core update-index --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;
    await new Promise((resolve, reject) => {
      exec(updateCommand, { cwd: arduinoDataDir, timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          console.warn('[setup] Failed to update core index:', error.message);
          sendArduinoSetupStatus({
            status: 'error',
            message: 'Failed to update core index',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          reject(error);
        } else {
          console.log('[setup] Core index updated successfully');
          sendArduinoSetupStatus({
            status: 'updating-index',
            message: 'Core index updated, installing core...',
            timestamp: new Date().toISOString()
          });
          resolve(stdout);
        }
      });
    });
    
    // Install arduino:avr core
    const installCommand = `"${arduinoCliPath}" core install arduino:avr --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;
    await new Promise((resolve, reject) => {
      exec(installCommand, { cwd: arduinoDataDir, timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('[setup] Failed to install arduino:avr core:', error.message);
          sendArduinoSetupStatus({
            status: 'error',
            message: 'Failed to install arduino:avr core',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          reject(error);
        } else {
          console.log('[setup] arduino:avr core installed successfully!');
          sendArduinoSetupStatus({
            status: 'completed',
            message: 'arduino:avr core installed successfully',
            timestamp: new Date().toISOString()
          });
          // Trigger board list refresh after successful installation
          setTimeout(() => {
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('refresh-board-list', { 
                reason: 'arduino:avr core installed',
                timestamp: new Date().toISOString()
              });
              console.log('[setup] Sent refresh-board-list event after arduino:avr installation');
            }
          }, 1000);
          resolve(stdout);
        }
      });
    });
    
  } catch (error) {
    console.error('[setup] Error ensuring arduino:avr core:', error.message);
    sendArduinoSetupStatus({
      status: 'error',
      message: 'Error during arduino:avr core setup',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    // Don't throw the error - let the app continue even if core installation fails
  }
}

// Configure Arduino CLI timeout on startup  
ensureArduinoCliTimeout();

// Store Arduino setup status globally to send to frontend when requested
let lastArduinoSetupStatus = null;

// Helper function to send Arduino setup status and store it globally
function sendArduinoSetupStatus(statusData) {
  lastArduinoSetupStatus = statusData;
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('arduino-avr-setup-status', statusData);
  }
}

// IPC handler to get the current Arduino setup status
ipcMain.handle('get-arduino-setup-status', async () => {
  return lastArduinoSetupStatus;
});

ipcMain.handle('compile-sketch', async (event, baseFqbn, options, sketchPath) => { // Added options, adjusted order
  console.log('[compile-sketch] Handler called with:', { baseFqbn, options, sketchPath });
  
  // Construct the full FQBN
  const fullFqbn = constructFullFqbn(baseFqbn, options);
  if (!fullFqbn) {
      return { success: false, error: 'Invalid base FQBN provided.' };
  }
  if (!sketchPath) {
      return { success: false, error: 'Sketch path is required.' };
  }

  return new Promise((resolve) => {
    // Use the full FQBN in the command
    const command = `"${arduinoCliPath}" compile --fqbn ${fullFqbn} "${sketchPath}" --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`; // Changed to --config-dir
    console.log(`[compile-sketch] Executing command: ${command}`);
    
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        console.error('[compile-sketch] Error:', stderr || error);
        // Send both stdout and stderr on error for more context
        resolve({ success: false, error: stderr || error.message, output: stdout });
        return;
      }
      console.log('[compile-sketch] Success stdout:', stdout);
      if (stderr) console.warn('[compile-sketch] Success stderr:', stderr);
      resolve({ success: true, output: stdout, error: stderr }); // Include stderr even on success
    });
  });
});

ipcMain.handle('upload-sketch', async (event, baseFqbn, options, port, sketchPath) => { // Added options, adjusted order
  console.log('[upload-sketch] Handler called with:', { baseFqbn, options, port, sketchPath });

  // Construct the full FQBN
  const fullFqbn = constructFullFqbn(baseFqbn, options);
  if (!fullFqbn) {
      return { success: false, error: 'Invalid base FQBN provided.' };
  }
  if (!sketchPath) {
      return { success: false, error: 'Sketch path is required.' };
  }
  if (!port) {
      return { success: false, error: 'Port path is required.' };
  }

  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" upload -p "${port}" --fqbn ${fullFqbn} "${sketchPath}" --verbose --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;
    console.log(`[upload-sketch] Executing command: ${command}`);
     
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) { // arduino-cli command itself failed (e.g., non-zero exit code)
        console.error('[upload-sketch] CLI Error:', error);
        console.error('[upload-sketch] CLI Stderr:', stderr);
        console.error('[upload-sketch] CLI Stdout:', stdout);
        // Prioritize stderr for error message, then error.message, then stdout if others are empty
        let errorMessage = stderr || error.message || stdout || 'Unknown upload error';
        resolve({ success: false, error: errorMessage, output: stdout }); 
        return;
      }
      // arduino-cli command succeeded. For verbose upload, avrdude's output is typically in stderr.
      console.log('[upload-sketch] CLI Success.');
      console.log('[upload-sketch] CLI Stdout (avrdude command):', stdout); 
      console.log('[upload-sketch] CLI Stderr (avrdude log):', stderr);
      resolve({ success: true, output: stderr, details: stdout }); // Main output is avrdude log (stderr), details is avrdude command (stdout)
    });
  });
});

ipcMain.handle('list-projects', async () => {
  return getProjects();
});

ipcMain.handle('create-project', async (event, projectName) => {
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeName) return { success: false, error: 'Invalid project name' };
  const projectsDir = getProjectsDirectory();
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });
  const projectDir = path.join(projectsDir, safeName);
  if (fs.existsSync(projectDir)) return { success: false, error: 'Project already exists' };
  fs.mkdirSync(projectDir);
  const inoPath = path.join(projectDir, `${safeName}.ino`);
  const creationTime = new Date(); // Capture creation time
  fs.writeFileSync(inoPath, `// ${safeName} Arduino Sketch\n\nvoid setup() {\n  \n}\n\nvoid loop() {\n  \n}\n`);
  // Save to projects.json
  // const projects = getProjects(); // Now gets live data, we need metadata
  const projectsMetadata = getProjectsMetadata(); 
  const newProjectMetadata = {
    name: safeName,
    dir: projectDir,
    ino: inoPath,
    created: creationTime.toISOString() // Store the precise creation time
  };
  projectsMetadata.unshift(newProjectMetadata);
  // saveProjects(projects.slice(0, 10)); // keep only 10 recent metadata
  saveProjectsMetadata(projectsMetadata.slice(0, 10)); 

  // Return the full project details including stats for immediate use
  const newProjectLive = {
     ...newProjectMetadata,
     birthtimeMs: creationTime.getTime(), // Use captured time
     mtimeMs: creationTime.getTime() // Initially same as birthtime
  }
  return { success: true, project: newProjectLive }; 
});

ipcMain.handle('update-project-last-opened', async (event, projectDir) => {
  const inoPath = getMainInoPath(projectDir);
  if (inoPath && fs.existsSync(inoPath)) {
    try {
      const now = new Date();
      fs.utimesSync(inoPath, now, now); // Update access and modification time
      console.log(`Updated last opened time for: ${inoPath}`);
      return { success: true };
    } catch (err) {
      console.error(`Error updating last opened time for ${inoPath}:`, err);
      return { success: false, error: err.message };
    }
  } else {
    console.warn(`Could not find .ino file to update last opened time for project: ${projectDir}`);
    return { success: false, error: 'Could not find project .ino file' };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return '';
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    
    // Notify renderer to refresh editor content with debounce protection
    console.log(`File written successfully: ${filePath}, notifying UI to refresh`);
    console.log(`mainWindow is ${mainWindow ? 'defined' : 'undefined'}`);
    
    // Clear any pending debounce timer for this file
    if (fileChangeDebounceTimers[filePath]) {
      clearTimeout(fileChangeDebounceTimers[filePath]);
    }
    
    // Set a new debounce timer (100ms)
    fileChangeDebounceTimers[filePath] = setTimeout(() => {
      if (mainWindow) {
        console.log(`mainWindow.webContents is ${mainWindow.webContents ? 'defined' : 'undefined'}`);
        if (mainWindow.webContents) {
          console.log(`Sending file-changed event for ${filePath}`);
          mainWindow.webContents.send('file-changed', { filePath });
          console.log(`Event sent. Is mainWindow destroyed? ${mainWindow.isDestroyed() ? 'Yes' : 'No'}`);
        } else {
          console.warn('Could not notify UI of file change - mainWindow.webContents not available');
        }
      } else {
        console.warn('Could not notify UI of file change - mainWindow not available');
      }
      
      // Remove the timer reference
      delete fileChangeDebounceTimers[filePath];
    }, 100);
    
    return true;
  } catch (e) {
    console.error(`Error writing file ${filePath}:`, e);
    return false;
  }
});

ipcMain.handle('force-refresh-file', async (event, filePath) => {
  console.log(`[force-refresh-file] Called for ${filePath}`);
  if (mainWindow && mainWindow.webContents) {
    console.log(`Sending forced file-changed event for ${filePath}`);
    mainWindow.webContents.send('file-changed', { filePath, forced: true });
    return true;
  } else {
    console.warn('[force-refresh-file] mainWindow or webContents not available');
    return false;
  }
});

ipcMain.handle('list-boards', async () => {
  console.log('list-boards handler called');
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" board list --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`; // Changed to --config-dir
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        console.error('arduino-cli error:', stderr || error.message);
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        // Flatten detected_ports for easier frontend consumption
        const ports = (data.detected_ports || []).map((entry) => {
          const port = entry.port || {};
          // If board info is present, add it; else, leave undefined
          const board = entry.board || null;
          return {
            address: port.address,
            protocol: port.protocol,
            label: port.label,
            board: board
          };
        });
        resolve({ success: true, ports });
      } catch (e) {
        console.error('Failed to parse board list output:', stdout);
        resolve({ success: false, error: 'Failed to parse board list output.' });
      }
    });
  });
});

ipcMain.handle('list-all-boards', async () => {
  return new Promise((resolve) => {
    const cliArgs = ['board', 'listall', '--format', 'json', '--config-file', arduinoConfigFile, '--config-dir', arduinoDataDir]; // Already changed, confirming consistency
    const child = spawn(arduinoCliPath, cliArgs, {
      cwd: arduinoDataDir
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error('[list-all-boards] arduino-cli error:', stderr || `Exited with code ${code}`);
        resolve({ success: false, error: stderr || `Exited with code ${code}` });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        let boards = [];
        
        // Check if data is directly an array of boards
        if (Array.isArray(data)) {
          boards = data.map(b => ({
            name: b.name,
            fqbn: b.fqbn
          }));
        }
        // Check if data has a boards property
        else if (data.boards && Array.isArray(data.boards)) {
          boards = data.boards.map(b => ({
            name: b.name,
            fqbn: b.fqbn
          }));
        }
        // Check if data has platforms with boards
        else if (data.platforms && Array.isArray(data.platforms)) {
          for (const platform of data.platforms) {
            if (platform.boards && Array.isArray(platform.boards)) {
              boards = boards.concat(platform.boards.map(b => ({
                name: b.name,
                fqbn: b.fqbn
              })));
            }
          }
        }
        
        resolve({ success: true, boards });
      } catch (e) {
        console.error('[list-all-boards] Failed to parse output:', e.message);
        resolve({ success: false, error: 'Failed to parse board listall output.' });
      }
    });
  });
}); 

ipcMain.handle('lib-search', async (event, query) => {
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" lib search "${query}" --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`; // Changed to --config-dir
    exec(command, { maxBuffer: 1024 * 1024 * 10, cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve({ success: true, results: data });
      } catch (e) {
        resolve({ success: false, error: 'Failed to parse search output.' });
      }
    });
  });
});

ipcMain.handle('lib-install', async (event, name, version) => {
  console.log('[lib-install] Handler called with:', { name, version });
  
  return new Promise((resolve) => {
    let libArg = name;
    if (version) {
      libArg += `@${version}`;
      console.log(`[lib-install] Installing specific version: ${libArg}`);
    } else {
      console.log(`[lib-install] Installing latest version of: ${libArg}`);
    }

    const quotedLibArg = `"${libArg}"`;
    const command = `"${arduinoCliPath}" lib install ${quotedLibArg} --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`; // Changed to --config-dir

    console.log(`[lib-install] Executing command: ${command}`);
    const childProcess = exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        console.error('[lib-install] Installation error:', error);
        console.error('[lib-install] stderr:', stderr);
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      console.log('[lib-install] stdout:', stdout);
      if (stderr) console.warn('[lib-install] stderr (non-fatal):', stderr);
      
      // Verify installation by checking if library exists
      const verifyCommand = `"${arduinoCliPath}" lib list --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`; // Changed to --config-dir
      exec(verifyCommand, { cwd: arduinoDataDir }, (verifyError, verifyStdout) => {
        if (verifyError) {
          console.error('[lib-install] Verification error:', verifyError);
          resolve({ success: false, error: 'Failed to verify installation' });
          return;
        }
        
        try {
          const installedLibsData = JSON.parse(verifyStdout);
          // Correctly access the nested array
          const installedLibsArray = installedLibsData.installed_libraries;
          
          if (!Array.isArray(installedLibsArray)) {
            console.error('[lib-install] Verification error: installed_libraries is not an array', installedLibsData);
            resolve({ success: false, error: 'Failed to verify installation - unexpected format' });
            return;
          }
          
          console.log('[lib-install] Current installed libraries:', installedLibsArray);
          
          // Check if our library is in the list
          const libName = name.toLowerCase();
          // Corrected: Only check against the 'name' field as 'real_name' is not present in 'lib list' output
          const found = installedLibsArray.some(lib => 
            lib.library.name.toLowerCase() === libName
          );
          
          if (found) {
            console.log(`[lib-install] Successfully verified installation of ${name}`);
            resolve({ success: true, output: stdout });
          } else {
            console.error(`[lib-install] Library ${name} not found after installation`);
            resolve({ success: false, error: `Library ${name} was not found after installation` });
          }
        } catch (parseError) {
          console.error('[lib-install] Error parsing library list:', parseError);
          resolve({ success: false, error: 'Failed to verify installation - parse error' });
        }
      });
    });

    // Log real-time output
    childProcess.stdout.on('data', (data) => {
      console.log(`[lib-install] Real-time stdout: ${data}`);
    });

    childProcess.stderr.on('data', (data) => {
      console.log(`[lib-install] Real-time stderr: ${data}`);
    });
  });
});

ipcMain.handle('lib-uninstall', async (event, name) => {
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" lib uninstall "${name}" --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`; // Changed to --config-dir
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      resolve({ success: true, output: stdout });
    });
  });
});

ipcMain.handle('lib-list', async () => {
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" lib list --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`; // Changed to --config-dir
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve({ success: true, libraries: data });
      } catch (e) {
        resolve({ success: false, error: 'Failed to parse list output.' });
      }
    });
  });
});

ipcMain.handle('lib-update-index', async () => {
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" lib update-index --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`; // Changed to --config-dir
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      resolve({ success: true, output: stdout });
    });
  });
});

// === Arduino Core Management Handlers ===

ipcMain.handle('core-update-index', async () => {
  return new Promise((resolve) => {
    const args = [
      'core', 'update-index',
      '--format', 'json',
      '--config-file', arduinoConfigFile,
      '--config-dir', arduinoDataDir
    ];
    
    console.log(`[core-update-index] Executing: ${arduinoCliPath} ${args.join(' ')}`);
    
    // Note: Arduino CLI timeout is configured in the config file via network.connection_timeout
    
    const childProcess = spawn(arduinoCliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: arduinoDataDir
    });

    let stdout = '';
    let stderr = '';
    
    // Set up a 10 minute timeout for the entire operation
    const timeout = setTimeout(() => {
      console.log(`[core-update-index] Operation timed out after 10 minutes`);
      childProcess.kill('SIGTERM');
    }, 10 * 60 * 1000);

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[core-update-index] stdout: ${output.trim()}`);
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log(`[core-update-index] stderr: ${output.trim()}`);
    });

    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`[core-update-index] Process exited with code: ${code}`);
      
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        let errorMessage = stderr || `Process exited with code ${code}`;
        
        // Parse error message from stderr JSON if possible
        try {
          const stderrJson = JSON.parse(stderr);
          if (stderrJson.error) {
            errorMessage = stderrJson.error;
          }
          
          // Add additional context for common errors
          if (stderrJson.warnings && Array.isArray(stderrJson.warnings)) {
            const warnings = stderrJson.warnings.join('; ');
            if (warnings.includes('Loading index file') && warnings.includes('no such file or directory')) {
              errorMessage += '\n\nThis error suggests that one or more custom board package URLs may be invalid or temporarily unavailable. Consider removing recently added custom URLs if the problem persists.';
            }
          }
        } catch (e) {
          // If it's not valid JSON, provide helpful context for common patterns
          if (stderr.includes('no such file or directory') && stderr.includes('index')) {
            errorMessage += '\n\nThis error suggests that one or more board package index files could not be downloaded. This may be due to invalid URLs or network issues.';
          }
        }
        
        // Always resolve instead of rejecting to prevent hanging
        resolve({ success: false, error: errorMessage });
      }
    });

    childProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[core-update-index] Process error:`, error);
      // Always resolve instead of rejecting to prevent hanging
      resolve({ success: false, error: error.message });
    });
  });
});

ipcMain.handle('core-list', async () => {
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" core list --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve({ success: true, platforms: data.platforms || [] });
      } catch (e) {
        resolve({ success: false, error: 'Failed to parse core list output.' });
      }
    });
  });
});

ipcMain.handle('core-search', async (event, query) => {
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" core search "${query}" --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;
    exec(command, { 
      maxBuffer: 1024 * 1024 * 10,
      timeout: 2 * 60 * 1000, // 2 minutes timeout for searches
      cwd: arduinoDataDir
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve({ success: true, results: data.platforms || [] });
      } catch (e) {
        resolve({ success: false, error: 'Failed to parse search output.' });
      }
    });
  });
});

ipcMain.handle('core-install', async (event, platformPackage) => {
  console.log(`[core-install] Installing core: ${platformPackage}`);
  
  const attemptInstallation = (attempt = 1, maxAttempts = 3) => {
    return new Promise((resolve) => {
      const args = [
        'core', 'install', platformPackage,
        '--format', 'json',
        '--config-file', arduinoConfigFile,
        '--config-dir', arduinoDataDir
      ];
      
      console.log(`[core-install] Attempt ${attempt}/${maxAttempts} - Executing: ${arduinoCliPath} ${args.join(' ')}`);
      
      // Note: Arduino CLI timeout is configured in the config file via network.connection_timeout
      
      const childProcess = spawn(arduinoCliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: arduinoDataDir
      });

      let stdout = '';
      let stderr = '';
      let isProcessing = false;

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        isProcessing = true;
        console.log(`[core-install] stdout: ${output.trim()}`);
        
        // Send real-time progress to frontend
        if (mainWindow) {
          mainWindow.webContents.send('core-install-progress', { 
            type: 'stdout', 
            data: output,
            timestamp: new Date().toISOString(),
            status: 'installing'
          });
        }
      });

      childProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        isProcessing = true;
        console.log(`[core-install] stderr: ${output.trim()}`);
        
        // Send real-time progress to frontend
        if (mainWindow) {
          mainWindow.webContents.send('core-install-progress', { 
            type: 'stderr', 
            data: output,
            timestamp: new Date().toISOString(),
            status: 'installing'
          });
        }
      });

      childProcess.on('close', (code) => {
        console.log(`[core-install] Process exited with code: ${code}`);
        
        // Send final status to frontend
        if (mainWindow) {
          mainWindow.webContents.send('core-install-progress', { 
            type: 'status', 
            data: `Process completed with code ${code}`,
            timestamp: new Date().toISOString(),
            status: code === 0 ? 'completed' : 'failed',
            code
          });
        }
        
        if (code === 0) {
          console.log('[core-install] Installation completed successfully');
          
          // Send success notification to frontend
          if (mainWindow) {
            mainWindow.webContents.send('core-install-progress', { 
              type: 'success', 
              data: `Successfully installed ${platformPackage}`,
              timestamp: new Date().toISOString(),
              status: 'success'
            });
          }
          
          try {
            let resultData = {};
            if (stdout.trim()) {
              resultData = JSON.parse(stdout);
            }
            resolve({ success: true, output: resultData, message: `Successfully installed ${platformPackage}` });
          } catch (parseErr) {
            console.warn('[core-install] Failed to parse output as JSON:', parseErr);
            resolve({ success: true, output: stdout, message: `Successfully installed ${platformPackage}` });
          }
        } else {
          console.error(`[core-install] Installation failed (attempt ${attempt})`);
          console.error('[core-install] stderr:', stderr);
          
          // Parse error message from stderr JSON if possible
          let errorMessage = stderr;
          try {
            const stderrJson = JSON.parse(stderr);
            if (stderrJson.error) {
              errorMessage = stderrJson.error;
            }
          } catch (e) {
            // If it's not valid JSON, use raw stderr
            errorMessage = stderr || `Installation failed with exit code ${code}`;
          }
          
          // Send error notification to frontend
          if (mainWindow) {
            mainWindow.webContents.send('core-install-progress', { 
              type: 'error', 
              data: errorMessage,
              timestamp: new Date().toISOString(),
              status: 'error'
            });
          }
          
          // Only retry on specific network-related errors and if we haven't reached max attempts
          if (attempt < maxAttempts && (
            errorMessage.includes('network') ||
            errorMessage.includes('connection') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('context deadline exceeded') ||
            errorMessage.includes('request canceled')
          )) {
            console.log(`[core-install] Retrying installation (attempt ${attempt + 1}/${maxAttempts}) after network error...`);
            
            // Send retry notification to frontend
            if (mainWindow) {
              mainWindow.webContents.send('core-install-progress', { 
                type: 'retry', 
                data: `Retrying installation (attempt ${attempt + 1}/${maxAttempts})...`,
                timestamp: new Date().toISOString(),
                status: 'retrying'
              });
            }
            
            setTimeout(() => {
              attemptInstallation(attempt + 1, maxAttempts).then(resolve);
            }, 3000);
            return;
          }
          
          resolve({ success: false, error: errorMessage, output: stdout });
        }
      });

      childProcess.on('error', (error) => {
        console.error(`[core-install] Process error:`, error);
        
        // Send error notification to frontend
        if (mainWindow) {
          mainWindow.webContents.send('core-install-progress', { 
            type: 'error', 
            data: `Process error: ${error.message}`,
            timestamp: new Date().toISOString(),
            status: 'error'
          });
        }
        
        resolve({ success: false, error: error.message, output: stdout });
      });
    });
  };
  
  return attemptInstallation();
});

ipcMain.handle('core-uninstall', async (event, platformPackage) => {
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" core uninstall "${platformPackage}" --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      
      // If arduino:avr core was uninstalled, mark it to prevent auto-reinstallation
      if (platformPackage === 'arduino:avr') {
        console.log('[core-uninstall] User uninstalled arduino:avr core, marking to prevent auto-reinstallation');
        markArduinoAvrAsUninstalled();
      }
      
      try {
        let resultData = {};
        if (stdout.trim()) {
          resultData = JSON.parse(stdout);
        }
        resolve({ success: true, output: resultData });
      } catch (parseErr) {
        resolve({ success: true, output: stdout }); // Still consider it a success but return raw output
      }
    });
  });
});

ipcMain.handle('core-upgrade', async (event, platformPackage) => {
  const args = platformPackage 
    ? ['core', 'upgrade', platformPackage, '--format', 'json', '--config-file', arduinoConfigFile, '--config-dir', arduinoDataDir]
    : ['core', 'upgrade', '--format', 'json', '--config-file', arduinoConfigFile, '--config-dir', arduinoDataDir]; // Upgrade all if no package specified
  
  console.log(`[core-upgrade] Executing: ${arduinoCliPath} ${args.join(' ')}`);
  
  return new Promise((resolve) => {
    // Note: Arduino CLI timeout is configured in the config file via network.connection_timeout
    
    const childProcess = spawn(arduinoCliPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: arduinoDataDir
    });

    let stdout = '';
    let stderr = '';
    
    // Set up a 15 minute timeout for the entire operation
    const timeout = setTimeout(() => {
      console.log(`[core-upgrade] Operation timed out after 15 minutes`);
      childProcess.kill('SIGTERM');
    }, 15 * 60 * 1000);

    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[core-upgrade] stdout: ${output.trim()}`);
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log(`[core-upgrade] stderr: ${output.trim()}`);
    });

    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`[core-upgrade] Process exited with code: ${code}`);
      
      if (code === 0) {
        try {
          let resultData = {};
          if (stdout.trim()) {
            resultData = JSON.parse(stdout);
          }
          resolve({ success: true, output: resultData });
        } catch (parseErr) {
          console.warn('[core-upgrade] Failed to parse output as JSON:', parseErr);
          resolve({ success: true, output: stdout });
        }
      } else {
        let errorMessage = stderr || `Process exited with code ${code}`;
        
        // Parse error message from stderr JSON if possible
        try {
          const stderrJson = JSON.parse(stderr);
          if (stderrJson.error) {
            errorMessage = stderrJson.error;
          }
        } catch (e) {
          // If it's not valid JSON, use as-is
        }
        
        resolve({ success: false, error: errorMessage });
      }
    });

    childProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[core-upgrade] Process error:`, error);
      resolve({ success: false, error: error.message });
    });
  });
});

// === End Arduino Core Management Handlers ===

// === Custom Board URL Management Handlers ===

// Get current board manager configuration
ipcMain.handle('board-manager-config-get', async () => {
  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" config dump --config-dir "${arduinoDataDir}"`;
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      try {
        // Parse YAML output to get additional URLs
        const yamlData = stdout;
        const urlsMatch = yamlData.match(/additional_urls:\s*\n((?:\s*-\s*.+\n?)*)/);
        const additionalUrls = [];
        
        if (urlsMatch && urlsMatch[1]) {
          const urlsSection = urlsMatch[1];
          const urlMatches = urlsSection.match(/^\s*-\s*(.+)$/gm);
          if (urlMatches) {
            urlMatches.forEach(match => {
              const url = match.replace(/^\s*-\s*/, '').trim();
              if (url) {
                additionalUrls.push(url);
              }
            });
          }
        }
        
        resolve({ 
          success: true, 
          additionalUrls,
          rawConfig: yamlData
        });
      } catch (e) {
        resolve({ success: false, error: 'Failed to parse config output.' });
      }
    });
  });
});

// Add a custom board URL
ipcMain.handle('board-manager-add-url', async (event, url) => {
  console.log('[board-manager-add-url] Adding URL:', url);
  
  return new Promise((resolve) => {
    if (!url || !url.trim()) {
      resolve({ success: false, error: 'URL is required' });
      return;
    }

    const cleanUrl = url.trim();
    const command = `"${arduinoCliPath}" config add board_manager.additional_urls "${cleanUrl}" --config-dir "${arduinoDataDir}"`;
    
    console.log('[board-manager-add-url] Executing:', command);
    
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      console.log('[board-manager-add-url] Command completed');
      console.log('[board-manager-add-url] stdout:', stdout);
      console.log('[board-manager-add-url] stderr:', stderr);
      console.log('[board-manager-add-url] error:', error);
      
      if (error) {
        let errorMessage = 'Failed to add custom board URL';
        
        if (stderr) {
          errorMessage = stderr.trim();
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        console.log('[board-manager-add-url] Error message:', errorMessage);
        resolve({ 
          success: false, 
          error: errorMessage,
          output: { stdout, stderr }
        });
        return;
      }
      
      resolve({ success: true, output: { stdout, stderr } });
    });
  });
});

// Remove a custom board URL
ipcMain.handle('board-manager-remove-url', async (event, url) => {
  console.log('[board-manager-remove-url] Removing URL:', url);
  
  return new Promise((resolve) => {
    if (!url || !url.trim()) {
      resolve({ success: false, error: 'URL is required' });
      return;
    }

    const cleanUrl = url.trim();
    const command = `"${arduinoCliPath}" config remove board_manager.additional_urls "${cleanUrl}" --config-dir "${arduinoDataDir}"`;
    
    console.log('[board-manager-remove-url] Executing:', command);
    
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      console.log('[board-manager-remove-url] Command completed');
      console.log('[board-manager-remove-url] stdout:', stdout);
      console.log('[board-manager-remove-url] stderr:', stderr);
      console.log('[board-manager-remove-url] error:', error);
      
      if (error) {
        let errorMessage = 'Failed to remove custom board URL';
        
        if (stderr) {
          errorMessage = stderr.trim();
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        console.log('[board-manager-remove-url] Error message:', errorMessage);
        resolve({ 
          success: false, 
          error: errorMessage,
          output: { stdout, stderr }
        });
        return;
      }
      
      resolve({ success: true, output: { stdout, stderr } });
    });
  });
});

// === End Custom Board URL Management Handlers ===

// === Arduino Update Management Handlers ===

// Check for outdated packages (libraries and cores)
ipcMain.handle('outdated', async (event) => {
  return new Promise((resolve) => {
    const cliPath = getBundledArduinoCliPath();
    const configDir = getArduinoCliDataDir();
    const args = ['outdated', '--format', 'json', '--config-dir', configDir];
    
    console.log(`[outdated] Running: ${cliPath} ${args.join(' ')}`);
    
    const child = spawn(cliPath, args, { 
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: configDir 
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(`[outdated] Exit code: ${code}`);
      console.log(`[outdated] stdout: ${stdout.substring(0, 500)}...`);
      if (stderr) console.log(`[outdated] stderr: ${stderr}`);
      
      if (code !== 0) {
        console.error(`[outdated] Command failed with exit code ${code}`);
        resolve({ success: false, error: stderr || 'Command failed' });
        return;
      }
      
      try {
        let resultData = {};
        if (stdout.trim()) {
          resultData = JSON.parse(stdout);
        }
        console.log(`[outdated] Parsed result:`, JSON.stringify(resultData, null, 2));
        resolve({ success: true, outdated: resultData });
      } catch (parseErr) {
        console.error('[outdated] JSON parse error:', parseErr);
        console.error('[outdated] Raw stdout:', stdout);
        resolve({ success: false, error: 'Failed to parse outdated packages data' });
      }
    });
  });
});

// Upgrade a specific library
ipcMain.handle('lib-upgrade', async (event, libraryName) => {
  return new Promise((resolve) => {
    const cliPath = getBundledArduinoCliPath();
    const configDir = getArduinoCliDataDir();
    const args = ['lib', 'upgrade', libraryName, '--format', 'json', '--config-dir', configDir];
    
    console.log(`[lib-upgrade] Running: ${cliPath} ${args.join(' ')}`);
    
    const child = spawn(cliPath, args, { 
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: configDir 
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(`[lib-upgrade] Exit code: ${code}`);
      console.log(`[lib-upgrade] stdout: ${stdout}`);
      if (stderr) console.log(`[lib-upgrade] stderr: ${stderr}`);
      
      if (code !== 0) {
        resolve({ success: false, error: stderr || 'Upgrade failed' });
        return;
      }
      
      try {
        let resultData = {};
        if (stdout.trim()) {
          resultData = JSON.parse(stdout);
        }
        resolve({ success: true, output: resultData });
      } catch (parseErr) {
        resolve({ success: true, output: stdout }); // Still consider it a success but return raw output
      }
    });
  });
});

// Upgrade all libraries
ipcMain.handle('lib-upgrade-all', async (event) => {
  return new Promise((resolve) => {
    const cliPath = getBundledArduinoCliPath();
    const configDir = getArduinoCliDataDir();
    const args = ['lib', 'upgrade', '--format', 'json', '--config-dir', configDir];
    
    console.log(`[lib-upgrade-all] Running: ${cliPath} ${args.join(' ')}`);
    
    const child = spawn(cliPath, args, { 
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: configDir 
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(`[lib-upgrade-all] Exit code: ${code}`);
      console.log(`[lib-upgrade-all] stdout: ${stdout}`);
      if (stderr) console.log(`[lib-upgrade-all] stderr: ${stderr}`);
      
      if (code !== 0) {
        resolve({ success: false, error: stderr || 'Upgrade all failed' });
        return;
      }
      
      try {
        let resultData = {};
        if (stdout.trim()) {
          resultData = JSON.parse(stdout);
        }
        resolve({ success: true, output: resultData });
      } catch (parseErr) {
        resolve({ success: true, output: stdout }); // Still consider it a success but return raw output
      }
    });
  });
});

// Upgrade all cores
ipcMain.handle('core-upgrade-all', async (event) => {
  return new Promise((resolve) => {
    const cliPath = getBundledArduinoCliPath();
    const configDir = getArduinoCliDataDir();
    const args = ['core', 'upgrade', '--format', 'json', '--config-dir', configDir];
    
    console.log(`[core-upgrade-all] Running: ${cliPath} ${args.join(' ')}`);
    
    const child = spawn(cliPath, args, { 
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: configDir 
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(`[core-upgrade-all] Exit code: ${code}`);
      console.log(`[core-upgrade-all] stdout: ${stdout}`);
      if (stderr) console.log(`[core-upgrade-all] stderr: ${stderr}`);
      
      if (code !== 0) {
        resolve({ success: false, error: stderr || 'Upgrade all cores failed' });
        return;
      }
      
      try {
        let resultData = {};
        if (stdout.trim()) {
          resultData = JSON.parse(stdout);
        }
        resolve({ success: true, output: resultData });
      } catch (parseErr) {
        resolve({ success: true, output: stdout }); // Still consider it a success but return raw output
      }
    });
  });
});

// === End Arduino Update Management Handlers ===

// === Checkpoint Management ===

// Helper function to extract the core logic of saving a version
async function performSaveVersionLogic(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.warn(`[performSaveVersionLogic] Invalid file path or file doesn't exist: ${filePath}`);
    return { success: false, error: 'Invalid file path or file not found' };
  }

  return new Promise((resolve) => { // No reject, always resolve with success/error object
    try {
      const projectDir = path.dirname(filePath);
      const versDir = path.join(projectDir, '.versions');
      
      if (!fs.existsSync(versDir)) {
        fs.mkdirSync(versDir);
      }
      
      const currentContent = fs.readFileSync(filePath, 'utf-8');
      const indexPath = path.join(versDir, 'index.json');
      let versions = [];
      if (fs.existsSync(indexPath)) {
        try {
          versions = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
          if (!Array.isArray(versions)) versions = [];
        } catch (e) { 
          console.error('Error reading or parsing index.json:', e);
          versions = [];
        }
      }
      
      if (versions.length > 0) {
        const lastVersion = versions[0];
        try {
          const lastVersionContent = fs.readFileSync(lastVersion.path, 'utf-8');
          if (lastVersionContent === currentContent) {
            console.log(`No changes detected in file ${filePath}, reusing last version ${lastVersion.version}`);
            return resolve({ 
              success: true, 
              versionPath: lastVersion.path, 
              version: lastVersion.version,
              noChanges: true 
            });
          }
        } catch (e) {
          console.error(`Error reading last version file ${lastVersion.path}:`, e);
        }
      }
      
      console.log(`Creating new backup for ${filePath}`);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${stamp}.ino`;
      const dest = path.join(versDir, filename);
      fs.copyFileSync(filePath, dest);

      const latestVersionNum = versions.reduce((max, v) => Math.max(max, v.version || 0), 0);
      const nextVersionNum = latestVersionNum + 1;

      const newVersionEntry = {
        version: nextVersionNum,
        filename: filename,
        timestamp: stamp,
        path: dest
      };
      versions.unshift(newVersionEntry);
      fs.writeFileSync(indexPath, JSON.stringify(versions, null, 2), 'utf-8');
      
      resolve({ success: true, versionPath: dest, version: nextVersionNum });
    } catch (e) {
      console.error(`Error in performSaveVersionLogic for ${filePath}:`, e);
      resolve({ success: false, error: e.message });
    }
  });
}

// Helper function to save a version checkpoint (wraps existing logic)
async function saveCheckpoint(projectPath) {
  const inoPath = getMainInoPath(projectPath);
  if (!inoPath || !fs.existsSync(inoPath)) {
    console.warn(`[saveCheckpoint] .ino file not found or invalid for project: ${projectPath}`);
    return null; 
  }
  try {
    console.log(`[saveCheckpoint] Calling performSaveVersionLogic for ${inoPath}`);
    const result = await performSaveVersionLogic(inoPath); // Call the refactored logic directly

    if (result.success) {
      console.log(`[saveCheckpoint] performSaveVersionLogic ${result.noChanges ? 'reused existing' : 'created new'} version: ${result.versionPath}`);
      return result.versionPath; 
    } else {
      console.error(`[saveCheckpoint] performSaveVersionLogic failed: ${result.error}`);
      return null;
    }
  } catch (e) {
    console.error(`[saveCheckpoint] Error in saveCheckpoint calling performSaveVersionLogic for ${inoPath}:`, e);
    return null;
  }
}

// Check if we've already registered the save-version handler
let saveVersionHandlerRegistered = false;

// Register the save-version handler only if not already registered
if (!saveVersionHandlerRegistered) {
  saveVersionHandlerRegistered = true; // Set flag before registration
  ipcMain.handle('save-version', async (event, filePath) => {
    console.log(`[IPC save-version] Handler called for ${filePath}`);
    const result = await performSaveVersionLogic(filePath); // Call the refactored logic
    // EMIT project-version-changed event HERE if successful
    if (result.success && mainWindow && mainWindow.webContents) {
        const projectDirForEvent = path.dirname(filePath);
        console.log(`[save-version -> performSaveVersionLogic] Emitting project-version-changed for project: ${projectDirForEvent}`);
        mainWindow.webContents.send('project-version-changed', projectDirForEvent);
    }
    return result;
  });
}

ipcMain.handle('list-versions', async (event, filePath) => {
  return new Promise((resolve) => {
    try {
      const projectDir = path.dirname(filePath);
      const versDir = path.join(projectDir, '.versions');
      const indexPath = path.join(versDir, 'index.json');

      if (!fs.existsSync(versDir)) {
        resolve({ success: true, versions: [] });
        return;
      }

      let versions = [];
      if (fs.existsSync(indexPath)) {
        // Read existing index
        try {
          versions = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
          if (!Array.isArray(versions)) versions = [];
        } catch (e) {
          console.error('Error reading or parsing index.json for list:', e);
          versions = []; // Trigger migration if index is corrupt
        }
      }

      if (versions.length === 0 || !versions[0].version) {
        // Migration needed (no index, empty index, or old format without version numbers)
        console.log('Migrating or creating index.json for:', versDir);
        const files = fs.readdirSync(versDir)
          .filter(f => f.endsWith('.ino'))
          .sort((a, b) => b.localeCompare(a)); // Sort filenames (timestamps) descending (newest first)
        
        versions = files.map((f, i) => ({
          filename: f,
          path: path.join(versDir, f),
          timestamp: f.replace('.ino', ''),
          version: files.length - i // Assign version numbers descending (newest = highest)
        }));
        
        // Write the newly created/migrated index
        fs.writeFileSync(indexPath, JSON.stringify(versions, null, 2), 'utf-8');
      }
      
      // Ensure sorting by version descending (highest first)
      versions.sort((a, b) => (b.version || 0) - (a.version || 0));

      resolve({ success: true, versions });
    } catch (e) {
      console.error('Error in list-versions:', e);
      resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('read-version', async (event, versionPath) => {
  return new Promise((resolve) => {
    try {
      const content = fs.readFileSync(versionPath, 'utf-8');
      resolve({ success: true, content });
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('delete-version', async (event, versionPath) => {
  return new Promise((resolve) => {
    try {
      // Delete the version file
      if (fs.existsSync(versionPath)) {
        fs.unlinkSync(versionPath);
      }
      // Update index.json if it exists
      const versDir = path.dirname(versionPath);
      const indexPath = path.join(versDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        let versions = [];
        try {
          versions = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
          if (!Array.isArray(versions)) versions = [];
        } catch (e) {
          console.error('Error reading or parsing index.json for delete:', e);
          // Don't proceed if index is corrupt, but file deletion might have succeeded
          resolve({ success: true }); // Resolve cautiously
          return;
        }
        
        // Remove the entry with matching path or filename
        const initialLength = versions.length;
        versions = versions.filter(v => v.path !== versionPath && v.filename !== path.basename(versionPath));
        
        // Only write back if something was actually removed
        if (versions.length < initialLength) {
          // DO NOT re-number versions
          fs.writeFileSync(indexPath, JSON.stringify(versions, null, 2), 'utf-8');
        }
      }
      resolve({ success: true });
    } catch (e) {
      console.error('Error in delete-version:', e);
      resolve({ success: false, error: e.message });
    }
  });
});

// --- Serial Port Handlers ---

// --- Track serial status for agent tool ---
let activeSerialPortInfoForAgent = { connected: false, port: null };
ipcMain.on('serial-status', (event, status) => {
    console.log('[Main Process Listener] Received serial-status for agent tool:', status);
    activeSerialPortInfoForAgent.connected = status.connected;
    activeSerialPortInfoForAgent.port = status.connected ? status.port : null;
});
// Handler for the agent tool to query the status
ipcMain.handle('get-serial-status', async () => {
  console.log('[IPC Handler] get-serial-status called');
  return activeSerialPortInfoForAgent;
});
// --- End agent tool status tracking ---

ipcMain.handle('list-serial-ports', async () => {
  try {
    const ports = await SerialPort.list();
    // Map to a simpler format for the frontend if desired, 
    // or return the full details. Let's keep it simple for now.
    const formattedPorts = ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer,
      friendlyName: p.friendlyName || p.path // Use path as fallback
    }));
    return { success: true, ports: formattedPorts };
  } catch (e) {
    console.error('Error listing serial ports:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('serial-connect', async (event, portPath, baudRate) => {
  // 1. Close existing connection if open
  if (activeSerialPort && activeSerialPort.isOpen) {
    try {
      await new Promise((resolve, reject) => {
        activeSerialPort.close((err) => {
          if (err) {
            console.error('Error closing previous serial port:', err);
            // Don't necessarily reject, try opening the new one anyway
          }
          resolve();
        });
      });
    } catch (e) {
      console.error('Exception closing previous port:', e);
    }
    activeSerialPort = null;
  }

  // 2. Create new SerialPort instance
  activeSerialPort = new SerialPort({
    path: portPath,
    baudRate: parseInt(baudRate) || 9600, // Default to 9600 if invalid
    autoOpen: false, 
  });

  // 3. Attach event listeners
  activeSerialPort.on('open', () => {
    console.log('Serial port opened:', portPath);
    if (mainWindow) {
      mainWindow.webContents.send('serial-status', { connected: true, port: portPath });
    }
  });

  activeSerialPort.on('data', (data) => {
    // Forward data to the renderer process
    if (mainWindow) {
      mainWindow.webContents.send('serial-data', data.toString());
    }
  });

  activeSerialPort.on('close', () => {
    console.log('Serial port closed:', portPath);
    if (mainWindow) {
      mainWindow.webContents.send('serial-status', { connected: false, port: portPath, message: 'Port closed.' });
    }
    // Clean up reference if closed externally or after an error
    if (activeSerialPort && activeSerialPort.path === portPath) {
        activeSerialPort = null;
    }
  });

  activeSerialPort.on('error', (err) => {
    console.error('Serial port error:', portPath, err);
    if (mainWindow) {
      mainWindow.webContents.send('serial-status', { connected: false, port: portPath, error: err.message });
    }
    // Clean up reference on error
    if (activeSerialPort && activeSerialPort.path === portPath) {
        activeSerialPort.close(); // Attempt to close if not already
        activeSerialPort = null;
    }
  });

  // 4. Open the port
  return new Promise((resolve) => {
    activeSerialPort.open((err) => {
      if (err) {
        console.error('Error opening serial port:', portPath, err);
        if (mainWindow) {
          mainWindow.webContents.send('serial-status', { connected: false, port: portPath, error: `Failed to open port: ${err.message}` });
        }
        activeSerialPort = null; // Ensure cleanup if open fails
        resolve({ success: false, error: `Failed to open port: ${err.message}` });
      } else {
        // Success case is handled by the 'open' event listener sending serial-status
        resolve({ success: true }); 
      }
    });
  });
});

ipcMain.handle('serial-disconnect', async () => {
  if (!activeSerialPort) {
    return { success: true }; // Already disconnected
  }

  return new Promise((resolve) => {
    if (activeSerialPort.isOpen) {
      activeSerialPort.close((err) => {
        if (err) {
          console.error('Error closing serial port:', err);
          // Still set to null, but report error
          activeSerialPort = null;
          resolve({ success: false, error: err.message });
        } else {
          console.log('Serial port disconnected successfully.');
          activeSerialPort = null;
          resolve({ success: true });
        }
      });
    } else {
      // Port object exists but wasn't open, just clean up
      activeSerialPort = null;
      resolve({ success: true });
    }
  });
});

ipcMain.handle('serial-send', async (event, data) => {
  if (activeSerialPort && activeSerialPort.isOpen) {
    return new Promise((resolve) => {
      // Append newline by default. Could be made configurable later.
      activeSerialPort.write(data + '\n', (err) => {
        if (err) {
          console.error('Error writing to serial port:', err);
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  } else {
    return { success: false, error: 'Serial port not connected.' };
  }
});

// --- End Serial Port Handlers --- 

// === Agent Tools & LangGraph Agent Setup ===
// const agentTools = require('./src/main/agent-tools');

// Patched require for agent-tools to work in development and packaged app
let agentTools;
try {
  // In packaged app, 'src' might not be part of the path as expected
  agentTools = require('./agent-tools');
} catch (e) {
  // Fallback for development or if './agent-tools' isn't found
  agentTools = require('./src/main/agent-tools');
}

// === Custom Streaming Graph Scaffold (for migration) ===
// Use Zod for state schema
const streamingStateSchema = z.object({
  messages: z.array(z.any()), // Array of chat messages
  // Add more fields as needed (e.g., projectPath, custom rules)
});

// Create a new StateGraph instance with Zod schema
const streamingGraph = new StateGraph(streamingStateSchema);

// Add a node for LLM responses (simplified for Google GenAI)
// Note: We're not using true streaming as it's not supported in the current version
streamingGraph.addNode(
  'llm',
  async function* (state) {
    try {
      console.log("Processing messages with non-streaming approach");
      const response = await chatModel.invoke(state.messages);
      console.log("Response received from model");
      
      // Return the full response as a single chunk
      yield { output: response.content };
    } catch (err) {
      console.error("Error processing messages:", err);
      throw err;
    }
  },
  { end: true }
);

streamingGraph.addEdge("__start__", "llm");

// Compile the graph into an executor, specifying the entry node
const streamingAgent = streamingGraph.compile({ entry: 'llm' });

console.log("StreamingAgent configured (using non-streaming implementation)");
console.log("StreamingAgent keys:", Object.keys(streamingAgent));

// --- Helper Functions for Chat History ---

const CHAT_DIR_NAME = '.embedr_chat';

function getProjectChatDir(projectPath) {
  if (!projectPath) {
    console.error('getProjectChatDir: projectPath is required');
    return null; // Or throw an error
  }
  return path.join(projectPath, CHAT_DIR_NAME);
}

function loadChatHistory(projectPath, threadId) {
  const chatDir = getProjectChatDir(projectPath);
  if (!chatDir || !threadId) return [];
  const chatFilePath = path.join(chatDir, `${threadId}.json`);
  if (!fs.existsSync(chatFilePath)) return [];
  try {
    const data = fs.readFileSync(chatFilePath, 'utf-8');
    const messages = JSON.parse(data);
    return Array.isArray(messages) ? messages : []; // Ensure it's an array
  } catch (err) {
    console.error(`Error reading or parsing chat history ${chatFilePath}:`, err);
    return []; // Return empty on error
  }
}

// Helper: Filter tool messages for OpenAI protocol compliance
function filterValidToolMessages(messages) {
  const filtered = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'tool') {
      // Only allow if previous message is assistant with tool_calls and tool_call_id matches
      const prev = filtered[filtered.length - 1];
      if (
        prev &&
        prev.role === 'assistant' &&
        Array.isArray(prev.tool_calls) &&
        prev.tool_calls.some(tc => tc.id === msg.tool_call_id)
      ) {
        filtered.push(msg);
      }
      // else skip this tool message
    } else {
      filtered.push(msg);
    }
  }
  return filtered;
}

// Patch saveChatHistory to filter tool messages before saving
function saveChatHistory(projectPath, threadId, messages) {
  const chatDir = getProjectChatDir(projectPath);
  if (!chatDir || !threadId) return;
  try {
    // Ensure the chat directory exists
    if (!fs.existsSync(chatDir)) {
      fs.mkdirSync(chatDir, { recursive: true });
    }
    const chatFilePath = path.join(chatDir, `${threadId}.json`);
    const fullChatFilePath = path.join(chatDir, `${threadId}.full.json`);
    // Only save valid tool messages for protocol compliance
    const filteredMessages = filterValidToolMessages(messages);
    fs.writeFileSync(chatFilePath, JSON.stringify(filteredMessages, null, 2), 'utf-8');
    // Also save the full, unfiltered history for UI display
    fs.writeFileSync(fullChatFilePath, JSON.stringify(messages, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saving chat history ${projectPath}/${threadId}:`, err);
  }
}

function listChatThreads(projectPath) {
  const chatDir = getProjectChatDir(projectPath);
  if (!chatDir || !fs.existsSync(chatDir)) return [];
  try {
    const files = fs.readdirSync(chatDir);
    // Only include .json files that are NOT .full.json
    return files
      .filter(file => file.endsWith('.json') && !file.endsWith('.full.json'))
      .map(file => file.replace('.json', ''));
  } catch (err) {
    console.error(`Error listing chat threads in ${chatDir}:`, err);
    return [];
  }
}

function deleteChatThread(projectPath, threadId) {
  const chatDir = getProjectChatDir(projectPath);
  if (!chatDir || !threadId) return false;
  const chatFilePath = path.join(chatDir, `${threadId}.json`);
  const fullChatFilePath = path.join(chatDir, `${threadId}.full.json`);
  let success = true;
  try {
    if (fs.existsSync(chatFilePath)) {
      fs.unlinkSync(chatFilePath);
    }
  } catch (err) {
    console.error(`Error deleting chat thread ${chatFilePath}:`, err);
    success = false;
  }
  try {
    if (fs.existsSync(fullChatFilePath)) {
      fs.unlinkSync(fullChatFilePath);
    }
  } catch (err) {
    console.error(`Error deleting full chat thread ${fullChatFilePath}:`, err);
    success = false;
  }
  return success;
}

// Load the full, unfiltered chat history for UI display
function loadFullChatHistory(projectPath, threadId) {
  const chatDir = getProjectChatDir(projectPath);
  if (!chatDir || !threadId) return [];
  const fullChatFilePath = path.join(chatDir, `${threadId}.full.json`);
  if (!fs.existsSync(fullChatFilePath)) return [];
  try {
    const data = fs.readFileSync(fullChatFilePath, 'utf-8');
    const messages = JSON.parse(data);
    return Array.isArray(messages) ? messages : [];
  } catch (err) {
    console.error(`Error reading or parsing full chat history ${fullChatFilePath}:`, err);
    return [];
  }
}

// IPC handler to get the full, unfiltered chat history for UI
ipcMain.handle('get-full-chat-history', async (event, projectPath, threadId) => {
  try {
    const messages = loadFullChatHistory(projectPath, threadId);
    return { success: true, messages };
  } catch (err) {
    console.error('Error getting full chat history:', err);
    return { success: false, error: err.message || 'Failed to load full chat history' };
  }
});

// --- End Chat History Helpers ---

// Agent state schema (basic)
const agentStateSchema = {
  messages: [], // Array of chat messages
  // Add more fields as needed (e.g., projectPath, custom rules)
};

// Read system prompt from file
// const systemPrompt = fs.readFileSync(path.join(APP_ROOT, 'systemprompt.md'), 'utf-8');
let systemPrompt;
if (app.isPackaged) {
  systemPrompt = fs.readFileSync(path.join(process.resourcesPath, 'systemprompt.md'), 'utf-8');
} else {
  systemPrompt = fs.readFileSync(path.join(APP_ROOT, 'systemprompt.md'), 'utf-8');
}

// === Global AbortController for the current stream ===
let currentStreamAbortController = null; 

// === Helper function to get the correct chat model ===
// async function getChatModel(provider, modelName, authToken, options = {}) { // Original guide signature
async function getChatModel(provider, modelName, authToken, options = {}) {
  // Get the base URL for the Cloud Function
  const cloudFunctionBaseUrl = isDev 
    ? `http://127.0.0.1:5001/emdedr-822d0/us-central1/llmProxy`
    : `https://llmproxy-7ya4qwdxyq-uc.a.run.app`;
  
  console.log(`[getChatModel] Called with provider: ${provider}, model: ${modelName}`);
  console.log(`[getChatModel] Using cloud function base URL: ${cloudFunctionBaseUrl}`);
  
  if (!authToken) {
    console.warn('[getChatModel] No auth token provided.');
    throw new Error('Authentication required for getChatModel.');
  }
  
  const dynamicHeaders = {
    'Authorization': `Bearer ${authToken}`,
  };
  
  console.log(`[getChatModel] Creating ${provider} model with auth token (length: ${authToken.length})`);
  
  // Base config for all models, including streaming and proxy key
  const baseModelConfig = {
    maxOutputTokens: options.maxTokens || 2048,
    streaming: true,
    apiKey: "DUMMY_KEY_NOT_USED", // Dummy API key for proxied requests
    maxRetries: 0, // Prevent LLM client from retrying on errors like 429
  };

  // Determine temperature based on model and options
  let temperature;
  if (modelName === 'o4-mini') {
    if (options.temperature !== undefined && options.temperature !== 1 && options.temperature !== 1.0) {
      console.warn(`[getChatModel] Model 'o4-mini' only supports temperature 1.0. Ignoring provided value: ${options.temperature}`);
    }
    temperature = 1.0;
  } else {
    temperature = options.temperature !== undefined ? options.temperature : 0.7;
  }

  // Combine base config with temperature
  const finalModelConfig = {
    ...baseModelConfig,
    temperature,
  };
  
  let chatModelInstance;
  
  if (provider === 'openai') {
    console.log(`[getChatModel] Initializing OpenAI model: ${modelName}`);
    chatModelInstance = new ChatOpenAI({
      ...finalModelConfig,
      modelName: modelName || 'gpt-4.1', // Default OpenAI model
      configuration: {
        baseURL: `${cloudFunctionBaseUrl}/openai/v1`,
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[getChatModel] ChatOpenAI instance created for OpenAI provider via proxy.');
  } else if (provider === 'anthropic') {
    console.log(`[getChatModel] Initializing Anthropic model: ${modelName}`);
    chatModelInstance = new ChatAnthropic({
      ...finalModelConfig,
      modelName: modelName || 'claude-3-7-sonnet-latest', // Default Anthropic model
      clientOptions: { // For Anthropic, proxy config is under clientOptions
        baseURL: `${cloudFunctionBaseUrl}/anthropic`,
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[getChatModel] ChatAnthropic instance created for Anthropic provider via proxy.');
  } else if (provider === 'google') {
    console.log(`[getChatModel] Initializing Google Gemini model (${modelName}) via ChatOpenAI to proxy's OpenAI endpoint.`);
    chatModelInstance = new ChatOpenAI({ // Using ChatOpenAI for Gemini via our proxy's OpenAI endpoint
      ...finalModelConfig,
      modelName: modelName || 'gemini-1.5-pro-latest', // Pass the actual Gemini model name
      configuration: {
        baseURL: `${cloudFunctionBaseUrl}/openai/v1`, // Point to the OpenAI path in our proxy
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[getChatModel] ChatOpenAI instance created for Google Gemini provider via proxy\'s OpenAI endpoint.');
  } else if (modelName === 'gemini-2.5-flash-preview-05-20') {
    // Handle Gemini Flash model specifically (without requiring 'google' provider)
    console.log(`[getChatModel] Initializing Gemini 2.5 Flash model via ChatOpenAI to proxy's OpenAI endpoint.`);
    chatModelInstance = new ChatOpenAI({
      ...finalModelConfig,
      modelName: 'gemini-2.5-flash-preview-05-20',
      configuration: {
        baseURL: `${cloudFunctionBaseUrl}/openai/v1`, // Point to the OpenAI path in our proxy
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[getChatModel] ChatOpenAI instance created for Gemini 2.5 Flash via proxy\'s OpenAI endpoint.');
  } else if (provider === 'groq') {
    console.log(`[getChatModel] Initializing Groq model: ${modelName}`);
    chatModelInstance = new ChatOpenAI({ // Groq uses OpenAI compatible API
      ...finalModelConfig,
      modelName: modelName || 'llama3-70b-8192', // Default Groq model
      configuration: {
        baseURL: `${cloudFunctionBaseUrl}/groq`,
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[getChatModel] ChatOpenAI instance created for Groq provider via proxy.');
  } else {
    console.error(`[getChatModel] Unsupported provider: ${provider}`);
    throw new Error(`Unsupported provider: ${provider}`);
  }
  
  return chatModelInstance;
}

// === Project Management ===

// Helper function to get the main .ino file path for a project
function getMainInoPath(projectPath) {
  if (!projectPath) return null;
  const projectName = path.basename(projectPath);
  const potentialPath = path.join(projectPath, `${projectName}.ino`);
  // Check if the derived path exists before returning
  if (fs.existsSync(potentialPath)) {
    return potentialPath;
  }
  // Fallback: Look for the first .ino file if the standard one doesn't exist
  try {
    const files = fs.readdirSync(projectPath);
    const firstIno = files.find(file => file.endsWith('.ino'));
    if (firstIno) {
      console.warn(`getMainInoPath: Could not find standard ${projectName}.ino, using ${firstIno} as fallback.`);
      return path.join(projectPath, firstIno);
    }
  } catch (err) {
    console.error(`getMainInoPath: Error reading project directory ${projectPath}:`, err);
  }
  console.error(`getMainInoPath: Could not find any .ino file in ${projectPath}.`);
  return null;
}

// === Checkpoint Management ===

// Helper function to save a version checkpoint (wraps existing logic)
async function saveCheckpoint(projectPath) {
  const inoPath = getMainInoPath(projectPath);
  if (!inoPath || !fs.existsSync(inoPath)) {
    console.warn(`[saveCheckpoint] .ino file not found or invalid for project: ${projectPath}`);
    return null; 
  }
  try {
    console.log(`[saveCheckpoint] Calling performSaveVersionLogic for ${inoPath}`);
    const result = await performSaveVersionLogic(inoPath); // Call the refactored logic directly

    if (result.success) {
      console.log(`[saveCheckpoint] performSaveVersionLogic ${result.noChanges ? 'reused existing' : 'created new'} version: ${result.versionPath}`);
      return result.versionPath; 
    } else {
      console.error(`[saveCheckpoint] performSaveVersionLogic failed: ${result.error}`);
      return null;
    }
  } catch (e) {
    console.error(`[saveCheckpoint] Error in saveCheckpoint calling performSaveVersionLogic for ${inoPath}:`, e);
    return null;
  }
}

// === Chat Management IPC Handlers ===

ipcMain.handle('list-project-chats', async (event, projectPath) => {
  try {
    const threads = listChatThreads(projectPath);
    return { success: true, threads };
  } catch (err) {
    console.error('Error listing project chats:', err);
    return { success: false, error: err.message || 'Failed to list chats' };
  }
});

ipcMain.handle('get-chat-history', async (event, projectPath, threadId) => {
  try {
    const messages = loadChatHistory(projectPath, threadId);
    return { success: true, messages };
  } catch (err) {
    console.error('Error getting chat history:', err);
    return { success: false, error: err.message || 'Failed to load chat history' };
  }
});

ipcMain.handle('delete-project-chat', async (event, projectPath, threadId) => {
  try {
    const success = deleteChatThread(projectPath, threadId);
    return { success };
  } catch (err) {
    console.error('Error deleting project chat:', err);
    return { success: false, error: err.message || 'Failed to delete chat' };
  }
});

// === NEW Restore Checkpoint Handler ===
ipcMain.handle('restore-checkpoint', async (event, projectPath, checkpointPath) => {
  console.log('[restore-checkpoint] Handler called');
  console.log('  projectPath:', projectPath);
  console.log('  checkpointPath:', checkpointPath);

  const mainInoPath = getMainInoPath(projectPath);
  if (!mainInoPath) {
    return { success: false, error: 'Could not determine main .ino file path.' };
  }
  if (!checkpointPath || !fs.existsSync(checkpointPath)) {
    return { success: false, error: 'Invalid or non-existent checkpoint path.' };
  }

  try {
    // 1. Read content from checkpoint file
    console.log(`  Reading checkpoint: ${checkpointPath}`);
    const restoredContent = fs.readFileSync(checkpointPath, 'utf-8');

    // 2. Write content to main .ino file
    console.log(`  Writing restored content to: ${mainInoPath}`);
    fs.writeFileSync(mainInoPath, restoredContent, 'utf-8');

    console.log('  Checkpoint restored successfully.');
    return { success: true, restoredContent };
  } catch (err) {
    console.error('Error during restore-checkpoint:', err);
    return { success: false, error: err.message || 'Failed to restore checkpoint.' };
  }
}); 

// === Handlers for User Selection (NEW - to be called from renderer) ===
ipcMain.handle('set-selected-board', (event, fqbn) => {
  console.log(`[IPC Handler] set-selected-board called with FQBN: ${fqbn}`);
  currentSelectedBoardFqbn = fqbn;
  
  // Emit event to UI when board is set by agent
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('board-selected-by-agent', fqbn);
    console.log(`[IPC Handler] Sent board-selected-by-agent event to renderer with FQBN: ${fqbn}`);
  }
  
  return { success: true };
});

ipcMain.handle('set-selected-port', (event, portPath) => {
  console.log(`[IPC Handler] set-selected-port called with Port: ${portPath}`);
  currentSelectedPortPath = portPath;
  
  // Emit event to UI when port is set by agent
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('port-selected-by-agent', portPath);
    console.log(`[IPC Handler] Sent port-selected-by-agent event to renderer with port: ${portPath}`);
  }
  
  return { success: true };
});
// === END Handlers for User Selection ===

// === Handlers for Agent Selection ===

ipcMain.handle('handle-select-board', async (event, fqbn) => {
  console.log(`[IPC Handler] handle-select-board called by Agent with FQBN: ${fqbn}`);
  currentSelectedBoardFqbn = fqbn; // Update central state
  
  // Clear board options when board changes and reset to appropriate defaults
  console.log(`[IPC Handler] Clearing board options for board change to: ${fqbn}`);
  currentSelectedBoardOptions = {};
  
  // Detailed check before sending event
  if (mainWindow) {
    console.log(`[IPC Handler] mainWindow found. Is destroyed? ${mainWindow.isDestroyed()}`);
    if (mainWindow.webContents) {
      console.log(`[IPC Handler] mainWindow.webContents found. Is destroyed? ${mainWindow.webContents.isDestroyed()}`);
      try {
        mainWindow.webContents.send('board-selected-by-agent', fqbn);
        console.log(`[IPC Handler] Successfully called webContents.send('board-selected-by-agent', "${fqbn}")`);
        
        // Also send board options reset event to UI
        mainWindow.webContents.send('board-options-selected-by-agent', {});
        console.log(`[IPC Handler] Sent board-options-selected-by-agent event to reset options for new board`);
        
        return { success: true };
      } catch (sendError) {
        console.error(`[IPC Handler] Error calling webContents.send:`, sendError);
        return { success: false, error: `Failed to send event to renderer: ${sendError.message}` };
      }
    } else {
      console.warn('[IPC Handler] mainWindow.webContents NOT found!');
      return { success: false, error: 'UI webContents not available.' };
    }
  } else {
    console.warn('[IPC Handler] mainWindow NOT found!');
    return { success: false, error: 'UI window not available.' };
  }
});

ipcMain.handle('handle-select-port', async (event, portPath) => {
  console.log(`[IPC Handler] handle-select-port called by Agent with Port Path: ${portPath}`);
  currentSelectedPortPath = portPath; // Update central state
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('port-selected-by-agent', portPath);
    console.log('  Sent port-selected-by-agent event to renderer.');
    return { success: true };
  } else {
    console.warn('  mainWindow or webContents not available to send port selection event.');
    return { success: false, error: 'UI window not available.' };
  }
});

// === END Handlers for Agent Selection ===

// --- Helper: Transform tool messages for LangChain compatibility ---
function transformMessagesForLangChain(messages) {
  return messages.map((msg, idx) => {
    if (msg.role === 'tool') {
      // If already in correct format, return as is
      if (msg.type === 'tool' && msg.tool_call_id && typeof msg.content === 'string') {
        return msg;
      }
      // Compose tool_call_id (use toolId, or fallback to idx)
      const tool_call_id = msg.tool_call_id || msg.toolId || `${msg.toolName || 'tool'}-${idx}`;
      // For toolPhase 'end', use toolOutput as content; for 'start', use content or empty string
      let content = '';
      if (msg.toolPhase === 'end' && msg.toolOutput !== undefined) {
        if (typeof msg.toolOutput === 'string') {
          content = msg.toolOutput;
        } else {
          try { content = JSON.stringify(msg.toolOutput); } catch { content = String(msg.toolOutput); }
        }
      } else if (typeof msg.content === 'string') {
        content = msg.content;
      }
      return {
        ...msg,
        type: 'tool',
        tool_call_id,
        content,
      };
    }
    return msg;
  });
}

// === Helper function to prepare context for the agent ===
function prepareAgentContext(messages, projectPath, checkpointPath) {
  let sketchPath = getMainInoPath(projectPath);
  let sketchContent = '';
  try {
    if (checkpointPath && fs.existsSync(checkpointPath)) {
      sketchContent = fs.readFileSync(checkpointPath, 'utf-8');
      console.log(`  Read sketch content (${sketchContent.length} chars) from checkpoint: ${checkpointPath}`);
    } else if (sketchPath && fs.existsSync(sketchPath)) {
      console.warn(`  Checkpoint path invalid or not found (${checkpointPath}). Reading main sketch file as fallback.`);
      sketchContent = fs.readFileSync(sketchPath, 'utf-8');
      console.log(`  Read sketch content (${sketchContent.length} chars) from main file: ${sketchPath}`);
    } else {
      console.warn(`  Could not find or read sketch file at: ${sketchPath || 'main path not determined'}`);
      sketchContent = '// Unable to read sketch file content.';
    }
  } catch (readErr) {
    console.error(`  Error reading sketch/checkpoint file:`, readErr);
    sketchContent = `// Error reading sketch file: ${readErr.message}`;
  }

  // Construct the FULL FQBN using central state
  const fullFqbnForAgent = constructFullFqbn(currentSelectedBoardFqbn, currentSelectedBoardOptions);
  
  // Create a shallow copy to modify for the agent
  const messagesForAgent = [...messages];
  if (messagesForAgent.length > 0) {
    const lastMessageIndex = messagesForAgent.length - 1;
    const lastUserMessage = messagesForAgent[lastMessageIndex];
    
    if (lastUserMessage.role === 'user') { 
      let contextString = `CONTEXT:\n`;
      contextString += `- Project Path: ${projectPath}\n`;
      contextString += `- Sketch Path: ${sketchPath || 'Not Found'}\n`;
      if (fullFqbnForAgent) {
          contextString += `- Selected Board FQBN (with options): ${fullFqbnForAgent}\n`;
      } else if (currentSelectedBoardFqbn) {
           contextString += `- Selected Board FQBN (base): ${currentSelectedBoardFqbn}\n`; // Fallback
      }
      if (currentSelectedPortPath) {
          contextString += `- Selected Port: ${currentSelectedPortPath}\n`;
      }
      contextString += `- Current Sketch Content:\n\"\"\"cpp\n${sketchContent}\n\"\"\"\n\nUSER QUERY:\n`;

      // Check if the last user message content is an array (multi-modal)
      if (Array.isArray(lastUserMessage.content)) {
        // Find the text part and prepend the context there
        const textPartIndex = lastUserMessage.content.findIndex(part => part.type === 'text');
        if (textPartIndex !== -1) {
          messagesForAgent[lastMessageIndex].content[textPartIndex].text = contextString + lastUserMessage.content[textPartIndex].text;
          console.log(`  Prepended context to text part of multi-modal user message.`);
        } else {
          // If no text part exists (e.g., image only), add context as a new text part at the beginning
          messagesForAgent[lastMessageIndex].content.unshift({ type: 'text', text: contextString });
           console.log(`  Prepended context as new text part to multi-modal user message.`);
        }
      } else if (typeof lastUserMessage.content === 'string') {
        // Original behavior for text-only messages
        messagesForAgent[lastMessageIndex] = {
          ...lastUserMessage,
          content: contextString + lastUserMessage.content
        };
        console.log(`  Prepended context to standard user message content.`);
      } else {
         console.warn('  Last user message content is neither string nor array, context not prepended.');
      }
    } else {
        console.warn('  Last message in history was not the user message, context not prepended.');
    }
  } else {
      console.warn('  Message history is empty, cannot prepend context.');
  }
  return messagesForAgent;
} 

// IPC handler for copilot chat messages (non-streaming - updated to accept model)
ipcMain.handle('copilot-chat-message', async (event, userInput, threadId, projectPath, selectedBoardFqbn, selectedPortPath, selectedModel) => {
  // Store initial selections from UI if needed, or rely on set-selected-* handlers having been called
  if (selectedBoardFqbn && !currentSelectedBoardFqbn) currentSelectedBoardFqbn = selectedBoardFqbn;
  if (selectedPortPath && !currentSelectedPortPath) currentSelectedPortPath = selectedPortPath;

  console.log('[copilot-chat-message] Handler called');
  // Log current state *before* preparing context
  console.log('  Current state for context:', { threadId, projectPath, currentSelectedBoardFqbn, currentSelectedPortPath, selectedModel });

  // --- Save Checkpoint --- 
  const checkpointPath = await saveCheckpoint(projectPath);
  // ----------------------

  let messages = loadChatHistory(projectPath, threadId) || [];
  const userMessage = { role: 'user', content: userInput };
  if (checkpointPath) userMessage.checkpointPath = checkpointPath;
  messages.push(userMessage);

  // --- DEBUG: Log messages before transformation ---
  console.log('[copilot-chat-message] Raw messages before transform:', JSON.stringify(messages, null, 2));
  // --- Transform tool messages for LangChain ---
  const transformedMessages = transformMessagesForLangChain(messages);
  // --- DEBUG: Log messages after transformation ---
  console.log('[copilot-chat-message] Messages for LangChain:', JSON.stringify(transformedMessages, null, 2));

  let aiResponse = 'Error: Invocation failed.';
  try {
    const chatModel = getChatModel(selectedModel); // Get the selected model
    const agent = createReactAgent({ // Create agent dynamically
      llm: chatModel,
      tools: agentTools,
      prompt: systemPrompt,
    });

    const messagesForAgent = prepareAgentContext(transformedMessages, projectPath, checkpointPath);
    const result = await agent.invoke({ messages: messagesForAgent });
    
    let responseContent = 'Error: Could not parse response.';
    if (result?.output || result?.content) {
      responseContent = result.output || result.content;
    } else if (Array.isArray(result?.messages) && result.messages.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      if (lastMessage?.content && typeof lastMessage.content === 'string') {
        responseContent = lastMessage.content;
      }
    }
    aiResponse = responseContent;
    
    messages.push({ role: 'assistant', content: aiResponse });
    saveChatHistory(projectPath, threadId, messages);
    console.log('  Saved updated chat history.');
  } catch (err) {
    console.error('  Error during agent invocation:', err);
    aiResponse = 'Error: ' + (err.message || err.toString());
    messages.push({ role: 'assistant', content: aiResponse }); // Save error message
    saveChatHistory(projectPath, threadId, messages);
  }

  console.log('  Returning response:', aiResponse);
  console.log('[copilot-chat-message] Handler complete');
  return { role: 'assistant', content: aiResponse };
});

// IPC handler for copilot chat messages (streaming - REFACTORED with streamEvents v2)
ipcMain.on('copilot-chat-message-stream', async (event, userInput, threadId, projectPath, selectedBoardFqbn, selectedPortPath, selectedModel, imageDataUrl) => { // Added imageDataUrl
  // Store initial selections from UI if needed, or rely on set-selected-* handlers having been called
  if (selectedBoardFqbn && !currentSelectedBoardFqbn) currentSelectedBoardFqbn = selectedBoardFqbn;
  if (selectedPortPath && !currentSelectedPortPath) currentSelectedPortPath = selectedPortPath;

  // Ensure currentSelectedBoardFqbn and currentSelectedPortPath are updated with values for THIS call
  currentSelectedBoardFqbn = selectedBoardFqbn;
  currentSelectedPortPath = selectedPortPath;

  console.log('[copilot-chat-message-stream] Handler called');
  // Log current state *before* preparing context
  console.log('  Current state for context:', { threadId, projectPath, currentSelectedBoardFqbn, currentSelectedPortPath, selectedModel, hasImageData: !!imageDataUrl }); // Log if image data is present

  // Ensure any previous stream is aborted (safety net)
  if (currentStreamAbortController) {
    console.warn('[copilot-chat-message-stream] Found existing AbortController, aborting previous stream...');
    currentStreamAbortController.abort();
    currentStreamAbortController = null;
  }
  // Create a new AbortController for this stream
  const controller = new AbortController();
  currentStreamAbortController = controller; // Store it globally

  const checkpointPath = await saveCheckpoint(projectPath); // Save checkpoint first
  
  // *** Load BOTH full and filtered history ***
  let initialFullMessages = loadFullChatHistory(projectPath, threadId) || []; 
  let initialFilteredMessages = loadChatHistory(projectPath, threadId) || []; 
  console.log(`  Loaded ${initialFullMessages.length} messages from FULL history`);
  console.log(`  Loaded ${initialFilteredMessages.length} messages from FILTERED history`);
  
  // --- DEBUG: Log messages before transformation ---
  console.log('[copilot-chat-message-stream] Raw FULL messages before transform:', JSON.stringify(initialFullMessages, null, 2));
  // --- Transform filtered messages for LangChain --- 
  const transformedMessagesForAgent = transformMessagesForLangChain(initialFilteredMessages);
  // --- DEBUG: Log messages after transformation --- 
  console.log('[copilot-chat-message-stream] FILTERED Messages for LangChain:', JSON.stringify(transformedMessagesForAgent, null, 2));

  // --- Construct User Message (potentially multi-modal) ---
  let userMessageContent;
  if (imageDataUrl) {
    console.log('  Constructing multi-modal user message content.');
    userMessageContent = [
      { type: 'text', text: userInput || "" }, // Include empty text if only image sent
      { type: 'image_url', image_url: { url: imageDataUrl } }
    ];
  } else {
    userMessageContent = userInput;
  }

  const userMessage = { role: 'user', content: userMessageContent };
  // ---------------------------------------------------------

  if (checkpointPath) userMessage.checkpointPath = checkpointPath;

  // Keep track of messages added during THIS stream run
  let currentRunMessages = [userMessage]; 
  let accumulatedTextContent = '';
  let finalAssistantMessageContent = null;
  let streamError = null;
  
  try {
    // Get Firebase auth token for the API request
    let authToken = cachedAuthToken;
    
    if (!authToken) {
      console.warn('[copilot-chat-message-stream] No cached auth token available, requesting from renderer via existing mechanism...');
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('request-auth-token');
        // Poll for the token to be set by the renderer via 'set-firebase-auth-token'
        let attempts = 0;
        const maxAttempts = 10; // Wait for 5 seconds (10 * 500ms)
        while (!cachedAuthToken && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
          authToken = cachedAuthToken; // Check if token was set by the renderer
          attempts++;
        }

        if (!authToken) {
          console.error('[copilot-chat-message-stream] Failed to get auth token after waiting.');
          event.sender.send('copilot-chat-stream', { 
            type: 'error', 
            error: 'Authentication timed out. Please sign in again and retry.' 
          });
          if (controller.signal.aborted) {
              console.log('[copilot-chat-message-stream] Stream was cancelled during auth token fetch.');
          } else {
              currentRunMessages.push({ role: 'system', content: 'Authentication token missing / timed out.' });
              const finalMessagesToSave = [...initialFullMessages, ...currentRunMessages];
              saveChatHistory(projectPath, threadId, finalMessagesToSave);
          }
          currentStreamAbortController = null; 
          return;
        }
        console.log('[copilot-chat-message-stream] Auth token obtained after request.');
      } else {
         console.error('[copilot-chat-message-stream] Main window not available to request token.');
         event.sender.send('copilot-chat-stream', { type: 'error', error: 'Internal error: Cannot request auth token.' });
         currentRunMessages.push({ role: 'system', content: 'Internal error: Cannot request auth token.' });
         const finalMessagesToSave = [...initialFullMessages, ...currentRunMessages];
         saveChatHistory(projectPath, threadId, finalMessagesToSave);
         currentStreamAbortController = null;
         return;
      }
    }

    console.log('[DEBUG] Auth token available, length:', authToken ? authToken.length : 'N/A');
    
    // Extract provider name from model name
    let provider = 'google'; // Default provider
    if (selectedModel) {
      console.log('[DEBUG] Determining provider from model name:', selectedModel);
      if (selectedModel.startsWith('gpt-') || selectedModel.startsWith('o4-')) {
        provider = 'openai';
      } else if (selectedModel.startsWith('claude-')) {
        provider = 'anthropic';
      } else if (selectedModel.startsWith('gemini-')) {
        provider = 'google';
      } else if (
        selectedModel.startsWith('llama') || 
        selectedModel.startsWith('deepseek-r1-distill-llama') || 
        selectedModel.startsWith('meta-llama/llama-4-maverick') || 
        selectedModel.startsWith('qwen-qwq')
      ) {
        provider = 'groq';
      }
      console.log('[DEBUG] Provider determined as:', provider);
    }
    
    // Get the model with auth token
    console.log('[DEBUG] Calling getChatModel...');
    const proxiedChatModel = await getChatModel(provider, selectedModel, authToken);
    
    console.log(`  Initializing model ${selectedModel} for streaming...`);
    // const chatModel = getChatModel(selectedModel); // Get the selected model dynamically // OLD LINE

    // Create agent dynamically with the selected model
    const agent = createReactAgent({
      llm: proxiedChatModel, // USE THE PROXIED MODEL
      tools: agentTools,
      prompt: systemPrompt,
    });
    console.log('  Agent created dynamically.');

    // Prepare context using central state - Pass the new userMessage object
    // Use [...transformedMessagesForAgent, userMessage] to include the latest user input
    const messagesForAgent = prepareAgentContext([...transformedMessagesForAgent, userMessage], projectPath, checkpointPath);
    console.log('  Prepared messages for agent using filtered history and central state.');
    console.log('[copilot-chat-message-stream] Messages being sent to agent.streamEvents:', JSON.stringify(messagesForAgent, null, 2));

    console.log('  Starting agent streamEvents (v2)...');
    // Use streamEvents with v2 schema AND the AbortSignal
    const stream = await agent.streamEvents(
      { messages: messagesForAgent }, 
      { version: "v2", signal: controller.signal } // Pass the signal
    ); 

    // Map to track toolId by toolName for this run
    let toolIdMap = {};

    for await (const streamEvent of stream) {
        //console.log("[Agent StreamEvent]:", JSON.stringify(streamEvent, null, 2)); // DEBUG
        
        // Check for abort signal early in the loop
        if (controller.signal.aborted) {
          console.log('[Agent Stream] Abort signal detected, breaking loop.');
          streamError = new Error('Stream cancelled by user.'); 
          break; // Exit the loop
        }

        const eventType = streamEvent.event;
        const eventName = streamEvent.name;
        const eventData = streamEvent.data;

        if (eventType === 'on_chat_model_stream') {
            const chunk = eventData?.chunk;
            if (chunk?.content && typeof chunk.content === 'string') {
                console.log(`  Received chunk delta: "${chunk.content}"`);
                accumulatedTextContent += chunk.content;
                event.sender.send('copilot-chat-stream', { 
                  type: 'chunk_delta', 
                  delta: chunk.content 
                });
            } else if (chunk?.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
                 // Handle streaming tool *intention* chunks if needed (e.g., display args as they stream)
                 // For now, we primarily care about tool start/end events
                 console.log('  Received tool call chunk:', chunk.tool_call_chunks);
            } else if (Array.isArray(chunk?.content)) {
                 // Handle Anthropic style content array if necessary - extract text delta?
                 const textDelta = chunk.content.find(part => part.type === 'text_delta')?.text;
                 if (textDelta) {
                     console.log(`  Received Anthropic text delta: "${textDelta}"`);
                     accumulatedTextContent += textDelta;
                     event.sender.send('copilot-chat-stream', { 
                       type: 'chunk_delta', 
                       delta: textDelta 
                     });
                 }
                 // Could also extract input_json_delta here if we want to show args streaming
            }
        } else if (eventType === 'on_tool_start') {
            // Generate a unique toolId for each tool call (don't reuse IDs)
            const toolId = uuidv4();
            // Store this new toolId for the tool name (overwrites previous if exists)
            toolIdMap[eventName] = toolId;
            const toolInput = eventData.input || {};
            currentRunMessages.push({
                role: 'tool',
                toolId,
                tool_call_id: toolId,
                type: 'tool',
                content: `Using tool: ${eventName}...`,
                toolName: eventName,
                toolPhase: 'start',
                toolInput: JSON.stringify(toolInput)
            });
            event.sender.send('copilot-chat-stream', {
                type: 'tool_start',
                name: eventName,
                toolId: toolId, // Send the toolId to frontend
                input: toolInput
            });
        } else if (eventType === 'on_tool_end') {
            const toolId = toolIdMap[eventName] || uuidv4();
            const toolOutput = eventData.output; // Keep original output (could be string or object)
            
            // Attempt to stringify non-string output for storage, keeping the original for logic below
            let outputForStorage = toolOutput;
            if (typeof outputForStorage !== 'string') {
                try { outputForStorage = JSON.stringify(toolOutput); } catch { outputForStorage = String(toolOutput); }
            }

            currentRunMessages.push({
                role: 'tool',
                toolId,
                tool_call_id: toolId, // Ensure this matches the ID the model used if available
                type: 'tool', // Standard type for LangChain
                content: `Tool ${eventName} completed`, // Placeholder content
                toolName: eventName,
                toolPhase: 'end',
                toolOutput: outputForStorage // Store potentially stringified output
            });

            event.sender.send('copilot-chat-stream', {
                type: 'tool_end',
                name: eventName,
                toolId: toolId, // Send the toolId to frontend for proper matching
                output: toolOutput // Send the original output (string or object) to UI for rich display
            });

            // *** MODIFIED: Send CLI output to renderer ***
            if (eventName === 'compileSketch' || eventName === 'uploadSketch') {
              let outputStringToSend = null;
              let isCompileSuccess = false; // Flag to track if compile succeeded

              // Check if toolOutput is the ToolMessage object and extract content
              if (typeof toolOutput === 'object' && toolOutput !== null && typeof toolOutput.content === 'string') {
                outputStringToSend = toolOutput.content; 
                console.log(`[Agent Stream][on_tool_end] Extracted string content from ToolMessage object for "${eventName}".`);
              } 
              // Add fallback for slightly different structures or if it *is* already a string
              else if (typeof toolOutput === 'string') {
                 outputStringToSend = toolOutput;
                 console.log(`[Agent Stream][on_tool_end] Tool output for "${eventName}" was already a string.`);
              }
               // Deeper fallback for kwargs structure if needed
              else if (typeof toolOutput === 'object' && toolOutput !== null && typeof toolOutput.kwargs?.content === 'string') { 
                 outputStringToSend = toolOutput.kwargs.content;
                 console.log(`[Agent Stream][on_tool_end] Extracted string content from ToolMessage.kwargs for "${eventName}".`);
              }

              // Check if the compile/upload was successful based on the tool's return string
              if (outputStringToSend && outputStringToSend.toLowerCase().includes('successful.')) {
                isCompileSuccess = true;
              }


              if (outputStringToSend !== null) {
                  let finalOutputForUI = outputStringToSend; // Use the tool output directly since it's now properly formatted

                  console.log(`[Agent Stream][on_tool_end] Tool "${eventName}" finished. Output type: ${typeof outputStringToSend}, Length: ${outputStringToSend.length}`); 
                  if (mainWindow && mainWindow.webContents) {
                    console.log(`[Agent Stream][on_tool_end] Attempting to send 'show-agent-cli-output' for "${eventName}" to renderer.`);
                    // Send the potentially formatted output
                    mainWindow.webContents.send('show-agent-cli-output', finalOutputForUI); 
                    console.log(`[Agent Stream][on_tool_end] Successfully called webContents.send('show-agent-cli-output').`); 
                  } else {
                    console.warn(`[Agent Stream][on_tool_end] Could not send tool output for "${eventName}" - mainWindow or webContents not available.`);
                  }
              } else {
                   console.log(`[Agent Stream][on_tool_end] Tool "${eventName}" finished, but could not extract string output from object (type: ${typeof toolOutput}). Not sending to UI output panel.`);
                   console.log('[Agent Stream][on_tool_end] Raw toolOutput object:', JSON.stringify(toolOutput, null, 2)); // Log the object structure
              }
            }
            // **************************************

        } else if (eventType === 'on_chat_model_end') {
            // Potentially capture the final message content here if available
             const outputMessage = eventData?.output;
             if (outputMessage?.content && typeof outputMessage.content === 'string') {
                 console.log(`[Agent Stream] Final message content from on_chat_model_end: "${outputMessage.content}"`);
                 finalAssistantMessageContent = outputMessage.content;
             } else if (Array.isArray(outputMessage?.content)) {
                 // Handle Anthropic style array content
                 finalAssistantMessageContent = outputMessage.content
                     .filter(part => part.type === 'text')
                     .map(part => part.text)
                     .join('');
                 console.log(`[Agent Stream] Final message content (Anthropic) from on_chat_model_end: "${finalAssistantMessageContent}"`);
        }
        } else if (eventType === 'on_chain_error' || eventType === 'on_tool_error' || eventType === 'on_chat_model_error') {
            console.error(`[Agent Stream] Error event (${eventType}):`, eventData);
            streamError = eventData?.error || eventData || new Error(`Unknown stream error: ${eventType}`);
        }
        // Other events like on_chain_start, on_chain_end, on_llm_start etc. can be logged or ignored
        
    } // End for await loop

    if (streamError && streamError.message !== 'Stream cancelled by user.') { // Don't throw cancellation error
        throw streamError; 
    }

    const finalContent = finalAssistantMessageContent !== null ? finalAssistantMessageContent : accumulatedTextContent;
    console.log(`  Stream finished. Final content length: ${finalContent.length}. (From on_chat_model_end: ${finalAssistantMessageContent !== null})`);

    if (!controller.signal.aborted) { // Only save and send 'done' if not cancelled
      if (finalContent || finalContent === "") { 
        currentRunMessages.push({ role: 'assistant', content: finalContent });
        
        // *** Combine FULL initial history with messages from this run for saving ***
        const finalMessagesToSave = [...initialFullMessages, ...currentRunMessages];
        
        console.log(`[SaveHistory Debug] finalMessagesToSave (${finalMessagesToSave.length} items):`, JSON.stringify(finalMessagesToSave, null, 2));
        console.log(`  Saving ${finalMessagesToSave.length} total messages to history...`);
        saveChatHistory(projectPath, threadId, finalMessagesToSave); // Saves both .json and .full.json correctly
        console.log('  Chat history saved successfully');
        
        event.sender.send('copilot-chat-stream', { 
          type: 'done', 
          content: finalContent
        });
        console.log('  Sent "done" message to renderer');
      } else {
          // ... (handle no content case)
          // *** Combine FULL initial history for saving in error case ***
          const finalMessagesToSave = [...initialFullMessages, ...currentRunMessages];
          console.log(`[SaveHistory Debug - No Content] finalMessagesToSave (${finalMessagesToSave.length} items):`, JSON.stringify(finalMessagesToSave, null, 2));
          saveChatHistory(projectPath, threadId, finalMessagesToSave);
      }
    } else {
      // Stream was cancelled
      console.log('  Stream was cancelled, skipping final save and "done" message.');
      // Add a 'cancelled' marker to history? (Optional)
      currentRunMessages.push({ role: 'system', content: 'Stream cancelled by user.' });
      const finalMessagesToSave = [...initialFullMessages, ...currentRunMessages];
      saveChatHistory(projectPath, threadId, finalMessagesToSave); // Save history including cancellation marker
      // Send a specific 'cancelled' event?
      event.sender.send('copilot-chat-stream', { type: 'cancelled' });
    }

  } catch (err) {
    // Check if the error is due to the abort signal
    if (err.name === 'AbortError' || (streamError && streamError.message === 'Stream cancelled by user.')) {
      console.log('  Stream aborted successfully.');
       // Add a 'cancelled' marker to history
      currentRunMessages.push({ role: 'system', content: 'Stream cancelled by user.' });
      const finalMessagesToSave = [...initialFullMessages, ...currentRunMessages];
      saveChatHistory(projectPath, threadId, finalMessagesToSave); // Save history including cancellation marker
      // Send a specific 'cancelled' event?
      event.sender.send('copilot-chat-stream', { type: 'cancelled' });
    } else {
      // Handle other errors
      console.error('Streaming error:', err);
      // Log detailed error info
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack 
      });
      const errorProps = Object.getOwnPropertyNames(err).filter(prop => !['name', 'message', 'stack'].includes(prop));
      if (errorProps.length > 0) {
        const additionalInfo = {};
        errorProps.forEach(prop => { additionalInfo[prop] = err[prop]; });
        console.error('Additional error properties:', additionalInfo);
      }
      
      // Send error to frontend
      event.sender.send('copilot-chat-stream', { 
        type: 'error', 
        error: err.message || String(err) 
      });
      
      // DO NOT add error representation to current run messages
      // currentRunMessages.push({ role: 'assistant', content: `Error: ${err.message || String(err)}` }); 
      
      // *** Combine FULL initial history with messages accumulated BEFORE the error for saving ***
      const finalMessagesToSave = [...initialFullMessages, ...currentRunMessages];
      console.log(`[SaveHistory Debug - Error Catch] finalMessagesToSave (${finalMessagesToSave.length} items):`, JSON.stringify(finalMessagesToSave, null, 2));
      saveChatHistory(projectPath, threadId, finalMessagesToSave);
      console.log('  Saved chat history up to the point of error (excluding the error message itself).');
    }
  } finally {
    // Always clear the controller when the stream handler finishes
    currentStreamAbortController = null;
    console.log('[copilot-chat-message-stream] Cleared AbortController.');
  }
});

// --- New IPC Handler to Cancel Stream ---
ipcMain.on('cancel-copilot-stream', (event) => {
  console.log('[IPC Handler] cancel-copilot-stream called.');
  if (currentStreamAbortController) {
    console.log('  Found active AbortController, calling abort().');
    currentStreamAbortController.abort();
    // Don't nullify here; the finally block in the stream handler will do it.
  } else {
    console.log('  No active AbortController found to cancel.');
  }
});

ipcMain.handle('delete-project', async (event, projectDir) => {
  try {
    // Remove from projects.json
    // let projects = getProjects(); // Needs metadata
    let projectsMetadata = getProjectsMetadata();
    projectsMetadata = projectsMetadata.filter(p => p.dir !== projectDir);
    // saveProjects(projects);
    saveProjectsMetadata(projectsMetadata);
    // Delete the project directory recursively
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    return { success: true };
  } catch (err) {
    console.error('Error deleting project:', err);
    return { success: false, error: err.message || 'Failed to delete project.' };
  }
});

ipcMain.handle('update-project-name', async (event, projectDir, newName) => {
  try {
    // Sanitize the new name
    const safeName = newName.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeName) {
      return { success: false, error: 'Invalid project name' };
    }

    // Get current project metadata
    let projectsMetadata = getProjectsMetadata();
    const projectIndex = projectsMetadata.findIndex(p => p.dir === projectDir);
    
    if (projectIndex === -1) {
      return { success: false, error: 'Project not found in metadata' };
    }

    const project = projectsMetadata[projectIndex];
    const oldInoPath = project.ino;
    
    // Create new directory path
    const parentDir = path.dirname(projectDir);
    const newProjectDir = path.join(parentDir, safeName);
    
    // Check if new directory already exists (and it's not the same project)
    if (fs.existsSync(newProjectDir) && newProjectDir !== projectDir) {
      return { success: false, error: 'A project with this name already exists' };
    }

    // If the directory names are the same, only update metadata
    if (newProjectDir === projectDir) {
      // Only update the name in metadata, keep the same directory
      projectsMetadata[projectIndex].name = safeName;
      saveProjectsMetadata(projectsMetadata);
      return { success: true };
    }

    // Rename the directory
    fs.renameSync(projectDir, newProjectDir);
    
    // Update the .ino file name
    const oldInoName = path.basename(oldInoPath);
    const newInoPath = path.join(newProjectDir, `${safeName}.ino`);
    const currentInoPath = path.join(newProjectDir, oldInoName);
    
    if (fs.existsSync(currentInoPath) && currentInoPath !== newInoPath) {
      fs.renameSync(currentInoPath, newInoPath);
    }

    // Update metadata
    projectsMetadata[projectIndex] = {
      ...project,
      name: safeName,
      dir: newProjectDir,
      ino: newInoPath
    };
    
    saveProjectsMetadata(projectsMetadata);
    
    return { success: true, project: projectsMetadata[projectIndex] };
  } catch (err) {
    console.error('Error updating project name:', err);
    return { success: false, error: err.message || 'Failed to update project name.' };
  }
}); 

ipcMain.handle('set-window-title', async (event, title) => {
  if (mainWindow && typeof mainWindow.setTitle === 'function') {
    mainWindow.setTitle(title || 'Embedr');
    return { success: true };
  } else {
    return { success: false, error: 'Main window not available' };
  }
}); 

// New IPC Handler: Get available configuration options for a board
ipcMain.handle('get-board-options', async (event, baseFqbn) => {
  if (!baseFqbn) {
    return { success: false, error: 'Base FQBN is required.' };
  }

  return new Promise((resolve) => {
    const command = `"${arduinoCliPath}" board details --fqbn "${baseFqbn}" --format json --config-file "${arduinoConfigFile}" --config-dir "${arduinoDataDir}"`;  // Changed to --config-dir

    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: `Failed to get board details: ${stderr || error.message}` });
        return;
      }

      try {
        const details = JSON.parse(stdout);
        const optionsResult = {};

        if (details.config_options && Array.isArray(details.config_options)) {
          for (const configOption of details.config_options) {
            const key = configOption.option;
            const values = configOption.values || [];
            
            if (key && values.length > 0) {
              optionsResult[key] = values.map(v => ({
                value: v.value,
                label: v.value_label // Use value_label from JSON
                // We could also add v.selected here if needed for default selection logic
              }));
            }
          }
        } else {
        }

        resolve({ success: true, options: optionsResult });
      } catch (parseError) {
        resolve({ success: false, error: 'Failed to parse board details JSON.' });
      }
    });
  });
});

// New IPC Handler: Set the selected board configuration options
ipcMain.handle('set-selected-board-options', (event, options) => {
  console.log(`[IPC Handler] set-selected-board-options called with options:`, options);
  currentSelectedBoardOptions = options || {}; // Store the object { key: value, ... }
  
  // Emit event to UI when board options are set by agent
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('board-options-selected-by-agent', options);
    console.log(`[IPC Handler] Sent board-options-selected-by-agent event to renderer with options:`, options);
  }
  
  return { success: true };
});

// New IPC Handler: Get the current board options (for agent tools)
ipcMain.handle('get-current-board-options', (event) => {
  console.log(`[IPC Handler] get-current-board-options called, returning:`, currentSelectedBoardOptions);
  return { success: true, options: currentSelectedBoardOptions };
});

// Helper function to construct full FQBN
function constructFullFqbn(baseFqbn, options) {
  if (!baseFqbn) return '';
  
  // Extract the true base FQBN (remove any existing options)
  const actualBaseFqbn = baseFqbn.split(':').slice(0, 3).join(':'); // Take only vendor:arch:board
  
  let fullFqbn = actualBaseFqbn;
  if (options && typeof options === 'object' && Object.keys(options).length > 0) {
    const optionString = Object.entries(options)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    fullFqbn += `:${optionString}`;
  }
  console.log(`[constructFullFqbn] Input: ${baseFqbn}, Extracted Base: ${actualBaseFqbn}, Options: ${JSON.stringify(options)}, Result: ${fullFqbn}`);
  return fullFqbn;
}

// Add at the top of the file after other imports
const isDev = process.env.NODE_ENV === 'development';

// If in development mode, set global Firebase emulator URL
if (isDev) {
  process.env.FIREBASE_EMULATOR_HOST = 'localhost:5001';
  console.log('Using Firebase Functions Emulator');
}

// === Firebase Auth Token Cache ===
let cachedAuthToken = null;
let tokenExpiryTime = null;

// Clear token when it's close to expiry
function scheduleTokenRefresh(expiryTimeMs) {
  // Clear any existing timeout
  if (global.tokenRefreshTimeout) {
    clearTimeout(global.tokenRefreshTimeout);
  }
  
  const now = Date.now();
  // Set a minimum lifetime for a newly set token, e.g., 30 seconds, to avoid immediate clearing during polling
  const minTokenLifetime = 30 * 1000; 
  // Buffer before actual expiry, e.g., 1 minute
  const preExpiryBuffer = 1 * 60 * 1000;

  let timeUntilClear = expiryTimeMs - now - preExpiryBuffer;

  if (timeUntilClear < minTokenLifetime && (expiryTimeMs - now) > minTokenLifetime) {
    // If clearing would happen too soon, but token is still valid for more than minLifetime,
    // ensure it lives for at least minTokenLifetime from now.
    timeUntilClear = minTokenLifetime;
  } else if (timeUntilClear < 0) {
    // If token is already within buffer or past expiry, clear it very soon (but not instantly if just set)
    timeUntilClear = Math.max(0, expiryTimeMs - now); // Clear when it actually expires, or now if already past
  }
  
  console.log(`Auth token will be cleared in ${timeUntilClear/1000} seconds. Actual token expiry: ${new Date(expiryTimeMs).toISOString()}`);
  
  global.tokenRefreshTimeout = setTimeout(() => {
    console.log('Clearing cached auth token due to scheduled refresh.');
    cachedAuthToken = null;
    tokenExpiryTime = null;
  }, timeUntilClear);
}

// IPC handlers for token management
ipcMain.handle('get-firebase-auth-token', async (event) => {
  console.log('[IPC] get-firebase-auth-token called');
  try {
    // Return the existing token if it's valid
    if (cachedAuthToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
      console.log('[IPC] Returning cached auth token (expires in:', (tokenExpiryTime - Date.now())/1000, 'seconds)');
      return { success: true, token: cachedAuthToken };
    }
    
    // No valid token in cache, ask the renderer to provide one
    console.log('[IPC] No valid token in cache, requesting from renderer');
    if (mainWindow && mainWindow.webContents) {
      // Request a new token from the renderer process
      mainWindow.webContents.send('request-auth-token');
      return { success: false, error: 'Token refresh required' };
    } else {
      return { success: false, error: 'Main window not available' };
    }
  } catch (error) {
    console.error('[IPC] Error in get-firebase-auth-token:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

ipcMain.handle('set-firebase-auth-token', async (event, token, expiryTime) => {
  console.log('[IPC] set-firebase-auth-token called');
  try {
    if (!token) {
      console.warn('[IPC] No token provided to set-firebase-auth-token');
      cachedAuthToken = null; // Ensure it's cleared if no token is provided
      tokenExpiryTime = null;
      if (global.tokenRefreshTimeout) clearTimeout(global.tokenRefreshTimeout);
      return { success: false, error: 'No token provided' };
    }
    
    cachedAuthToken = token;
    tokenExpiryTime = expiryTime; // This is the actual expiry time from Firebase
    
    console.log(`[IPC] Auth token cached. Actual expiry at: ${new Date(tokenExpiryTime).toISOString()}`);
    
    // Schedule token refresh based on its actual expiry
    scheduleTokenRefresh(tokenExpiryTime);
    
    return { success: true };
  } catch (error) {
    console.error('[IPC] Error in set-firebase-auth-token:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

// === MonacoPilot Completion IPC Handler (NEW) ===
ipcMain.handle('invoke-monacopilot-completion', async (event, body) => {
  console.log('[IPC Handler] invoke-monacopilot-completion called with body:', body);

  let authToken = cachedAuthToken;
  const functionName = 'invoke-monacopilot-completion'; // For logging

  if (!authToken || (tokenExpiryTime && Date.now() >= tokenExpiryTime)) {
    console.warn(`[${functionName}] No valid cached auth token, requesting from renderer...`);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('request-auth-token');
      let attempts = 0;
      const maxAttempts = 20; // Wait for 10 seconds (20 * 500ms)
      while ((!cachedAuthToken || (tokenExpiryTime && Date.now() >= tokenExpiryTime)) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        authToken = cachedAuthToken;
        attempts++;
      }

      if (!authToken || (tokenExpiryTime && Date.now() >= tokenExpiryTime)) {
        console.error(`[${functionName}] Failed to get auth token after waiting.`);
        return { completion: null, error: 'Authentication timed out. Please sign in again and retry.' };
      }
      console.log(`[${functionName}] Auth token obtained after request.`);
    } else {
      console.error(`[${functionName}] Main window not available to request token.`);
      return { completion: null, error: 'Internal error: Cannot request auth token.' };
    }
  } else {
    console.log(`[${functionName}] Using cached auth token.`);
  }

  const monacopilotProxyUrl = isDev
    ? `http://127.0.0.1:5001/emdedr-822d0/us-central1/monacopilotProxy`
    : `https://monacopilotproxy-7ya4qwdxyq-uc.a.run.app`;

  console.log(`[${functionName}] Sending request to: ${monacopilotProxyUrl}`);

  try {
    const response = await fetch(monacopilotProxyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body), // body is the payload from monacopilot client
    });

    if (!response.ok) {
      let errorPayload = { error: `API Error (${response.status})` };
      try {
        const errorData = await response.json();
        errorPayload = { error: errorData.error || JSON.stringify(errorData) };
      } catch (e) {
        const errorText = await response.text();
        errorPayload = { error: errorText || `API Error (${response.status})` };
      }
      console.error(`[${functionName}] Error from monacopilotProxy:`, errorPayload.error);
      return { completion: null, ...errorPayload };
    }

    const data = await response.json(); // Expected: { completion: "...", error?: "..." }
    console.log(`[${functionName}] Response from monacopilotProxy:`, data);
    return data; // Return the structured response { completion, error? }

  } catch (error) {
    console.error(`[${functionName}] Fetch error:`, error);
    return { completion: null, error: error.message || 'Network error or failed to fetch from completion proxy.' };
  }
});
// === END MonacoPilot Completion IPC Handler ===

// === NEW IPC Handler for Get Latest Checkpoint Path ===
ipcMain.handle('get-latest-checkpoint-path', async (event, projectPath) => {
  console.log(`[IPC get-latest-checkpoint-path] Called for project: ${projectPath}`);
  if (!projectPath) {
    return { success: false, error: 'Project path is required.' };
  }

  const mainInoPath = getMainInoPath(projectPath);
  if (!mainInoPath) {
    return { success: false, error: 'Could not determine main .ino file for project.' };
  }

  // Utilize existing list-versions logic to get sorted versions
  // This is a simplified approach. For performance, you might directly read/parse index.json
  // and get the first entry if confident about sorting, but reusing list-versions is safer for consistency.
  return new Promise((resolve) => {
    try {
      const versDir = path.join(projectPath, '.versions'); // Adjusted to use projectPath directly for .versions
      const indexPath = path.join(versDir, 'index.json');

      if (!fs.existsSync(versDir) || !fs.existsSync(indexPath)) {
        console.log(`[IPC get-latest-checkpoint-path] No versions directory or index found for ${projectPath}`);
        resolve({ success: true, latestCheckpointPath: null }); // No versions means no latest path
        return;
      }

      let versions = [];
      try {
        versions = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        if (!Array.isArray(versions)) versions = [];
      } catch (e) {
        console.error('[IPC get-latest-checkpoint-path] Error reading or parsing index.json:', e);
        resolve({ success: false, error: 'Corrupted version index.' });
        return;
      }

      if (versions.length === 0) {
        resolve({ success: true, latestCheckpointPath: null });
        return;
      }

      // Assuming versions are sorted by `performSaveVersionLogic` and `list-versions` (newest first)
      // or explicitly sort here if necessary (e.g., by version number or timestamp)
      versions.sort((a, b) => (b.version || 0) - (a.version || 0)); // Ensure sort by version desc

      const latestVersion = versions[0];
      if (latestVersion && latestVersion.path) {
        console.log(`[IPC get-latest-checkpoint-path] Latest version path for ${projectPath}: ${latestVersion.path}`);
        resolve({ success: true, latestCheckpointPath: latestVersion.path });
      } else {
        resolve({ success: true, latestCheckpointPath: null }); // No valid latest version entry
      }
    } catch (e) {
      console.error('[IPC get-latest-checkpoint-path] Error:', e);
      resolve({ success: false, error: e.message });
    }
  });
});
// === END NEW IPC Handler ===

// === IPC Handler for invoking Firebase Functions (NEW) ===
ipcMain.handle('invoke-firebase-function', async (event, functionName, payload) => {
  console.log(`[IPC Handler] invoke-firebase-function: ${functionName} called with payload:`, payload);

  let authToken = cachedAuthToken;
  const isEmulator = process.env.FIREBASE_EMULATOR_HOST === 'localhost:5001';
  // Firebase Functions Gen 2 URLs (Cloud Run)
  const functionUrls = {
    'generateAuthRedirectToken': 'https://generateauthredirecttoken-7ya4qwdxyq-uc.a.run.app',
    'llmProxy': 'https://llmproxy-7ya4qwdxyq-uc.a.run.app',
    'monacopilotProxy': 'https://monacopilotproxy-7ya4qwdxyq-uc.a.run.app',
    'generateChatName': 'https://us-central1-emdedr-822d0.cloudfunctions.net/generateChatName',
    'generateProjectName': 'https://us-central1-emdedr-822d0.cloudfunctions.net/generateProjectName',
    'createRazorpaySubscription': 'https://createrazorpaysubscription-7ya4qwdxyq-uc.a.run.app',
    'cancelRazorpaySubscription': 'https://cancelrazorpaysubscription-7ya4qwdxyq-uc.a.run.app',
    'razorpayWebhook': 'https://razorpaywebhook-7ya4qwdxyq-uc.a.run.app',
    'logHeliconeUsageWebhook': 'https://logheliconeusagewebhook-7ya4qwdxyq-uc.a.run.app'
  };
  
  const functionUrl = isEmulator
    ? `http://localhost:5001/emdedr-822d0/us-central1/${functionName}`
    : functionUrls[functionName];

  if (!functionUrl && !isEmulator) {
    console.error(`[invoke-firebase-function:${functionName}] Unknown function name: ${functionName}`);
    return { success: false, error: `Unknown function: ${functionName}`, data: null };
  }

  if (!authToken || (tokenExpiryTime && Date.now() >= tokenExpiryTime)) {
    console.warn(`[invoke-firebase-function:${functionName}] No valid cached auth token, requesting from renderer...`);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('request-auth-token');
      let attempts = 0;
      const maxAttempts = 20; // Wait for 10 seconds (20 * 500ms)
      while ((!cachedAuthToken || (tokenExpiryTime && Date.now() >= tokenExpiryTime)) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        authToken = cachedAuthToken;
        attempts++;
      }
      if (!authToken || (tokenExpiryTime && Date.now() >= tokenExpiryTime)) {
        console.error(`[invoke-firebase-function:${functionName}] Failed to get auth token after waiting.`);
        return { success: false, error: 'Authentication timed out. Please sign in again and retry.', data: null };
      }
      console.log(`[invoke-firebase-function:${functionName}] Auth token obtained after request.`);
    } else {
      console.error(`[invoke-firebase-function:${functionName}] Main window not available to request token.`);
      return { success: false, error: 'Internal error: Cannot request auth token.', data: null };
    }
  } else {
    console.log(`[invoke-firebase-function:${functionName}] Using cached auth token.`);
  }

  console.log(`[invoke-firebase-function:${functionName}] Sending POST request to: ${functionUrl}`);
  
  // Retry logic for network issues
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[invoke-firebase-function:${functionName}] Attempt ${attempt}/${maxRetries}`);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload || {}),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`[invoke-firebase-function:${functionName}] Firebase function returned error (${response.status}):`, responseData);
        return { success: false, error: responseData.error || `Function call failed with status ${response.status}`, data: responseData };
      }
      console.log(`[invoke-firebase-function:${functionName}] Firebase function call successful.`);
      return { success: true, data: responseData };
    } catch (error) {
      lastError = error;
      console.error(`[invoke-firebase-function:${functionName}] Attempt ${attempt} failed:`, error.message);
      
             // Don't retry for auth errors or abort errors
       if (error.name === 'AbortError' || error.message.includes('401') || error.message.includes('403')) {
         break;
       }
       
       // Special handling for specific error types
       if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('Connect Timeout Error')) {
         console.log(`[invoke-firebase-function:${functionName}] Connection timeout detected, will retry...`);
       }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Cap at 5 seconds
        console.log(`[invoke-firebase-function:${functionName}] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`[invoke-firebase-function:${functionName}] All ${maxRetries} attempts failed. Last error:`, lastError);
  return { success: false, error: lastError?.message || 'Network error or failed to call function after multiple attempts.', data: null };
});

// === IPC Handler for opening external URLs (NEW) ===
ipcMain.handle('open-external-url', async (event, url) => {
  console.log(`[IPC Handler] open-external-url called with URL: ${url}`);
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error(`[IPC Handler] Error opening external URL:`, error);
    return { success: false, error: error.message || 'Failed to open external URL.' };
  }
});



// === Custom Library Installation Handlers ===

ipcMain.handle('lib-install-git', async (event, gitUrl, version) => {
  console.log('[lib-install-git] Handler called with:', { gitUrl, version });
  
  return new Promise((resolve) => {
    if (!gitUrl) {
      resolve({ success: false, error: 'Git URL is required' });
      return;
    }

    // Build the command
    let command = `"${arduinoCliPath}" lib install --git-url "${gitUrl}" --format json --config-dir "${arduinoDataDir}"`;
    
    if (version && version.trim()) {
      command += ` --git-ref "${version.trim()}"`;
    }

    console.log('[lib-install-git] Executing:', command);
    
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      console.log('[lib-install-git] Command completed');
      console.log('[lib-install-git] stdout:', stdout);
      console.log('[lib-install-git] stderr:', stderr);
      console.log('[lib-install-git] error:', error);
      
      if (error) {
        // Parse error message to extract meaningful information
        let errorMessage = 'Git installation failed';
        
        if (stderr) {
          errorMessage = stderr.trim();
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        // Clean up common arduino-cli error patterns
        errorMessage = errorMessage
          .replace(/^Error: /, '')
          .replace(/^library install failed: /, '')
          .replace(/^moving extracted archive to destination dir: /, '');
        
        console.log('[lib-install-git] Cleaned error message:', errorMessage);
        resolve({ 
          success: false, 
          error: errorMessage,
          output: { stdout, stderr }
        });
        return;
      }
      
      // Check if stdout contains error information
      if (stdout && stdout.toLowerCase().includes('error')) {
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) {
            resolve({ 
              success: false, 
              error: parsed.error,
              output: { stdout, stderr }
            });
            return;
          }
        } catch (e) {
          // Not JSON, treat as plain text error
          resolve({ 
            success: false, 
            error: stdout.trim(),
            output: { stdout, stderr }
          });
          return;
        }
      }
      
      resolve({ success: true, output: { stdout, stderr } });
    });
  });
});

ipcMain.handle('lib-install-zip', async (event, zipPath) => {
  console.log('[lib-install-zip] Handler called with:', { zipPath });
  
  return new Promise((resolve) => {
    if (!zipPath) {
      resolve({ success: false, error: 'Zip file path is required' });
      return;
    }

    const command = `"${arduinoCliPath}" lib install --zip-path "${zipPath}" --format json --config-dir "${arduinoDataDir}"`;
    
    console.log('[lib-install-zip] Executing:', command);
    
    exec(command, { cwd: arduinoDataDir }, (error, stdout, stderr) => {
      console.log('[lib-install-zip] Command completed');
      console.log('[lib-install-zip] stdout:', stdout);
      console.log('[lib-install-zip] stderr:', stderr);
      console.log('[lib-install-zip] error:', error);
      
      if (error) {
        // Parse error message to extract meaningful information
        let errorMessage = 'Zip installation failed';
        
        if (stderr) {
          errorMessage = stderr.trim();
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        // Clean up common arduino-cli error patterns
        errorMessage = errorMessage
          .replace(/^Error: /, '')
          .replace(/^library install failed: /, '')
          .replace(/^moving extracted archive to destination dir: /, '');
        
        console.log('[lib-install-zip] Cleaned error message:', errorMessage);
        resolve({ 
          success: false, 
          error: errorMessage,
          output: { stdout, stderr }
        });
        return;
      }
      
      // Check if stdout contains error information
      if (stdout && stdout.toLowerCase().includes('error')) {
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) {
            resolve({ 
              success: false, 
              error: parsed.error,
              output: { stdout, stderr }
            });
            return;
          }
        } catch (e) {
          // Not JSON, treat as plain text error
          resolve({ 
            success: false, 
            error: stdout.trim(),
            output: { stdout, stderr }
          });
          return;
        }
      }
      
      resolve({ success: true, output: { stdout, stderr } });
    });
  });
});

// === End Custom Library Installation Handlers ===

// === File Dialog Handlers ===

ipcMain.handle('show-open-dialog', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return { success: true, ...result };
  } catch (error) {
    console.error('[show-open-dialog] Error:', error);
    return { success: false, error: error.message };
  }
});

// === End File Dialog Handlers ===

// === App Update Checking Handler ===

ipcMain.handle('check-app-update', async (event) => {
  console.log('[check-app-update] Checking for app updates...');
  
  try {
    // Get current version from package.json
    const packageJson = require(path.join(__dirname, 'package.json'));
    const currentVersion = packageJson.version;
    console.log('[check-app-update] Current version:', currentVersion);
    
    // Fetch latest release from GitHub API
    const fetch = require('node-fetch');
    const response = await fetch('https://api.github.com/repos/sinhaventures/embedr/releases/latest', {
      headers: {
        'User-Agent': 'Embedr-App-Update-Checker'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API responded with status: ${response.status}`);
    }
    
    const releaseData = await response.json();
    const latestVersion = releaseData.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
    const releaseUrl = releaseData.html_url;
    const releaseNotes = releaseData.body || '';
    
    console.log('[check-app-update] Latest version:', latestVersion);
    console.log('[check-app-update] Release URL:', releaseUrl);
    
    // Compare versions (simple string comparison for now, works for semantic versioning)
    const isUpdateAvailable = compareVersions(currentVersion, latestVersion) < 0;
    
    return {
      success: true,
      updateAvailable: isUpdateAvailable,
      currentVersion,
      latestVersion,
      releaseUrl,
      releaseNotes,
      downloadUrl: 'https://www.embedr.cc/download'
    };
    
  } catch (error) {
    console.error('[check-app-update] Error checking for updates:', error);
    return {
      success: false,
      error: error.message || 'Failed to check for updates',
      updateAvailable: false
    };
  }
});

// Simple version comparison function
function compareVersions(version1, version2) {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  // Pad arrays to same length
  const maxLength = Math.max(v1parts.length, v2parts.length);
  while (v1parts.length < maxLength) v1parts.push(0);
  while (v2parts.length < maxLength) v2parts.push(0);
  
  for (let i = 0; i < maxLength; i++) {
    if (v1parts[i] < v2parts[i]) return -1;
    if (v1parts[i] > v2parts[i]) return 1;
  }
  
  return 0; // versions are equal
}

// === End App Update Checking Handler ===