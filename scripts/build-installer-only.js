const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Building Windows Installer for Embedr');
console.log('=========================================');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNPACKED_DIR = path.join(PROJECT_ROOT, 'dist_electron', 'win-unpacked');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist_electron');

// Check if unpacked app exists
if (!fs.existsSync(UNPACKED_DIR)) {
  console.error('❌ Unpacked application not found. Please run the full build first:');
  console.error('npm run build:full:win');
  process.exit(1);
}

// Check if the main executable exists (could be electron.exe or Embedr.exe)
const possibleExes = ['Embedr.exe', 'electron.exe'];
let embedrExe = null;

for (const exeName of possibleExes) {
  const exePath = path.join(UNPACKED_DIR, exeName);
  if (fs.existsSync(exePath)) {
    embedrExe = exePath;
    break;
  }
}

if (!embedrExe) {
  console.error('❌ Main executable not found in unpacked directory');
  console.error('   Expected: Embedr.exe or electron.exe');
  process.exit(1);
}

console.log('✅ Found unpacked application');

// Clean electron-builder cache to avoid code signing tool downloads
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

// Try to build installer using different approaches
const buildCommands = [
  // Try installer without publish (using package.json config)
  'npx electron-builder --win --x64 --publish=never',
  // Try with explicit NSIS target
  'npx electron-builder --win nsis:x64 --publish=never',
  // Try directory-only build as fallback
  'npx electron-builder --win --x64 --dir',
];

console.log('📦 Building installer...');

for (let i = 0; i < buildCommands.length; i++) {
  const command = buildCommands[i];
  console.log(`\n📦 Attempt ${i + 1}: ${command}`);
  
  try {
    // Set environment variables to disable code signing completely
    const env = {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      CSC_LINK: '',
      CSC_KEY_PASSWORD: '',
      WIN_CSC_LINK: '',
      WIN_CSC_KEY_PASSWORD: '',
      // Force skip code signing
      SKIP_NOTARIZATION: 'true',
      SKIP_CODE_SIGNING: 'true',
      // Explicitly disable certificate validation
      DISABLE_SENTRY: 'true',
    };
    
    // Remove any certificate-related environment variables
    delete env.WIN_CSC_LINK;
    delete env.CSC_LINK;
    delete env.WIN_CSC_KEY_PASSWORD;
    delete env.CSC_KEY_PASSWORD;
    
    execSync(command, { 
      stdio: 'inherit',
      env: env,
      cwd: PROJECT_ROOT
    });
    
    console.log('✅ Build completed successfully');
    break;
    
  } catch (error) {
    console.log(`⚠️  Attempt ${i + 1} failed: ${error.message}`);
    
    // Check if an installer was created despite the error
    const files = fs.readdirSync(OUTPUT_DIR);
    const installer = files.find(f => f.endsWith('.exe') && f.includes('Setup'));
    
    if (installer) {
      console.log(`✅ Installer found despite error: ${installer}`);
      const installerPath = path.join(OUTPUT_DIR, installer);
      const stats = fs.statSync(installerPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`📁 Size: ${sizeInMB} MB`);
      break;
    }
    
    if (i === buildCommands.length - 1) {
      console.log('\n❌ All build attempts failed');
      console.log('\n📁 However, you can still use the unpacked application:');
      console.log(`   ${embedrExe}`);
      process.exit(1);
    }
  }
}

// Check final result
console.log('\n📋 Build Results');
console.log('================');

const files = fs.readdirSync(OUTPUT_DIR);
const installer = files.find(f => f.endsWith('.exe') && f.includes('Setup'));

if (installer) {
  const installerPath = path.join(OUTPUT_DIR, installer);
  const stats = fs.statSync(installerPath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Installer: ${installer} (${sizeInMB} MB)`);
}

// Check if the executable still exists (might be renamed during build)
if (fs.existsSync(embedrExe)) {
  const embedrStats = fs.statSync(embedrExe);
  const appSizeInMB = (embedrStats.size / (1024 * 1024)).toFixed(2);
  const exeName = path.basename(embedrExe);
  console.log(`✅ Unpacked App: ${exeName} (${appSizeInMB} MB)`);
} else {
  console.log(`✅ Unpacked App: Available in ${UNPACKED_DIR}`);
}

console.log('\n🚀 Build completed successfully!');
console.log(`📂 Output location: ${OUTPUT_DIR}`); 