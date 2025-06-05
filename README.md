# Embedr – AI‑Powered Arduino IDE

Embedr is a cross‑platform desktop application that provides a modern, AI‑powered IDE for Arduino development. Built with Electron, Vue 3, and the Arduino CLI (plus esptool.py for ESP boards), Embedr lets you:
  - Create and manage Arduino projects
  - Edit `.ino` sketches in a Monaco‑based code editor
  - Compile and upload to a wide range of Arduino and ESP boards
  - Configure ESP‑specific build & flash settings
  - Browse connected boards and ports
  - View real‑time build output and serial logs
  - Get AI-powered assistance with an integrated Copilot chat
  - Manage Arduino libraries through the integrated Library Manager

## Key Features

- **Project management**: Create, open, and manage your Arduino sketches
- **Advanced code editing**: Monaco Editor with C++/Arduino syntax highlighting
- **Arduino integration**: Compile & upload via Arduino CLI (supporting AVR, SAMD, ESP8266, ESP32, and more)
- **ESP configuration**: ESP‑specific build‑time and flash‑time configuration panels
- **Board detection**: Automatic board detection via Arduino CLI
- **Build diagnostics**: Real‑time build output parsing and diagnostic display
- **Serial monitor**: Live hardware debugging with serial communication
- **AI assistance**: Integrated Copilot chat powered by LLM models (Anthropic, Google Gemini, OpenAI)
- **Library management**: Search, install, and manage Arduino libraries
- **User authentication**: Firebase Authentication for user accounts
- **Version history**: Track and restore previous versions of your code
- **Modern UI**: Built with Vue 3, Vite, TailwindCSS, and shadcn‑ui components

## Prerequisites

- Node.js (v16+) and npm
- Arduino CLI installed and in your `PATH`
- Python 3 with `esptool.py` available in your `PATH` (for ESP boards)
- Firebase account (for authentication) or use the local emulator
- API keys for LLM providers (optional, set in .env file)

### Optional: Install Arduino Cores

```bash
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli core install esp8266:esp8266
arduino-cli core install espressif:esp32
```

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/embedr.git
   cd embedr
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables (for AI features):
   
   Create a `.env` file in the root directory with your API keys:
   ```
   GOOGLE_API_KEY=your_google_api_key
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

4. Launch in development mode with Firebase emulators:

   ```bash
   npm run dev:emulators
   ```

   Or without emulators (using production Firebase):

   ```bash
   npm run electron:dev
   ```

5. Build for production:

   ```bash
   # Standard build (requires arduino-cli to be installed on user's machine)
   npm run electron:build
   
   # Complete build with bundled arduino-cli (recommended)
   ./setup-and-build.sh
   # OR
   npm run build:full
   ```

## Bundled Arduino CLI

For production builds, Embedr bundles arduino-cli and popular board cores for a seamless user experience without requiring users to install arduino-cli separately.

### How it works

1. The `setup-and-build.sh` script:
   - Downloads arduino-cli binaries for Windows, macOS, and Linux
   - Creates proper configuration in `resources/arduino-cli/data`
   - Optionally pre-installs common Arduino cores:
     - arduino:avr (Uno, Nano, Mega, etc.)
     - arduino:samd (MKR, Nano 33 IoT)
     - esp8266:esp8266 (ESP8266 boards)
     - esp32:esp32 (ESP32 boards)
   - Packages everything with your app

2. When running, Embedr:
   - Uses bundled arduino-cli in production mode
   - Falls back to system arduino-cli in development mode
   - Sets up a portable data directory for each user

### Build with bundled arduino-cli

```bash
# Option 1: Interactive script (recommended)
./setup-and-build.sh

# Option 2: Prepare arduino-cli and build separately
npm run prepare-arduino  # Install Arduino cores to resources/arduino-cli/data
npm run electron:build   # Build the application
```

## Application Overview

- **Authentication**: Sign in or create an account to access the application
- **Home**: Create or open an existing project
- **Editor**: Write Arduino code in the Monaco editor (Ctrl+S/Cmd+S to save)
- **Board Management**: Select your target board and serial port
- **Library Manager**: Search and install Arduino libraries
- **Build Tools**: Compile and upload directly from the UI
- **ESP Settings**: Customize ESP-specific configuration
- **Serial Monitor**: View and interact with serial output
- **Copilot Chat**: Get AI assistance for your Arduino projects
- **Version History**: Track and restore previous versions of your code

## Project Structure

```
/   
├─ main.js            # Electron main process & IPC handlers
├─ preload.js         # Secure bridge exposing Electron APIs to the renderer
├─ projects.json      # Recent projects list
├─ src/               # Vue 3 + Vite frontend
│  ├─ main.js         # Vue app entry point
│  ├─ App.vue         # Root component (layout & routing)
│  ├─ components/     # UI components 
│  │  ├─ HomePage.vue        # Project selection/creation
│  │  ├─ EditorPage.vue      # Code editor & board management
│  │  ├─ MonacoEditor.vue    # Monaco-based code editor
│  │  ├─ SerialMonitor.vue   # Serial communication interface
│  │  ├─ CopilotChat.vue     # AI assistant interface
│  │  ├─ AuthPage.vue        # Authentication
│  │  ├─ ToolExecution.vue   # AI tool execution display
│  │  └─ ui/                 # Shadcn UI components
│  ├─ router/         # Vue router configuration
│  ├─ firebase/       # Firebase configuration
│  ├─ composables/    # Vue composables
│  ├─ lib/            # Helper utilities
│  ├─ main/           # Main process code
│  ├─ assets/         # Static assets
│  └─ index.css       # Tailwind & global styles
├─ functions/         # Firebase Cloud Functions
├─ public/            # Static files
├─ dist/              # Vite build output
├─ dist_electron/     # Electron build output
├─ docs/              # Documentation
└─ configuration files # Various config files
```

## Data Storage

- **Projects**: Metadata in `projects.json`, projects in `~/EmbedrProjects/<projectName>/`
- **ESP settings**: Board-specific configuration in `~/.embedr/esp_settings.json`
- **Chat history**: Stored per project
- **Version history**: Code snapshots saved per project

## Firebase Integration

The application uses Firebase for:
- User authentication
- Cloud Functions for secure LLM API proxying (optional)

## Firebase IAM Permissions Setup

### Fixing the `generateAuthRedirectToken` Function IAM Error

If you encounter the error: `Permission 'iam.serviceAccounts.signBlob' denied on resource`, you need to grant the required IAM permissions to your Firebase service account.

#### Option 1: Using Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Set your project** (replace `your-project-id` with your actual Firebase project ID):
   ```bash
   firebase use your-project-id
   ```

4. **Deploy the functions with automatic IAM setup**:
   ```bash
   firebase deploy --only functions
   ```

#### Option 2: Using Google Cloud Console

1. **Go to Google Cloud Console IAM**:
   - Visit: https://console.cloud.google.com/iam-admin/iam
   - Select your Firebase project

2. **Find your Firebase service account**:
   - Look for an account ending with `@your-project-id.iam.gserviceaccount.com`
   - Usually named: `firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com`

3. **Edit the service account**:
   - Click the edit (pencil) icon next to the service account
   - Click "ADD ANOTHER ROLE"

4. **Add the required role**:
   - Search for "Service Account Token Creator"
   - Select "Service Account Token Creator" role
   - Click "SAVE"

#### Option 3: Using Google Cloud CLI

```bash
# Replace YOUR_PROJECT_ID with your actual Firebase project ID
PROJECT_ID="YOUR_PROJECT_ID"

# Get the service account email
SERVICE_ACCOUNT=$(gcloud iam service-accounts list --filter="displayName:firebase-adminsdk" --format="value(email)" --project=$PROJECT_ID)

# Grant the Service Account Token Creator role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/iam.serviceAccountTokenCreator"
```

#### Verification

After setting up the permissions:

1. **Redeploy your functions**:
   ```bash
   firebase deploy --only functions:generateAuthRedirectToken
   ```

2. **Test the subscription portal redirect** in your application

### Troubleshooting

- **Error persists**: Wait 5-10 minutes for IAM changes to propagate
- **Multiple service accounts**: Ensure you're modifying the correct `firebase-adminsdk` service account
- **Still having issues**: Check the [Firebase documentation](https://firebase.google.com/docs/auth/admin/create-custom-tokens) for the latest requirements

## Contributing

Contributions are welcome! Please:
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/YourIdea`)
3. Commit your changes (`git commit -m "feat: add …"`)
4. Submit a pull request

## License

MIT
