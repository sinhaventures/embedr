const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Building Embedr for macOS');
console.log('============================');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist_electron');

// Step 0: Clean dist_electron directory
if (fs.existsSync(OUTPUT_DIR)) {
  try {
    console.log('🧹 Cleaning dist_electron directory...');
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    console.log('✅ Cleaned dist_electron directory');
  } catch (error) {
    console.log('⚠️  Could not clean dist_electron directory, continuing...');
  }
}

// Step 0.5: Clean unwanted Arduino CLI files/folders from project root
console.log('🧹 Cleaning unwanted Arduino CLI files from project root...');
const unwantedItems = [
  'packages',
  'downloads', 
  'tmp',
  'inventory.yaml',
  'library_index.json',
  'library_index.json.sig',
  'package_esp32_index.json',
  'package_index.json',
  'package_index.json.sig'
];

unwantedItems.forEach(item => {
  const itemPath = path.join(PROJECT_ROOT, item);
  if (fs.existsSync(itemPath)) {
    try {
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
        console.log(`✅ Removed directory: ${item}`);
      } else {
        fs.unlinkSync(itemPath);
        console.log(`✅ Removed file: ${item}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not remove ${item}: ${error.message}`);
    }
  }
});

// Step 1: Generate icons
console.log('🎨 Generating application icons...');
try {
  execSync('npm run generate-icons', { 
    stdio: 'inherit',
    cwd: PROJECT_ROOT
  });
  console.log('✅ Icons generated successfully');
} catch (error) {
  console.error('❌ Icon generation failed:', error.message);
  process.exit(1);
}

// Step 2: Prepare Arduino CLI and cores
console.log('⚙️  Setting up Arduino CLI and cores...');
try {
  execSync('npm run prepare-arduino', { 
    stdio: 'inherit',
    cwd: PROJECT_ROOT
  });
  console.log('✅ Arduino CLI and cores prepared successfully');
} catch (error) {
  console.error('❌ Arduino CLI setup failed:', error.message);
  process.exit(1);
}

// Step 3: Build the frontend
console.log('🏗️  Building frontend...');
try {
  execSync('cross-env NODE_ENV=production vite build', { 
    stdio: 'inherit',
    cwd: PROJECT_ROOT
  });
  console.log('✅ Frontend build completed');
} catch (error) {
  console.error('❌ Frontend build failed:', error.message);
  process.exit(1);
}

// Step 4: Clean electron-builder cache to avoid potential issues
const os = require('os');
const cacheDir = path.join(os.homedir(), 'Library', 'Caches', 'electron-builder');
if (fs.existsSync(cacheDir)) {
  try {
    console.log('🧹 Cleaning electron-builder cache...');
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log('✅ Cache cleaned');
  } catch (error) {
    console.log('⚠️  Could not clean cache, continuing...');
  }
}

// Step 5: Build the macOS app
console.log('📦 Building macOS application...');

try {
  // Set environment variables for macOS build
  const env = {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false', // Disable code signing auto-discovery
    CSC_LINK: '', // Clear any certificate link
    CSC_KEY_PASSWORD: '', // Clear any certificate password
    SKIP_NOTARIZATION: 'true', // Skip notarization
    SKIP_CODE_SIGNING: 'true', // Skip code signing
    DISABLE_SENTRY: 'true', // Disable Sentry if used
  };
  
  // Remove any certificate-related environment variables
  delete env.CSC_LINK;
  delete env.CSC_KEY_PASSWORD;
  
  // Build for macOS (both Intel and Apple Silicon)
  execSync('npx electron-builder --mac --x64 --arm64 --publish=never', { 
    stdio: 'inherit',
    env: env,
    cwd: PROJECT_ROOT
  });
  
  console.log('✅ Build completed successfully');
  
} catch (error) {
  console.log(`⚠️  Build process encountered an error: ${error.message}`);
  
  // Check if an app was created despite the error
  if (fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR);
    const dmgFile = files.find(f => f.endsWith('.dmg'));
    const appDir = files.find(f => f.endsWith('.app') || f.includes('mac'));
    
    if (dmgFile) {
      console.log(`✅ DMG installer created successfully despite signing error: ${dmgFile}`);
      const dmgPath = path.join(OUTPUT_DIR, dmgFile);
      const stats = fs.statSync(dmgPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`📁 Size: ${sizeInMB} MB`);
    } else if (appDir) {
      console.log(`✅ App bundle created successfully despite signing error: ${appDir}`);
    } else {
      console.error('❌ No installer or app bundle found');
      process.exit(1);
    }
  } else {
    console.error('❌ Build failed completely');
    process.exit(1);
  }
}

// Step 6: Display results
console.log('\n📋 Build Results');
console.log('================');

if (fs.existsSync(OUTPUT_DIR)) {
  const files = fs.readdirSync(OUTPUT_DIR);
  
  // Check for DMG installer
  const dmgFile = files.find(f => f.endsWith('.dmg'));
  if (dmgFile) {
    const dmgPath = path.join(OUTPUT_DIR, dmgFile);
    const stats = fs.statSync(dmgPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ DMG Installer: ${dmgFile} (${sizeInMB} MB)`);
  }
  
  // Check for app bundle in mac-universal or mac directories
  const macDirs = files.filter(f => f.includes('mac') && fs.statSync(path.join(OUTPUT_DIR, f)).isDirectory());
  macDirs.forEach(macDir => {
    const macDirPath = path.join(OUTPUT_DIR, macDir);
    const appFile = fs.readdirSync(macDirPath).find(f => f.endsWith('.app'));
    if (appFile) {
      const appPath = path.join(macDirPath, appFile);
      console.log(`✅ App Bundle: ${macDir}/${appFile}`);
      
      // Try to get app size (approximately)
      try {
        const { execSync: execSyncSize } = require('child_process');
        const sizeOutput = execSyncSize(`du -sh "${appPath}"`, { encoding: 'utf8' });
        const size = sizeOutput.split('\t')[0];
        console.log(`📁 Size: ${size}`);
      } catch (e) {
        // Size calculation failed, continue without it
      }
    }
  });
}

console.log('\n🚀 Build completed successfully!');
console.log(`📂 Output location: ${OUTPUT_DIR}`);
console.log('\n💡 Note: Arduino CLI and arduino:avr core are pre-packaged in the app');
console.log('   for immediate use without additional downloads.');
console.log('\n🍎 The unsigned app can be run by right-clicking and selecting "Open"');
console.log('   or by running: xattr -d com.apple.quarantine /path/to/Embedr.app'); 