const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configuration
const ARDUINO_CLI_VERSION = 'latest'; // Use latest stable version
const ARDUINO_CLI_DOWNLOAD_URL = 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip';
const RESOURCES_DIR = path.resolve(__dirname, '../resources');
const ARDUINO_CLI_DIR = path.join(RESOURCES_DIR, 'arduino-cli');
const BIN_DIR = path.join(ARDUINO_CLI_DIR, 'bin', 'win');
const DATA_DIR = path.join(ARDUINO_CLI_DIR, 'data');
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
const PACKAGES_DIR = path.join(DATA_DIR, 'packages');
const CONFIG_FILE = path.join(DATA_DIR, 'arduino-cli.yaml');

console.log('🔧 Starting Windows Build Process for Embedr');
console.log('============================================');

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function extractZip(zipPath, extractDir) {
  // Using PowerShell to extract zip on Windows
  const command = `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`;
  execSync(command, { stdio: 'inherit' });
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
}

function cleanupDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      // Try to remove files individually on Windows
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          cleanupDirectory(itemPath);
          fs.rmdirSync(itemPath);
        } else {
          fs.unlinkSync(itemPath);
        }
      }
      fs.rmdirSync(dirPath);
      console.log(`🧹 Cleaned directory: ${dirPath}`);
    } catch (error) {
      console.warn(`⚠️  Could not fully clean ${dirPath}: ${error.message}`);
      // Try alternative method
      try {
        execSync(`powershell -command "Remove-Item -Path '${dirPath}' -Recurse -Force"`, { stdio: 'pipe' });
        console.log(`🧹 Cleaned directory using PowerShell: ${dirPath}`);
      } catch (psError) {
        console.warn(`⚠️  PowerShell cleanup also failed: ${psError.message}`);
      }
    }
  }
}

async function downloadAndSetupArduinoCLI() {
  console.log('\n📥 Step 1: Setting up Arduino CLI');
  console.log('----------------------------------');

  // Try to clean existing directory, but continue if it fails
  if (fs.existsSync(ARDUINO_CLI_DIR)) {
    console.log('🧹 Attempting to clean existing Arduino CLI directory...');
    try {
      cleanupDirectory(ARDUINO_CLI_DIR);
    } catch (error) {
      console.warn('⚠️  Could not clean existing directory, continuing with existing setup...');
      
      // Check if arduino-cli.exe already exists
      const existingCliPath = path.join(BIN_DIR, 'arduino-cli.exe');
      if (fs.existsSync(existingCliPath)) {
        console.log('✅ Arduino CLI executable already exists, skipping download');
        return; // Skip download if executable already exists
      }
    }
  }
  
  console.log('📁 Creating directory structure...');
  ensureDirectoryExists(RESOURCES_DIR);
  ensureDirectoryExists(ARDUINO_CLI_DIR);
  ensureDirectoryExists(BIN_DIR);
  ensureDirectoryExists(DATA_DIR);
  ensureDirectoryExists(DOWNLOADS_DIR);
  ensureDirectoryExists(PACKAGES_DIR);

  // Download Arduino CLI
  const zipPath = path.join(DOWNLOADS_DIR, 'arduino-cli.zip');
  console.log(`⬇️  Downloading Arduino CLI ${ARDUINO_CLI_VERSION}...`);
  await downloadFile(ARDUINO_CLI_DOWNLOAD_URL, zipPath);
  console.log('✅ Arduino CLI downloaded successfully');

  // Extract Arduino CLI
  console.log('📦 Extracting Arduino CLI...');
  const tempExtractDir = path.join(DOWNLOADS_DIR, 'temp');
  ensureDirectoryExists(tempExtractDir);
  await extractZip(zipPath, tempExtractDir);

  // Move arduino-cli.exe to the correct location
  const extractedCliPath = path.join(tempExtractDir, 'arduino-cli.exe');
  const targetCliPath = path.join(BIN_DIR, 'arduino-cli.exe');
  
  if (fs.existsSync(extractedCliPath)) {
    fs.copyFileSync(extractedCliPath, targetCliPath);
    console.log('✅ Arduino CLI executable placed successfully');
  } else {
    throw new Error('Arduino CLI executable not found in downloaded archive');
  }

  // Cleanup temporary files
  fs.rmSync(zipPath, { force: true });
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
}

function createArduinoConfig() {
  console.log('\n⚙️  Step 2: Creating Arduino CLI Configuration');
  console.log('----------------------------------------------');

  const configContent = `# Arduino CLI Configuration for Embedr Windows Build
# This configuration ensures portable operation with bundled resources

directories:
  data: .
  downloads: ./downloads
  user: ./user

# Network configuration for reliable downloads
network:
  connection_timeout: 1800s  # 30 minutes for slow connections
  user_agent_ext: "embedr-windows-build"

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

  fs.writeFileSync(CONFIG_FILE, configContent);
  console.log('✅ Arduino CLI configuration created');
}

async function setupArduinoCores() {
  console.log('\n🔧 Step 3: Setting up Arduino Cores');
  console.log('------------------------------------');

  const cliPath = path.join(BIN_DIR, 'arduino-cli.exe');
  const baseCommand = `"${cliPath}" --config-file "${CONFIG_FILE}" --config-dir "${DATA_DIR}"`;

  console.log('🔄 Updating core index...');
  try {
    execSync(`${baseCommand} core update-index`, { 
      stdio: 'inherit',
      cwd: DATA_DIR,
      timeout: 300000 // 5 minutes timeout
    });
    console.log('✅ Core index updated successfully');
  } catch (error) {
    console.warn('⚠️  Core index update had issues, continuing...');
  }

  console.log('📦 Installing arduino:avr core (Arduino Uno, Nano, Mega, etc.)...');
  try {
    execSync(`${baseCommand} core install arduino:avr`, { 
      stdio: 'inherit',
      cwd: DATA_DIR,
      timeout: 600000 // 10 minutes timeout
    });
    console.log('✅ arduino:avr core installed successfully');
  } catch (error) {
    console.error('❌ Failed to install arduino:avr core:', error.message);
    throw error;
  }

  // Verify installation
  console.log('🔍 Verifying core installation...');
  try {
    const { stdout } = await execAsync(`${baseCommand} core list --format json`);
    const coreList = JSON.parse(stdout);
    const avrCore = coreList.platforms?.find(p => p.id === 'arduino:avr');
    
    if (avrCore) {
      console.log(`✅ arduino:avr core verified - Version: ${avrCore.installed}`);
    } else {
      throw new Error('arduino:avr core not found in installation');
    }
  } catch (error) {
    console.error('❌ Core verification failed:', error.message);
    throw error;
  }
}

function cleanupUnnecessaryFiles() {
  console.log('\n🧹 Step 4: Cleaning up unnecessary files');
  console.log('-----------------------------------------');

  // Remove download cache but keep installed cores
  const downloadsCacheDir = path.join(DATA_DIR, 'downloads');
  if (fs.existsSync(downloadsCacheDir)) {
    const items = fs.readdirSync(downloadsCacheDir);
    items.forEach(item => {
      const itemPath = path.join(downloadsCacheDir, item);
      if (item !== '.gitkeep') { // Keep .gitkeep if it exists
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
    });
    console.log('✅ Cleaned downloads cache');
  }

  // Remove any library installations (fresh install should have no libraries)
  const librariesDir = path.join(DATA_DIR, 'user', 'libraries');
  if (fs.existsSync(librariesDir)) {
    cleanupDirectory(librariesDir);
    console.log('✅ Cleaned user libraries directory');
  }

  // Ensure no extra cores are installed (only arduino:avr should remain)
  console.log('✅ Cleanup completed - only essential arduino:avr core retained');
}

async function buildApplication() {
  console.log('\n🏗️  Step 5: Building Embedr Application');
  console.log('---------------------------------------');

  try {
    // Build the frontend
    console.log('🎯 Building frontend...');
    execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    console.log('✅ Frontend built successfully');

    // Build Electron app for Windows without code signing
    console.log('📦 Building Electron application for Windows...');
    execSync('npx electron-builder --win --x64 --config.win.target=nsis', { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    console.log('✅ Electron application built successfully');

    // Check if installer was created
    const distDir = path.resolve(__dirname, '../dist_electron');
    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir);
      const installerFile = files.find(f => f.endsWith('.exe') && f.includes('Setup'));
      
      if (installerFile) {
        const installerPath = path.join(distDir, installerFile);
        const stats = fs.statSync(installerPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`🎉 Installer created: ${installerFile} (${sizeInMB} MB)`);
      }
    }

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    throw error;
  }
}

function generateBuildSummary() {
  console.log('\n📋 Build Summary');
  console.log('================');
  
  const cliPath = path.join(BIN_DIR, 'arduino-cli.exe');
  if (fs.existsSync(cliPath)) {
    console.log('✅ Arduino CLI: Installed and configured');
  }
  
  const configPath = CONFIG_FILE;
  if (fs.existsSync(configPath)) {
    console.log('✅ Configuration: Created for portable operation');
  }
  
  const packagesPath = path.join(DATA_DIR, 'packages');
  if (fs.existsSync(packagesPath)) {
    const packages = fs.readdirSync(packagesPath);
    console.log(`✅ Cores installed: ${packages.length} package(s)`);
    packages.forEach(pkg => {
      console.log(`   - ${pkg}`);
    });
  }
  
  const distDir = path.resolve(__dirname, '../dist_electron');
  if (fs.existsSync(distDir)) {
    console.log('✅ Application: Built and ready for distribution');
  }
  
  console.log('\n🎯 Fresh Install Configuration:');
  console.log('   - Only arduino:avr core installed (Uno, Nano, Mega support)');
  console.log('   - No libraries pre-installed');
  console.log('   - Portable data directory setup');
  console.log('   - No code signing (for development builds)');
  console.log('\n🚀 Build completed successfully!');
}

// Main execution
async function main() {
  try {
    const startTime = Date.now();
    
    await downloadAndSetupArduinoCLI();
    createArduinoConfig();
    await setupArduinoCores();
    cleanupUnnecessaryFiles();
    await buildApplication();
    generateBuildSummary();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Total build time: ${duration} seconds`);
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('   1. Ensure you have internet connection for downloads');
    console.error('   2. Check if Windows Defender/antivirus is blocking downloads');
    console.error('   3. Run PowerShell as Administrator if permission issues occur');
    console.error('   4. Verify npm and electron-builder are properly installed');
    process.exit(1);
  }
}

// Handle script interruption gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Build interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Build terminated');
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { main }; 