const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const baseDir = path.resolve(__dirname);
const binDir = path.join(baseDir, 'bin');
const dataDir = path.join(baseDir, 'data');
const configFile = path.join(dataDir, 'arduino-cli.yaml');

function getCliExecutableName(platform, arch) {
  if (platform === 'win32') {
    return 'arduino-cli.exe';
  } else if (platform === 'darwin') {
    if (arch === 'arm64') {
      return 'arduino-cli-arm64';
    } else if (arch === 'x64') {
      return 'arduino-cli-x64';
    } else {
      console.warn(`Unsupported macOS architecture: ${arch}. Falling back to 'arduino-cli'. Ensure this file exists.`);
      return 'arduino-cli';
    }
  } else if (platform === 'linux') {
    if (arch === 'arm64') {
      return 'arduino-cli-arm64';
    } else if (arch === 'x64') {
      return 'arduino-cli-x64';
    } else {
      console.warn(`Unsupported Linux architecture: ${arch}. Falling back to 'arduino-cli'. Ensure this file exists.`);
      return 'arduino-cli';
    }
  }
  console.error(`Unsupported platform: ${platform}. Cannot determine arduino-cli executable.`);
  process.exit(1);
}

const platform = process.platform;
const arch = process.arch;
const cliExecutable = getCliExecutableName(platform, arch);

let platformSpecificBinDir;
if (platform === 'win32') {
  platformSpecificBinDir = path.join(binDir, 'win');
} else if (platform === 'darwin') {
  platformSpecificBinDir = path.join(binDir, 'mac');
} else {
  platformSpecificBinDir = path.join(binDir, 'linux');
}

const cliPath = path.join(platformSpecificBinDir, cliExecutable);

console.log(`[setup-arduino-cores] Using CLI path: ${cliPath} for platform: ${platform}, arch: ${arch}`);

if (!fs.existsSync(cliPath)) {
  console.error(`ERROR: arduino-cli binary not found at ${cliPath}. Please ensure it has been downloaded and placed correctly for your development OS/architecture.`);
  process.exit(1);
}

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(path.join(dataDir, 'downloads'))) fs.mkdirSync(path.join(dataDir, 'downloads'));
if (!fs.existsSync(path.join(dataDir, 'packages'))) fs.mkdirSync(path.join(dataDir, 'packages'));

if (!fs.existsSync(configFile)) {
  console.error(`ERROR: arduino-cli.yaml not found at ${configFile}. This file is essential.`);
  process.exit(1);
}

const arduinoCliCmd = (command) => {
  const fullCommand = `"${cliPath}" ${command} --config-file "${configFile}" --config-dir "${dataDir}"`;
  console.log(`Executing: ${fullCommand}`);
  try {
    execSync(fullCommand, { stdio: 'inherit', cwd: baseDir, timeout: 600000 });
  } catch (error) {
    console.error(`Error executing: ${fullCommand}`, error);
    process.exit(1);
  }
};

console.log('Updating core index (this will use URLs from arduino-cli.yaml)...');
arduinoCliCmd('core update-index');

console.log('Installing arduino:avr core...');
arduinoCliCmd('core install arduino:avr');

// console.log('Installing esp32:esp32 core (from Espressif)...');
// arduinoCliCmd('core install esp32:esp32');

console.log('Arduino CLI cores setup complete.');
