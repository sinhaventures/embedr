// Agent Tools for LangChain Agent
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
// Import Electron properly
const electron = require('electron');

// Create a helper function for IPC invocation from main process
// In main process, we need to use a direct method call to the registered handlers
function invokeIpc(channel, ...args) {
  // We're in the main process, so we need to access our own handlers
  console.log(`[Agent Tool] Direct IPC call to ${channel}`);
  
  // Get access to the registered handler for the channel
  // This approach depends on how handlers are registered in main.js
  try {
    // Try to find the handler function for this channel
    const handler = electron.ipcMain._invokeHandlers.get(channel);
    if (!handler) {
      console.error(`[Agent Tool] No handler found for channel: ${channel}`);
      return Promise.reject(new Error(`No handler registered for channel: ${channel}`));
    }
    
    // Call the handler with a dummy event object and the arguments
    const dummyEvent = { sender: electron.webContents?.getFocusedWebContents() };
    return handler(dummyEvent, ...args);
  } catch (error) {
    console.error(`[Agent Tool] Error invoking IPC channel ${channel}:`, error);
    return Promise.reject(error);
  }
}

// Helper to get the main sketch path (assuming projectPath is passed in context)
// NOTE: This assumes the agent's execution context has access to projectPath.
// This might need adjustment depending on how context is passed in main.js.
const path = require('path');
function getMainInoPath(projectPath) {
  if (!projectPath) return null;
  const projectName = path.basename(projectPath);
  return path.join(projectPath, `${projectName}.ino`);
}

// --- Board and Port Tools ---

const listSerialPortsTool = tool(
  async (_input, { config }) => {
    console.log('[Agent Tool] Calling list-serial-ports');
    try {
      const result = await invokeIpc('list-serial-ports');
      return result.success ? JSON.stringify(result.ports) : `Error listing serial ports: ${result.error}`;
    } catch (error) {
      console.error('[Agent Tool Error] listSerialPortsTool:', error);
      return `Failed to execute list serial ports command: ${error.message}`;
    }
  },
  {
    name: 'listSerialPorts',
    description: 'List all available serial ports. Use this to find the correct port path for uploading code.',
    schema: z.object({}), // No input
  }
);

// --- Compile and Upload Tools ---

const compileSketchTool = tool(
  async (inputArgs) => { // Changed param name for clarity
    console.log('[Agent Tool] compileSketch raw inputArgs:', JSON.stringify(inputArgs, null, 2));
    
    // Attempt to parse nested structure if necessary
    let fqbn, sketchPath;
    if (typeof inputArgs === 'object' && inputArgs !== null && typeof inputArgs.input === 'string') {
      try {
        console.log('[Agent Tool] Detected nested input string, attempting to parse...');
        const nestedArgs = JSON.parse(inputArgs.input);
        fqbn = nestedArgs.fqbn;
        sketchPath = nestedArgs.sketchPath;
        console.log('[Agent Tool] Parsed nested args:', { fqbn, sketchPath });
      } catch (parseError) {
        console.error('[Agent Tool] Failed to parse nested input string:', parseError);
        return 'Error: Failed to parse tool input arguments.';
      }
    } else if (typeof inputArgs === 'object' && inputArgs !== null) {
       // Assume direct arguments if not nested
       console.log('[Agent Tool] Assuming direct arguments.');
       fqbn = inputArgs.fqbn;
       sketchPath = inputArgs.sketchPath;
    } else {
      console.error('[Agent Tool] Invalid inputArgs type:', typeof inputArgs);
      return 'Error: Invalid tool input arguments type.';
    }

    console.log('[Agent Tool] compileSketch processed args:', { fqbn, sketchPath });
    
    // Validate required args received from agent
    if (!sketchPath) {
      console.error('[Agent Tool] Validation failed: sketchPath is missing.');
      return 'Error: sketchPath argument is missing.';
    }
    if (!fqbn) {
      console.error('[Agent Tool] Validation failed: fqbn is missing.');
      return 'Error: FQBN argument is missing.';
    }
    
    try {
      // Get the current board options from the global state
      const boardOptionsResult = await invokeIpc('get-current-board-options');
      const boardOptions = boardOptionsResult?.options || {};
      
      // Use our custom invokeIpc function with proper argument order and board options
      console.log(`[Agent Tool] Calling invokeIpc('compile-sketch', ${fqbn}, ${JSON.stringify(boardOptions)}, ${sketchPath})`);
      const result = await invokeIpc('compile-sketch', fqbn, boardOptions, sketchPath); 

      if (result.success) {
        // --- SUCCESS CASE --- 
        // Return only a simple success message, optionally parse for memory later if needed
        return "Compile successful.";
      } else {
        // --- FAILURE CASE ---
        let errorSummary = `Compile failed. ${result.error || 'Unknown reason.'}\n`; // Start with the high-level error
        let specificErrors = "";

        if (result.output) {
          try {
            const outputJson = JSON.parse(result.output);

            // Prioritize structured diagnostics
            if (outputJson.builder_result?.diagnostics?.length > 0) {
              const errorsOnly = outputJson.builder_result.diagnostics.filter(d => d.severity === 'ERROR');
              const warningsOnly = outputJson.builder_result.diagnostics.filter(d => d.severity === 'WARNING');
              const MAX_ITEMS_TO_SHOW = 7; // Limit total diagnostics shown

              if (errorsOnly.length > 0) {
                 specificErrors += "Compiler Errors:\n";
                 errorsOnly.slice(0, MAX_ITEMS_TO_SHOW).forEach(diag => {
                   specificErrors += `- ${diag.message} (at ${path.basename(diag.file || 'unknown')}:${diag.line})\n`;
                 });
                 if (errorsOnly.length > MAX_ITEMS_TO_SHOW) {
                   specificErrors += `- ... (${errorsOnly.length - MAX_ITEMS_TO_SHOW} more errors)\n`;
                 }
              }
              
              if (warningsOnly.length > 0 && errorsOnly.length < MAX_ITEMS_TO_SHOW) {
                 specificErrors += "Compiler Warnings:\n";
                 const warningsToShow = Math.max(0, MAX_ITEMS_TO_SHOW - errorsOnly.length);
                 warningsOnly.slice(0, warningsToShow).forEach(diag => {
                    specificErrors += `- ${diag.message} (at ${path.basename(diag.file || 'unknown')}:${diag.line})\n`;
                 });
                 if (warningsOnly.length > warningsToShow) {
                    specificErrors += `- ... (${warningsOnly.length - warningsToShow} more warnings)\n`;
                 }
              }

            } 
            // Fallback to compiler_err string if no diagnostics
            else if (outputJson.compiler_err) {
              specificErrors += "Compiler Errors:\n";
              // Limit the length of raw compiler_err
              const MAX_ERR_LENGTH = 600; // Increased slightly
              const trimmedError = outputJson.compiler_err.trim();
              specificErrors += trimmedError.length > MAX_ERR_LENGTH 
                                  ? trimmedError.substring(0, MAX_ERR_LENGTH) + "..." 
                                  : trimmedError;
            }
          } catch (parseError) {
            console.error('[Agent Tool] Failed to parse compile output JSON on failure:', parseError);
            // If JSON parsing fails, include a snippet of the raw error string from stderr for context
            specificErrors += "Could not parse compiler output JSON. Raw error details:\n";
            const MAX_RAW_LENGTH = 500;
            const rawInfo = result.error || "";
            specificErrors += rawInfo.length > MAX_RAW_LENGTH 
                                  ? rawInfo.substring(0, MAX_RAW_LENGTH) + "..." 
                                  : rawInfo;
          }
        }
        
        // Append extracted/summarized errors if found
        if (specificErrors.trim()) {
          errorSummary += specificErrors.trim();
        } else if (!result.error && !result.output) {
          errorSummary += "No specific compiler errors or output available.";
        }

        return errorSummary.trim(); // Return the concise error message
      }
    } catch (error) {
      console.error('[Agent Tool Error] compileSketchTool:', error);
      return `Failed to execute compile command: ${error.message}`;
    }
  },
  {
    name: 'compileSketch',
    description: 'Compile the Arduino sketch. Requires the sketch path and the FQBN (Fully Qualified Board Name). The agent MUST extract sketchPath from the CONTEXT block.',
    schema: z.object({
      // projectPath no longer needed here if sketchPath is absolute
      sketchPath: z.string().describe('The absolute path to the main .ino sketch file. Extract this from the CONTEXT block provided in the user message.'),
      fqbn: z.string().describe('The Fully Qualified Board Name (e.g., "arduino:avr:uno").'),
    }),
  }
);

const uploadSketchTool = tool(
  async ({ fqbn, port, sketchPath }) => {
    console.log('[Agent Tool] uploadSketch called with:', { fqbn, port, sketchPath });

    // Validate required args
    if (!sketchPath) return 'Error: sketchPath argument is missing.';
    if (!fqbn) return 'Error: FQBN argument is missing.';
    if (!port) return 'Error: port argument is missing.';

    try {
      // Get the current board options from the global state
      const boardOptionsResult = await invokeIpc('get-current-board-options');
      const boardOptions = boardOptionsResult?.options || {};
      
      // Use our custom invokeIpc function with proper argument order and board options
      console.log(`[Agent Tool] Calling invokeIpc('upload-sketch', ${fqbn}, ${JSON.stringify(boardOptions)}, ${port}, ${sketchPath})`);
      const result = await invokeIpc('upload-sketch', fqbn, boardOptions, port, sketchPath);
      if (result.success) {
        return `Upload successful. Output:\n${result.output}`;
      } else {
        return `Upload failed. Error:\n${result.error}`;
      }
    } catch (error) {
      console.error('[Agent Tool Error] uploadSketchTool:', error);
      return `Failed to execute upload command: ${error.message}`;
    }
  },
  {
    name: 'uploadSketch',
    description: 'Upload the compiled Arduino sketch. Requires the sketch path, FQBN, and port path. The agent MUST extract sketchPath from the CONTEXT block.',
    schema: z.object({
      // projectPath no longer needed here if sketchPath is absolute
      sketchPath: z.string().describe('The absolute path to the main .ino sketch file. Extract this from the CONTEXT block provided in the user message.'),
      fqbn: z.string().describe('The Fully Qualified Board Name (e.g., "arduino:avr:uno").'),
      port: z.string().describe('The serial port path (e.g., "/dev/ttyACM0" or "COM3").'),
    }),
  }
);

// --- Sketch Editing Tool ---

const modifySketchTool = tool(
  async ({ sketchPath, newContent }) => {
    console.log('[Agent Tool] Calling modifySketch with:', { sketchPath, contentLength: newContent?.length });
    
    // Validate required args
    if (!sketchPath) return 'Error: sketchPath argument is missing.';
    if (!newContent) return 'Error: newContent argument is missing.';
    
    try {
      // First create a backup version before modifying the file
      console.log('[Agent Tool] Creating backup before modifying file');
      await invokeIpc('save-version', sketchPath);
      
      // Now modify the sketch file with the new content
      console.log('[Agent Tool] Writing new content to file via write-file IPC');
      const result = await invokeIpc('write-file', sketchPath, newContent);
      console.log('[Agent Tool] write-file result:', result);
      
      if (result === true) {
        // Force reload with a short delay to ensure UI receives the file-changed event
        console.log('[Agent Tool] File updated successfully, adding a short delay to allow UI refresh');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Force a refresh as a backup mechanism
        console.log('[Agent Tool] Triggering force-refresh-file for additional reliability');
        try {
          await invokeIpc('force-refresh-file', sketchPath);
        } catch (refreshError) {
          console.error('[Agent Tool] Error in force-refresh-file:', refreshError);
          // Continue even if force refresh fails
        }
        
        return `Successfully modified the sketch file at ${sketchPath}. A backup of the previous version was created. The editor view should refresh to show your changes. If not, you may need to reload the page or reopen the project.`;
      } else {
        return `Failed to modify the sketch file at ${sketchPath}.`;
      }
    } catch (error) {
      console.error('[Agent Tool Error] modifySketchTool:', error);
      return `Failed to modify sketch: ${error.message}`;
    }
  },
  {
    name: 'modifySketch',
    description: 'Modify the Arduino sketch file (.ino). Takes the sketch path and the new content. The agent MUST extract sketchPath from the CONTEXT block. The agent should first read the current sketch content, analyze it, and then provide a complete new version with the changes. Always preserve important functionality and only make requested changes. The editor view will automatically refresh to show the updated code.',
    schema: z.object({
      sketchPath: z.string().describe('The absolute path to the .ino sketch file to modify. Extract this from the CONTEXT block provided in the user message.'),
      newContent: z.string().describe('The complete new content for the sketch file. This should be valid Arduino code.'),
    }),
  }
);

const getSketchContentTool = tool(
  async ({ sketchPath }) => {
    console.log('[Agent Tool] Calling getSketchContent with:', { sketchPath });
    
    // Validate required args
    if (!sketchPath) return 'Error: sketchPath argument is missing.';
    
    try {
      // Use the read-file IPC handler to get the sketch file content
      const content = await invokeIpc('read-file', sketchPath);
      if (content === '') {
        return `Failed to read the sketch file at ${sketchPath} or file is empty.`;
      } else {
        return content; // Return the raw content
      }
    } catch (error) {
      console.error('[Agent Tool Error] getSketchContentTool:', error);
      return `Failed to read sketch: ${error.message}`;
    }
  },
  {
    name: 'getSketchContent',
    description: 'Get the current content of an Arduino sketch file (.ino). Takes the sketch path. The agent MUST extract sketchPath from the CONTEXT block. Use this tool before modifying a sketch to understand its current structure.',
    schema: z.object({
      sketchPath: z.string().describe('The absolute path to the .ino sketch file to read. Extract this from the CONTEXT block provided in the user message.'),
    }),
  }
);

// --- Library Management Tools ---

const searchLibraryTool = tool(
  async ({ query }) => {
    console.log('[Agent Tool] Calling lib-search with:', query);
    if (!query) return 'Error: Search query is missing.';
    try {
      const result = await invokeIpc('lib-search', query);
      // Check if the IPC call was successful and returned results
      if (result.success && result.results) { 
        // Directly use result.results as it's already a parsed object from main.js
        const searchData = result.results; 

        if (searchData.libraries && Array.isArray(searchData.libraries)) {
          const allLibs = searchData.libraries;
          const totalFound = allLibs.length;
          const topLibs = allLibs.slice(0, 20); // Get top 20 results

          // Simplify the output for the agent
          const simplifiedLibs = topLibs.map(lib => {
            const name = lib.name;
            const version = lib.latest?.version || 'N/A';
            const author = lib.latest?.author || 'Unknown Author';
            const description = lib.latest?.sentence || 'No description';
            // ~~Construct install_name~~
            // const install_name = version !== 'N/A' ? `${name}@${version}` : name;

            return {
              name,
              version,
              author,
              description,
              // install_name // Removed install_name field
            };
          });

          let responseString = `Library search successful. Found ${totalFound} libraries. Displaying top ${simplifiedLibs.length}:\n`;
          responseString += JSON.stringify(simplifiedLibs, null, 2); // Pretty print the simplified list
          return responseString;
        } else {
          // Handle cases where the already parsed object doesn't have the expected structure
          console.warn('[Agent Tool] lib-search result format unexpected:', searchData);
          return 'Library search successful, but response format unexpected.';
        }
      } else {
        // Handle IPC call failure or no results returned
        return `Library search failed. Error: ${result.error || 'No results returned from IPC handler.'}`;
      }
    } catch (error) {
      // Catch errors during IPC invocation or data processing
      console.error('[Agent Tool Error] searchLibraryTool unexpected error:', error);
      return `Failed to execute library search command: ${error.message}`;
    }
  },
  {
    name: 'searchLibrary',
    description: 'Search for Arduino libraries using a query string. Returns up to the top 20 matching libraries with their name, latest version, author, and description.', // Updated description
    schema: z.object({
      query: z.string().describe('The search term for finding libraries (e.g., "MQTT client", "Adafruit NeoPixel").'),
    }),
  }
);

const installLibraryTool = tool(
  async ({ libraryName, version }) => {
    console.log('[Agent Tool] Calling lib-install with:', { libraryName, version });
    if (!libraryName) return 'Error: Library name is missing.';
    
    // Construct the argument for arduino-cli based on whether version is provided
    let libArg = libraryName;
    if (version && version.trim() !== '') { // Check if version is provided and not empty
      libArg = `${libraryName}@${version}`;
      console.log(`[Agent Tool] Version provided, using arg: "${libArg}"`);
    } else {
      console.log(`[Agent Tool] No version provided, using arg: "${libraryName}"`);
    }

    let installOutput = ''; // Store install output
    try {
      // 1. Attempt installation using the constructed libArg
      const installResult = await invokeIpc('lib-install', libArg); // Pass the single constructed argument
      installOutput = installResult.output || ''; // Capture output regardless of success for context

      if (!installResult.success) {
        // Installation failed, return error and any output
        return `Library installation failed for '${libArg}'. Error: ${installResult.error || 'Unknown error'}\nOutput:\n${installOutput}`;
      }

      // 2. Installation succeeded, now try to get details
      console.log(`[Agent Tool] Installation successful for ${libArg}. Fetching details...`);
      try {
        const listResult = await invokeIpc('lib-list');
        if (listResult.success && listResult.libraries?.installed_libraries) {
          const installedList = listResult.libraries.installed_libraries;
          // Find the installed library by the base name (case-insensitive)
          const foundLib = installedList.find(item => 
            item.library?.name?.toLowerCase() === libraryName.toLowerCase()
          );

          if (foundLib && foundLib.library) {
            const details = foundLib.library;
            const installedVersion = details.version || 'Unknown';
            const author = details.author || 'Unknown Author';
            const sentence = details.sentence || 'No description.';
            
            // Construct detailed success message
            return `Library '${libraryName}' (version: ${installedVersion}) installed successfully.\nAuthor: ${author}\nDescription: ${sentence}\n\nInstallation Output:\n${installOutput}`;
          } else {
            console.warn(`[Agent Tool] Library ${libraryName} installed, but couldn't find details in lib list.`);
            // Fallback if details not found
            return `Library '${libArg}' installed successfully, but couldn't retrieve details afterwards.\nInstallation Output:\n${installOutput}`;
          }
        } else {
          console.warn(`[Agent Tool] Library ${libArg} installed, but failed to list libraries afterwards: ${listResult.error}`);
           // Fallback if lib list failed
          return `Library '${libArg}' installed successfully, but failed to retrieve library list afterwards.\nInstallation Output:\n${installOutput}`;
        }
      } catch (listError) {
        console.error('[Agent Tool Error] Error fetching library list after install:', listError);
        // Fallback if lib list invocation errored
        return `Library '${libArg}' installed successfully, but an error occurred retrieving details afterwards.\nInstallation Output:\n${installOutput}`;
      }

    } catch (error) {
      console.error('[Agent Tool Error] installLibraryTool outer catch:', error);
      // Catch errors from the install IPC call itself
      return `Failed to execute library install command for '${libArg}': ${error.message}\nInstallation Output Attempt:\n${installOutput}`;
    }
  },
  {
    name: 'installLibrary',
    description: 'Install an Arduino library by name. Optionally specify a version. If version is provided, installs that specific version (e.g., name="MyLib", version="1.2.0"). If version is omitted, installs the latest available version. Returns installation status and details about the installed library.', // Updated description to clarify behavior
    schema: z.object({
      libraryName: z.string().describe('The exact name of the library to install (e.g., "PubSubClient", "DHT sensor library"). Do NOT include @version here.'), // Emphasize base name
      version: z.string().optional().describe('The specific version of the library to install (e.g., "1.4.6"). If omitted, the latest version is installed.'),
    }),
  }
);

// --- Board and Port Selection Tools ---

const selectBoardTool = tool(
  async ({ boardNameOrKeyword }) => {
    console.log('[Agent Tool] Calling selectBoard with keyword:', boardNameOrKeyword);
    if (!boardNameOrKeyword) return 'Error: boardNameOrKeyword is required to select a board.';
    try {
      const listResult = await invokeIpc('list-all-boards');
      if (!listResult.success || !Array.isArray(listResult.boards)) {
        return `Error listing boards to select from: ${listResult.error || 'Could not retrieve board list.'}`;
      }
      
      const keywordLower = boardNameOrKeyword.toLowerCase();
      const matchingBoards = listResult.boards.filter(board => 
        board.name.toLowerCase() === keywordLower || board.fqbn.toLowerCase() === keywordLower
      );

      if (matchingBoards.length === 0) {
        return `No boards found matching "${boardNameOrKeyword}". Use listBoards to see available boards.`;
      } else if (matchingBoards.length === 1) {
        const board = matchingBoards[0];
        try {
          // Call a *new* IPC handler to notify the renderer/main state
          await invokeIpc('handle-select-board', board.fqbn);
          return `Selected and updated board to: ${board.name} (FQBN: ${board.fqbn}).`;
        } catch (updateError) {
          console.error('[Agent Tool Error] Failed to update board selection via IPC:', updateError);
          return `Found board ${board.name} (FQBN: ${board.fqbn}), but failed to update the selection in the app: ${updateError.message}`;
        }
      } else {
        return `Multiple boards found matching "${boardNameOrKeyword}":\n${JSON.stringify(matchingBoards)}\nPlease provide a more specific name or keyword.`;
      }
    } catch (error) {
      console.error('[Agent Tool Error] selectBoardTool:', error);
      return `Failed to select board: ${error.message}`;
    }
  },
  {
    name: 'selectBoard',
    description: 'Selects a specific Arduino board based on a name or keyword. Returns the matching board name and FQBN if exactly one match is found. Use the returned FQBN in subsequent compile/upload actions.',
    schema: z.object({
      boardNameOrKeyword: z.string().describe('A name, part of a name, or keyword to identify the target board (e.g., "Uno", "ESP32", "nano").'),
    }),
  }
);

const selectPortTool = tool(
  async ({ portDescriptionOrKeyword }) => {
    console.log('[Agent Tool] Calling selectPort with keyword:', portDescriptionOrKeyword);
    if (!portDescriptionOrKeyword) return 'Error: portDescriptionOrKeyword is required to select a port.';
    try {
      const listResult = await invokeIpc('list-serial-ports');
      if (!listResult.success || !Array.isArray(listResult.ports)) {
        return `Error listing ports to select from: ${listResult.error || 'Could not retrieve port list.'}`;
      }
      
      const keywordLower = portDescriptionOrKeyword.toLowerCase();
      const matchingPorts = listResult.ports.filter(port => 
        (port.path && port.path.toLowerCase().includes(keywordLower)) ||
        (port.manufacturer && port.manufacturer.toLowerCase().includes(keywordLower)) ||
        (port.friendlyName && port.friendlyName.toLowerCase().includes(keywordLower))
      );

      if (matchingPorts.length === 0) {
        return `No serial ports found matching "${portDescriptionOrKeyword}". Use listSerialPorts to see available ports.`;
      } else if (matchingPorts.length === 1) {
        const port = matchingPorts[0];
        try {
          // Call a *new* IPC handler to notify the renderer/main state
          await invokeIpc('handle-select-port', port.path);
          return `Selected and updated port to: ${port.path} (${port.friendlyName || port.manufacturer || 'No description'}).`;
        } catch (updateError) {
          console.error('[Agent Tool Error] Failed to update port selection via IPC:', updateError);
          return `Found port ${port.path}, but failed to update the selection in the app: ${updateError.message}`;
        }
      } else {
        return `Multiple ports found matching "${portDescriptionOrKeyword}":\n${JSON.stringify(matchingPorts)}\nPlease provide a more specific description or keyword.`;
      }
    } catch (error) {
      console.error('[Agent Tool Error] selectPortTool:', error);
      return `Failed to select port: ${error.message}`;
    }
  },
  {
    name: 'selectPort',
    description: 'Selects a specific serial port based on its path, description, or manufacturer keyword. Returns the matching port path if exactly one match is found. Use the returned path in subsequent upload/connect actions.',
    schema: z.object({
      portDescriptionOrKeyword: z.string().describe('A path, description, or keyword to identify the target serial port (e.g., "COM3", "/dev/ttyACM0", "CH340", "Arduino Uno").'),
    }),
  }
);

// --- End Board and Port Selection Tools ---

// Export all tools as an array
module.exports = [
  listSerialPortsTool,
  compileSketchTool,
  uploadSketchTool,
  modifySketchTool,
  getSketchContentTool,
  searchLibraryTool,
  installLibraryTool,
  selectBoardTool,
  selectPortTool,
]; 