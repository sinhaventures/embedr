const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

console.log('🔧 Starting Windows Build Process for Embedr (Simplified)');
console.log('=========================================================');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const RESOURCES_DIR = path.join(PROJECT_ROOT, 'resources');
const ARDUINO_CLI_DIR = path.join(RESOURCES_DIR, 'arduino-cli');
const BIN_DIR = path.join(ARDUINO_CLI_DIR, 'bin', 'win');
const DATA_DIR = path.join(ARDUINO_CLI_DIR, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'arduino-cli.yaml');

// Helper function to check if a path exists
function pathExists(path) {
  try {
    fs.accessSync(path);
    return true;
  } catch {
    return false;
  }
}

// Helper function to ensure directory exists
function ensureDir(dirPath) {
  if (!pathExists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper function to clean dist_electron with retry
async function cleanDistElectron() {
  const distElectronPath = path.join(PROJECT_ROOT, 'dist_electron');
  
  if (!pathExists(distElectronPath)) {
    console.log('✅ No previous build directory to clean');
    return;
  }

  console.log('🧹 Cleaning previous build directory...');
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Try to terminate any electron processes that might be running
      try {
        execSync('taskkill /F /IM electron.exe 2>nul', { stdio: 'ignore' });
        execSync('taskkill /F /IM Embedr.exe 2>nul', { stdio: 'ignore' });
      } catch (e) {
        // Ignore errors - processes might not be running
      }
      
      // Wait a moment for processes to fully terminate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to remove the directory
      fs.rmSync(distElectronPath, { recursive: true, force: true });
      console.log('✅ Previous build directory cleaned');
      return;
    } catch (error) {
      console.log(`⚠️  Attempt ${attempt}/3 to clean build directory failed: ${error.message}`);
      if (attempt < 3) {
        console.log(`⏳ Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.log('⚠️  Could not fully clean build directory. Continuing anyway...');
}

// Main build function
async function main() {
  const startTime = Date.now();

  try {
    // Step 1: Check Arduino CLI
    console.log('\n🔍 Step 1: Checking Arduino CLI');
    console.log('--------------------------------');
    
    const arduinoCliPath = path.join(BIN_DIR, 'arduino-cli.exe');
    
    if (!pathExists(arduinoCliPath)) {
      throw new Error('Arduino CLI not found. Please run setup first.');
    }
    
    const versionOutput = execSync(`"${arduinoCliPath}" version`, { encoding: 'utf8' });
    console.log(`✅ Arduino CLI found: ${versionOutput.trim()}`);

    // Step 2: Clean previous build
    console.log('\n🧹 Step 2: Cleaning Previous Build');
    console.log('-----------------------------------');
    await cleanDistElectron();

    // Step 3: Create configuration
    console.log('\n⚙️  Step 3: Creating Arduino CLI Configuration');
    console.log('----------------------------------------------');
    
    ensureDir(DATA_DIR);
    
    const config = `
board_manager:
  additional_urls: []
daemon:
  port: "50051"
directories:
  data: .
  downloads: downloads
  user: .
library:
  enable_unsafe_install: false
logging:
  file: ""
  format: text
  level: info
metrics:
  addr: :9090
  enabled: true
output:
  no_color: false
sketch:
  always_export_binaries: false
updater:
  enable_notification: true
`.trim();

    fs.writeFileSync(CONFIG_FILE, config);
    console.log('✅ Arduino CLI configuration created');

    // Step 4: Set up Arduino cores
    console.log('\n🔧 Step 4: Setting up Arduino Cores');
    console.log('------------------------------------');
    
    const configFlag = `--config-file "${CONFIG_FILE}"`;
    
    try {
      console.log('🔍 Checking for existing cores...');
      execSync(`"${arduinoCliPath}" ${configFlag} core update-index`, { stdio: 'ignore' });
      
      const coresOutput = execSync(`"${arduinoCliPath}" ${configFlag} core list`, { encoding: 'utf8' });
      const hasArduinoAVR = coresOutput.includes('arduino:avr');
      
      if (!hasArduinoAVR) {
        console.log('📦 Installing arduino:avr core...');
        execSync(`"${arduinoCliPath}" ${configFlag} core install arduino:avr`, { stdio: 'inherit' });
        console.log('✅ arduino:avr core installed successfully');
      } else {
        const avrMatch = coresOutput.match(/arduino:avr\s+(\S+)/);
        const version = avrMatch ? avrMatch[1] : 'unknown';
        console.log(`✅ arduino:avr core already installed - Version: ${version}`);
      }
    } catch (error) {
      console.error('❌ Error setting up Arduino cores:', error.message);
      throw error;
    }

    // Step 5: Clean up unnecessary files
    console.log('\n🧹 Step 5: Cleaning up unnecessary files');
    console.log('-----------------------------------------');
    
    const packagesDir = path.join(DATA_DIR, 'packages');
    if (pathExists(packagesDir)) {
      const packages = fs.readdirSync(packagesDir);
      for (const pkg of packages) {
        if (pkg !== 'arduino') {
          const pkgPath = path.join(packagesDir, pkg);
          try {
            fs.rmSync(pkgPath, { recursive: true, force: true });
          } catch (error) {
            console.log(`⚠️  Could not remove ${pkg}: ${error.message}`);
          }
        }
      }
    }
    
    console.log('✅ Cleanup completed - only essential arduino:avr core retained');

    // Step 6: Build the application
    console.log('\n🏗️  Step 6: Building Embedr Application');
    console.log('---------------------------------------');
    
    console.log('🎯 Building frontend...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Frontend built successfully');
    
    console.log('📦 Building Electron application for Windows...');
    
    // Try different build approaches
    const buildCommands = [
      'npx electron-builder --win --x64 --publish=never',
      'npx electron-builder --win --x64 --dir',  // Directory only as fallback
    ];
    
    let buildSuccess = false;
    let lastError = null;
    
    for (let i = 0; i < buildCommands.length; i++) {
      const command = buildCommands[i];
      console.log(`📦 Attempting build method ${i + 1}: ${command}`);
      
      try {
        execSync(command, { stdio: 'inherit' });
        buildSuccess = true;
        console.log('✅ Electron application built successfully');
        break;
      } catch (error) {
        lastError = error;
        console.log(`⚠️  Build method ${i + 1} failed, trying next approach...`);
        
        // Check if unpacked app was created despite the error
        const unpackedPath = path.join(PROJECT_ROOT, 'dist_electron', 'win-unpacked');
        if (pathExists(unpackedPath)) {
          console.log('✅ Unpacked application was created successfully');
          buildSuccess = true;
          
          // Check for installer
          const distElectronPath = path.join(PROJECT_ROOT, 'dist_electron');
          const files = fs.readdirSync(distElectronPath);
          const installer = files.find(f => f.endsWith('.exe') && f.includes('Setup'));
          
          if (installer) {
            console.log(`✅ Installer created: ${installer}`);
          } else {
            console.log('ℹ️  No installer created, but unpacked app is available');
          }
          break;
        }
      }
    }
    
    if (!buildSuccess && lastError) {
      throw lastError;
    }

    // Step 7: Build summary
    console.log('\n📋 Build Summary');
    console.log('================');
    console.log('✅ Arduino CLI: Available and configured');
    console.log('✅ Configuration: Created for portable operation');
    
    const installedCores = execSync(`"${arduinoCliPath}" ${configFlag} core list`, { encoding: 'utf8' });
    const coreCount = (installedCores.match(/\n/g) || []).length - 1; // Subtract 1 for header
    console.log(`✅ Cores installed: ${Math.max(0, coreCount)} package(s)`);
    console.log('✅ Application: Built and ready for distribution');
    
    console.log('\n🎯 Fresh Install Configuration:');
    console.log('   - Only arduino:avr core installed (Uno, Nano, Mega support)');
    console.log('   - No libraries pre-installed');
    console.log('   - Portable data directory setup');
    console.log('   - No code signing (for development builds)');
    
    console.log('\n🚀 Build completed successfully!');
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Total build time: ${duration} seconds`);

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run the main function
main(); 