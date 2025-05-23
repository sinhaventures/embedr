const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const { SerialPort } = require('serialport');
const { v4: uuidv4 } = require('uuid');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatOpenAI } = require('@langchain/openai');
const { ChatAnthropic } = require('@langchain/anthropic');
const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { MemorySaver, StateGraph, Command } = require('@langchain/langgraph');
const { tool, StructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const { AIMessageChunk } = require("@langchain/core/messages");

// === AI Co-pilot/Agent dependencies ===
require('dotenv').config();

// === Gemini LLM Model Initialization ===
// Debug: Check if API key is loaded
console.log('GOOGLE_API_KEY loaded:', process.env.GOOGLE_API_KEY ? 'Yes' : 'No');
// If you want to see the key itself (use with caution, remove after debugging):
// console.log('Loaded API Key:', process.env.GOOGLE_API_KEY);

const chatModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.5-pro-exp-03-25',
  // temperature: 0.2, // Removed for testing
  streaming: true, // Enable streaming capabilities
  maxOutputTokens: 2048, // Set a reasonable token limit
});

// After model initialization, log detailed info about the model
console.log('ChatGoogleGenerativeAI model initialized:', {
  hasStreamMethod: typeof chatModel.stream === 'function',
  hasStreamCallMethod: typeof chatModel.streamCall === 'function',
  hasInvokeMethod: typeof chatModel.invoke === 'function',
  modelApiVersion: chatModel.modelApiVersion || 'unknown',
  apiKey: process.env.GOOGLE_API_KEY ? '[REDACTED]' : undefined,
  model: chatModel.model || 'unknown',
  modelProperties: Object.keys(chatModel),
});

// Log information about @langchain/google-genai version
try {
  console.log('Checking @langchain/google-genai package details:');
  const packageJsonPath = require.resolve('@langchain/google-genai/package.json');
  const packageInfo = require(packageJsonPath);
  console.log('  Version:', packageInfo.version);
  console.log('  Dependencies:', packageInfo.dependencies);
} catch (err) {
  console.error('Error loading @langchain/google-genai package details:', err.message);
}

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
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.resolve(APP_ROOT, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

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

  // Prevent window from being garbage collected
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

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

const PROJECTS_FILE = path.resolve(APP_ROOT, 'projects.json');

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
    const command = `arduino-cli compile --fqbn ${fullFqbn} "${sketchPath}" --format json`;
    console.log(`[compile-sketch] Executing command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
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
    // Use the full FQBN in the command
    const command = `arduino-cli upload -p ${port} --fqbn ${fullFqbn} "${sketchPath}" --format json`;
     console.log(`[upload-sketch] Executing command: ${command}`);
     
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('[upload-sketch] Error:', stderr || error);
        resolve({ success: false, error: stderr || error.message, output: stdout }); // Include stdout on error
        return;
      }
       console.log('[upload-sketch] Success stdout:', stdout);
       if (stderr) console.warn('[upload-sketch] Success stderr:', stderr);
      resolve({ success: true, output: stdout, error: stderr }); // Include stderr even on success
    });
  });
});

ipcMain.handle('list-projects', async () => {
  return getProjects();
});

ipcMain.handle('create-project', async (event, projectName) => {
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeName) return { success: false, error: 'Invalid project name' };
  const projectsDir = path.join(os.homedir(), 'EmbedrProjects');
  if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir);
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
    const command = 'arduino-cli board list --format json';
    exec(command, (error, stdout, stderr) => {
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
    const command = 'arduino-cli board listall --format json';
    const child = spawn(command.split(' ')[0], command.split(' ').slice(1));
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
    const command = `arduino-cli lib search ${query} --format json`;
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
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

    // Quote the library argument to handle names with spaces
    const quotedLibArg = `"${libArg}"`;
    const command = `arduino-cli lib install ${quotedLibArg}`;

    console.log(`[lib-install] Executing command: ${command}`);
    const childProcess = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('[lib-install] Installation error:', error);
        console.error('[lib-install] stderr:', stderr);
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      console.log('[lib-install] stdout:', stdout);
      if (stderr) console.warn('[lib-install] stderr (non-fatal):', stderr);
      
      // Verify installation by checking if library exists
      exec('arduino-cli lib list --format json', (verifyError, verifyStdout) => {
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
    const command = `arduino-cli lib uninstall ${name}`;
    exec(command, (error, stdout, stderr) => {
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
    const command = 'arduino-cli lib list --format json';
    exec(command, (error, stdout, stderr) => {
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
    const command = 'arduino-cli lib update-index';
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr || error.message });
        return;
      }
      resolve({ success: true, output: stdout });
    });
  });
});

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
    return await performSaveVersionLogic(filePath); // Call the refactored logic
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
const agentTools = require('./src/main/agent-tools');

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
const systemPrompt = fs.readFileSync(path.join(APP_ROOT, 'systemprompt.md'), 'utf-8');

// === Global AbortController for the current stream ===
let currentStreamAbortController = null; 

// === Helper function to get the correct chat model ===
// async function getChatModel(provider, modelName, authToken, options = {}) { // Original guide signature
async function getChatModel(provider, modelName, authToken, options = {}) {
  // Get the base URL for the Cloud Function
  const cloudFunctionBaseUrl = isDev 
    ? `http://localhost:5001/emdedr-822d0/us-central1/llmProxy`
    : `https://us-central1-emdedr-822d0.cloudfunctions.net/llmProxy`;
  
  console.log(`[DEBUG] getChatModel called with provider: ${provider}, model: ${modelName}`);
  console.log(`[DEBUG] Using cloud function base URL: ${cloudFunctionBaseUrl}`);
  
  if (!authToken) {
    console.warn('[DEBUG] No auth token provided to getChatModel');
    throw new Error('Authentication required');
  }
  
  // Headers with Firebase auth token
  const dynamicHeaders = {
    'Authorization': `Bearer ${authToken}`,
  };
  
  console.log(`[DEBUG] Creating ${provider} model with auth token (length: ${authToken.length})`);
  
  // Common config for streaming models
  const commonStreamingConfig = {
    // temperature: options.temperature || 0.7, // Original line
    maxOutputTokens: options.maxTokens || 2048,
    streaming: true,
    // Dummy API key - the actual key is secured in the Cloud Function
    apiKey: "DUMMY_KEY_NOT_USED",
  };

  // Adjust temperature specifically for o4-mini
  if (modelName === 'o4-mini') {
    if (options.temperature !== undefined && options.temperature !== 1 && options.temperature !== 1.0) {
      console.warn(`[DEBUG] Model 'o4-mini' only supports temperature 1.0. Ignoring provided value: ${options.temperature}`);
    }
    commonStreamingConfig.temperature = 1.0; // Set to the supported value
  } else {
    commonStreamingConfig.temperature = options.temperature !== undefined ? options.temperature : 0.7;
  }
  
  let chatModelInstance;
  
  if (provider === 'openai') {
    console.log(`[DEBUG] Initializing OpenAI model: ${modelName}`);
    chatModelInstance = new ChatOpenAI({
      ...commonStreamingConfig,
      modelName: modelName || 'gpt-4.1',
      configuration: {
        // IMPORTANT: Include /v1 in the path for OpenAI
        baseURL: `${cloudFunctionBaseUrl}/openai/v1`,
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[DEBUG] ChatOpenAI instance created with proxy configuration');
  } else if (provider === 'anthropic') {
    console.log(`[DEBUG] Initializing Anthropic model: ${modelName}`);
    chatModelInstance = new ChatAnthropic({
      ...commonStreamingConfig,
      modelName: modelName || 'claude-3-7-sonnet-latest',
      clientOptions: {
        baseURL: `${cloudFunctionBaseUrl}/anthropic`,
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[DEBUG] ChatAnthropic instance created with proxy configuration');
  } else if (provider === 'google') {
    console.log(`[DEBUG] Initializing Google model: ${modelName}`);
    chatModelInstance = new ChatGoogleGenerativeAI({
      ...commonStreamingConfig,
      apiKey: process.env.GOOGLE_API_KEY, // Use actual key from main.js env for Google proxy
      model: modelName || 'gemini-2.5-pro-exp-03-25',
      configuration: {
        baseURL: `${cloudFunctionBaseUrl}/google`,
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[DEBUG] ChatGoogleGenerativeAI instance created with proxy configuration (using main.js GOOGLE_API_KEY)');
  } else if (provider === 'groq') {
    console.log(`[DEBUG] Initializing Groq model: ${modelName}`);
    chatModelInstance = new ChatOpenAI({ // Groq uses OpenAI compatible API
      ...commonStreamingConfig,
      modelName: modelName || 'llama3-70b-8192',
      configuration: {
        baseURL: `${cloudFunctionBaseUrl}/groq`,
        defaultHeaders: dynamicHeaders,
      },
    });
    console.log('[DEBUG] ChatOpenAI instance created for Groq provider with proxy configuration');
  } else {
    console.error(`[DEBUG] Unsupported provider: ${provider}`);
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
  console.log(`[IPC Handler] set-selected-board called by UI with FQBN: ${fqbn}`);
  currentSelectedBoardFqbn = fqbn;
  // Optionally, notify other parts or just store it
  return { success: true };
});

ipcMain.handle('set-selected-port', (event, portPath) => {
  console.log(`[IPC Handler] set-selected-port called by UI with Port: ${portPath}`);
  currentSelectedPortPath = portPath;
  // Optionally, notify other parts or just store it
  return { success: true };
});
// === END Handlers for User Selection ===

// === Handlers for Agent Selection ===

ipcMain.handle('handle-select-board', async (event, fqbn) => {
  console.log(`[IPC Handler] handle-select-board called by Agent with FQBN: ${fqbn}`);
  currentSelectedBoardFqbn = fqbn; // Update central state
  
  // Detailed check before sending event
  if (mainWindow) {
    console.log(`[IPC Handler] mainWindow found. Is destroyed? ${mainWindow.isDestroyed()}`);
    if (mainWindow.webContents) {
      console.log(`[IPC Handler] mainWindow.webContents found. Is destroyed? ${mainWindow.webContents.isDestroyed()}`);
      try {
        mainWindow.webContents.send('board-selected-by-agent', fqbn);
        console.log(`[IPC Handler] Successfully called webContents.send('board-selected-by-agent', "${fqbn}")`);
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
            // Assign a unique toolId for this toolName (in case of multiple calls, use a counter)
            if (!toolIdMap[eventName]) {
                toolIdMap[eventName] = uuidv4();
            }
            const toolId = toolIdMap[eventName];
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
                  let finalOutputForUI = outputStringToSend; // Default to raw output

                  // --- START: Parse and Format Compile Output ---
                  if (eventName === 'compileSketch' && isCompileSuccess) {
                    try {
                      // Extract the JSON part from the tool's success message
                      const jsonMatch = outputStringToSend.match(/Output:\s*(\{[\s\S]*?\})\s*Errors/);
                      if (jsonMatch && jsonMatch[1]) {
                        const jsonOutput = JSON.parse(jsonMatch[1]);
                        if (jsonOutput && typeof jsonOutput.compiler_out === 'string') {
                          // Format the output like manual compilation
                          finalOutputForUI = `Compiling sketch...\n\nCompilation successful!\n\nCompiler Output:\n${jsonOutput.compiler_out.trim()}`;
                          console.log(`[Agent Stream][on_tool_end] Parsed and formatted compile output for UI.`);
                        } else {
                           console.warn(`[Agent Stream][on_tool_end] Compile JSON parsed, but 'compiler_out' not found or not a string. Falling back to raw output.`);
                        }
                      } else {
                         console.warn(`[Agent Stream][on_tool_end] Could not extract JSON from successful compile output string. Falling back to raw output.`);
                      }
                    } catch (parseError) {
                      console.error(`[Agent Stream][on_tool_end] Error parsing compile JSON output: ${parseError}. Falling back to raw output.`);
                      // Keep finalOutputForUI as the original string
                    }
                  }
                  // --- END: Parse and Format Compile Output ---

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
      
      // Add error representation to current run messages
      currentRunMessages.push({ role: 'assistant', content: `Error: ${err.message || String(err)}` }); 
      
      // *** Combine FULL initial history for saving in catch block ***
      const finalMessagesToSave = [...initialFullMessages, ...currentRunMessages];
      console.log(`[SaveHistory Debug - Error Catch] finalMessagesToSave (${finalMessagesToSave.length} items):`, JSON.stringify(finalMessagesToSave, null, 2));
      saveChatHistory(projectPath, threadId, finalMessagesToSave);
      console.log('  Saved chat history including error message.');
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
  //console.log(`[IPC Handler] get-board-options called for FQBN: ${baseFqbn}`);
  if (!baseFqbn) {
    return { success: false, error: 'Base FQBN is required.' };
  }

  return new Promise((resolve) => {
    // Use JSON format
    const command = `arduino-cli board details --fqbn ${baseFqbn} --format json`; 
    //console.log(`[get-board-options] Executing: ${command}`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        //console.error(`[get-board-options] Error executing command for ${baseFqbn}:`, stderr || error);
        resolve({ success: false, error: `Failed to get board details: ${stderr || error.message}` });
        return;
      }

      try {
        const details = JSON.parse(stdout);
        const optionsResult = {};

        if (details.config_options && Array.isArray(details.config_options)) {
          //console.log('[get-board-options] Found config_options array in JSON.');
          
          for (const configOption of details.config_options) {
            const key = configOption.option;
            const values = configOption.values || [];
            
            if (key && values.length > 0) {
              optionsResult[key] = values.map(v => ({
                value: v.value,
                label: v.value_label // Use value_label from JSON
                // We could also add v.selected here if needed for default selection logic
              }));
               //console.log(`[get-board-options] Parsed options for key '${key}':`, optionsResult[key]);
            }
          }
        } else {
          //console.log(`[get-board-options] No 'config_options' array found in JSON for ${baseFqbn}.`);
        }

        //console.log(`[get-board-options] Parsed final options for ${baseFqbn}:`, optionsResult);
        resolve({ success: true, options: optionsResult });
      } catch (parseError) {
        //console.error(`[get-board-options] Error parsing board details JSON for ${baseFqbn}:`, parseError);
        resolve({ success: false, error: 'Failed to parse board details JSON.' });
      }
    });
  });
});

// New IPC Handler: Set the selected board configuration options
ipcMain.handle('set-selected-board-options', (event, options) => {
  console.log(`[IPC Handler] set-selected-board-options called by UI with options:`, options);
  currentSelectedBoardOptions = options || {}; // Store the object { key: value, ... }
  return { success: true };
});

// Helper function to construct full FQBN
function constructFullFqbn(baseFqbn, options) {
  if (!baseFqbn) return '';
  let fullFqbn = baseFqbn;
  if (options && typeof options === 'object' && Object.keys(options).length > 0) {
    const optionString = Object.entries(options)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    fullFqbn += `:${optionString}`;
  }
  console.log(`[constructFullFqbn] Base: ${baseFqbn}, Options: ${JSON.stringify(options)}, Result: ${fullFqbn}`);
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