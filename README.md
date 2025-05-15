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
   npm run electron:build
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

## Contributing

Contributions are welcome! Please:
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/YourIdea`)
3. Commit your changes (`git commit -m "feat: add …"`)
4. Submit a pull request

## License

MIT
