const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Building Embedr for Windows');
console.log('===============================');

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

// Step 4: Clean electron-builder cache to avoid code signing issues
const cacheDir = path.join(require('os').homedir(), 'AppData', 'Local', 'electron-builder', 'Cache');
if (fs.existsSync(cacheDir)) {
  try {
    console.log('🧹 Cleaning electron-builder cache...');
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log('✅ Cache cleaned');
  } catch (error) {
    console.log('⚠️  Could not clean cache, continuing...');
  }
}

// Step 5: Build the installer
console.log('📦 Building Windows installer...');

try {
  // Set environment variables to disable code signing completely
  const env = {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    CSC_LINK: '',
    CSC_KEY_PASSWORD: '',
    WIN_CSC_LINK: '',
    WIN_CSC_KEY_PASSWORD: '',
    SKIP_NOTARIZATION: 'true',
    SKIP_CODE_SIGNING: 'true',
    DISABLE_SENTRY: 'true',
  };
  
  // Remove any certificate-related environment variables
  delete env.WIN_CSC_LINK;
  delete env.CSC_LINK;
  delete env.WIN_CSC_KEY_PASSWORD;
  delete env.CSC_KEY_PASSWORD;
  
  execSync('npx electron-builder --win --x64 --publish=never', { 
    stdio: 'inherit',
    env: env,
    cwd: PROJECT_ROOT
  });
  
  console.log('✅ Build completed successfully');
  
} catch (error) {
  console.log(`⚠️  Build process encountered an error: ${error.message}`);
  
  // Check if an installer was created despite the error
  if (fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR);
    const installer = files.find(f => f.endsWith('.exe') && f.includes('Setup'));
    
    if (installer) {
      console.log(`✅ Installer created successfully despite signing error: ${installer}`);
      const installerPath = path.join(OUTPUT_DIR, installer);
      const stats = fs.statSync(installerPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`📁 Size: ${sizeInMB} MB`);
    } else {
      console.error('❌ No installer found');
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
  const installer = files.find(f => f.endsWith('.exe') && f.includes('Setup'));
  
  if (installer) {
    const installerPath = path.join(OUTPUT_DIR, installer);
    const stats = fs.statSync(installerPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Installer: ${installer} (${sizeInMB} MB)`);
  }
  
  // Check for unpacked app
  const unpackedDir = path.join(OUTPUT_DIR, 'win-unpacked');
  if (fs.existsSync(unpackedDir)) {
    const embedrExe = path.join(unpackedDir, 'Embedr.exe');
    if (fs.existsSync(embedrExe)) {
      const embedrStats = fs.statSync(embedrExe);
      const appSizeInMB = (embedrStats.size / (1024 * 1024)).toFixed(2);
      console.log(`✅ Unpacked App: Embedr.exe (${appSizeInMB} MB)`);
    }
  }
}

console.log('\n🚀 Build completed successfully!');
console.log(`📂 Output location: ${OUTPUT_DIR}`);
console.log('\n💡 Note: Arduino CLI and arduino:avr core are pre-packaged in the installer');
console.log('   for immediate use without additional downloads.'); 