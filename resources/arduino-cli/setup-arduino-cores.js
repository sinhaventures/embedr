const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const baseDir = path.resolve(__dirname);
const binDir = path.join(baseDir, 'bin');
const dataDir = path.join(baseDir, 'data');
const configFile = path.join(dataDir, 'arduino-cli.yaml');

// Arduino CLI download URLs (latest stable version)
const ARDUINO_CLI_VERSION = '1.1.0';
const downloadUrls = {
  win32: `https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/arduino-cli_${ARDUINO_CLI_VERSION}_Windows_64bit.zip`,
  darwin: `https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/arduino-cli_${ARDUINO_CLI_VERSION}_macOS_64bit.tar.gz`,
  linux: `https://github.com/arduino/arduino-cli/releases/download/v${ARDUINO_CLI_VERSION}/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_64bit.tar.gz`
};

// Helper function to download file
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${dest}`);
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${dest}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(dest, () => {}); // Delete partial file
        reject(err);
      });
    }).on('error', reject);
  });
}

// Helper function to extract archive
async function extractArchive(archivePath, extractDir, platform) {
  console.log(`Extracting ${archivePath} to ${extractDir}`);
  
  if (platform === 'win32') {
    // For Windows ZIP files
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(extractDir, true);
    
    // Move arduino-cli.exe to the correct location
    const extractedFiles = fs.readdirSync(extractDir);
    const exeFile = extractedFiles.find(f => f.endsWith('.exe'));
    if (exeFile) {
      const oldPath = path.join(extractDir, exeFile);
      const newPath = path.join(extractDir, 'arduino-cli.exe');
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath);
      }
    }
  } else {
    // For Unix tar.gz files
    execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' });
    
    // Make sure the binary is executable
    const binaryPath = path.join(extractDir, 'arduino-cli');
    if (fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, '755');
    }
  }
  
  // Clean up archive
  fs.unlinkSync(archivePath);
  console.log(`Extracted and cleaned up: ${archivePath}`);
}

// Download Arduino CLI binaries for all platforms
async function downloadArduinoCLI() {
  console.log('📥 Downloading Arduino CLI binaries...');
  
  // Check if we need adm-zip for Windows extraction
  try {
    require('adm-zip');
  } catch (e) {
    console.log('Installing adm-zip for archive extraction...');
    execSync('npm install adm-zip', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') });
  }
  
  for (const [platform, url] of Object.entries(downloadUrls)) {
    const platformDir = platform === 'win32' ? 'win' : (platform === 'darwin' ? 'mac' : 'linux');
    const targetDir = path.join(binDir, platformDir);
    
    // Ensure platform directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Check if binary already exists
    const expectedBinary = path.join(targetDir, platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');
    if (fs.existsSync(expectedBinary)) {
      console.log(`✅ Arduino CLI for ${platform} already exists: ${expectedBinary}`);
      continue;
    }
    
    // Download and extract
    const archiveExt = platform === 'win32' ? '.zip' : '.tar.gz';
    const archivePath = path.join(targetDir, `arduino-cli${archiveExt}`);
    
    try {
      await downloadFile(url, archivePath);
      await extractArchive(archivePath, targetDir, platform);
      console.log(`✅ Arduino CLI for ${platform} installed successfully`);
    } catch (error) {
      console.error(`❌ Failed to download/extract Arduino CLI for ${platform}:`, error.message);
      throw error;
    }
  }
}

// Get the correct arduino-cli binary for current platform
function getArduinoCliPath() {
  const platform = process.platform;
  const executableName = platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli';
  const platformDir = platform === 'win32' ? 'win' : (platform === 'darwin' ? 'mac' : 'linux');
  return path.join(binDir, platformDir, executableName);
}

// Execute arduino-cli command
function arduinoCliCmd(command) {
  const cliPath = getArduinoCliPath();
  const fullCommand = `"${cliPath}" ${command} --config-file "${configFile}" --config-dir "${dataDir}"`;
  console.log(`Executing: ${fullCommand}`);
  try {
    execSync(fullCommand, { stdio: 'inherit', cwd: dataDir });
  } catch (error) {
    console.error(`Error executing: ${fullCommand}`, error.message);
    throw error;
  }
}

// Create default Arduino CLI configuration
function createArduinoCliConfig() {
  console.log('📝 Creating Arduino CLI configuration...');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Create subdirectories
  const subdirs = ['downloads', 'packages', 'user'];
  subdirs.forEach(subdir => {
    const dirPath = path.join(dataDir, subdir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
  });
  
  // Create configuration file
  if (!fs.existsSync(configFile)) {
    const config = `# Arduino CLI Configuration for Embedr
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
    
    fs.writeFileSync(configFile, config, 'utf-8');
    console.log(`✅ Created Arduino CLI config: ${configFile}`);
  }
}

// Setup Arduino cores
async function setupArduinoCores() {
  console.log('⚙️  Setting up Arduino cores...');
  
  try {
    // Ensure the CLI path exists
    const cliPath = getArduinoCliPath();
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Arduino CLI binary not found at: ${cliPath}`);
    }
    
    console.log('📡 Updating core index...');
    arduinoCliCmd('core update-index');
    
    console.log('📦 Installing arduino:avr core (default Arduino boards)...');
    arduinoCliCmd('core install arduino:avr');
    
    console.log('✅ Arduino cores setup complete!');
    
    // List installed cores for verification
    console.log('📋 Installed cores:');
    arduinoCliCmd('core list');
    
  } catch (error) {
    console.error('❌ Failed to setup Arduino cores:', error.message);
    throw error;
  }
}

// Main setup function
async function main() {
  console.log('🔧 Arduino CLI Setup for Embedr');
  console.log('================================');
  
  try {
    // Step 1: Download Arduino CLI binaries
    await downloadArduinoCLI();
    
    // Step 2: Create configuration
    createArduinoCliConfig();
    
    // Step 3: Setup cores (only for current platform during build)
    // Skip core installation during build - cores will be installed at runtime
    
    console.log('\n🚀 Arduino CLI binaries ready for deployment!');
    console.log('📂 Arduino CLI binaries are ready for deployment - cores will be installed on first app launch');
    
  } catch (error) {
    console.error('\n❌ Arduino CLI setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, downloadArduinoCLI, setupArduinoCores };
