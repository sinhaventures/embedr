# Embedr – Your Arduino Copilot

<!-- Add your app screenshot here -->
![Embedr Screenshot](https://firebasestorage.googleapis.com/v0/b/emdedr-822d0.firebasestorage.app/o/ss%2FScreenshot%202025-06-13%20at%206.35.27%E2%80%AFAM.png?alt=media&token=29f9236c-d11b-476f-861b-e0df8f385ebd)

> A modern, AI-powered desktop IDE for Arduino development that makes embedded programming accessible and intelligent.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Electron](https://img.shields.io/badge/Electron-29.1.0-blue.svg)](https://electronjs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5.13-green.svg)](https://vuejs.org/)
[![Arduino CLI](https://img.shields.io/badge/Arduino%20CLI-bundled-orange.svg)](https://arduino.github.io/arduino-cli/)

## ✨ Features

### 🤖 AI-Powered Development
- **Intelligent Copilot Chat**: Get real-time assistance from the Gemini 2.5 Flash AI model, with a "Bring Your Own Key" feature coming soon to support other LLMs.
- **Smart Code Generation**: Describe your project and let AI create Arduino sketches for you
- **Error Analysis**: AI automatically suggests fixes for compilation errors
- **Visual Project Creation**: Attach images to describe what you want to build
- **Code Completion**: Monaco Pilot integration for intelligent code suggestions

### 🔧 Comprehensive Arduino Support
- **Universal Board Support**: Arduino Uno, Nano, ESP32, ESP8266, SAMD, and many more
- **Bundled Arduino CLI**: No separate installation required - everything works out of the box
- **Board Auto-Detection**: Automatically detects connected Arduino boards
- **ESP Configuration**: Advanced ESP32/ESP8266 build and flash settings
- **Custom Board URLs**: Support for third-party board packages
- **Advanced Code Editor**: VS Code-quality editing experience with syntax highlighting, C++/Arduino Syntax, Code Formatting, Multi-file Projects, and Live Error Detection.
- **Library Management**: Integrated Library Manager for searching, installing, and managing thousands of Arduino libraries, with Version Control, Custom Installation, Library Search, and Update Management.
- **Project Management**: Visual Project Browser with beautiful project cards, Recent Projects, Project Templates, Project Renaming, and Smart Search.
- **Development Tools**: One-Click Compile & Upload, Real-time Serial Monitor, Build Diagnostics, Version History, and Auto-save.
- **Embedr Agent**: Project-Aware Conversations where AI knows your current project context, Multi-threaded Chats, Tool Integration (AI can compile, upload, and modify code directly), Chat History, and Image Support.
- **User Experience**: Firebase Authentication for secure user accounts and data sync, Dark Mode Interface, Cross-Platform compatibility, Keyboard Shortcuts, and Responsive UI.

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Arduino CLI** (bundled in production builds)
- **Python 3** with `esptool.py` (for ESP boards)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/embedr-app.git
   cd embedr-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional, for AI features)
   
   Create a `.env` file in the root directory:
   ```env
   GOOGLE_API_KEY=your_google_api_key
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

4. **Launch in development mode**
   ```bash
   # With Firebase emulators (recommended for development)
   npm run dev:emulators
   
   # Or without emulators
   npm run electron:dev
   ```

5. **Build for production**
   ```bash
   # Complete build with bundled Arduino CLI (recommended)
   npm run build:full
   
   # Or standard build (requires arduino-cli on user's machine)
   npm run electron:build
   ```

## 🏗️ Project Structure

```
embedr-app/
├── src/                          # Vue 3 frontend application
│   ├── components/              # UI components
│   │   ├── HomePage.vue        # Project management & AI creation
│   │   ├── EditorPage.vue      # Main IDE interface
│   │   ├── MonacoEditor.vue    # Code editor component
│   │   ├── CopilotChat.vue     # AI assistant interface
│   │   ├── SerialMonitor.vue   # Hardware debugging
│   │   ├── LibraryManagerModal.vue # Library management
│   │   ├── VersionHistoryModal.vue # Code versioning
│   │   └── ui/                 # Shadcn UI components
│   ├── router/                 # Vue Router configuration
│   ├── composables/           # Vue composition functions
│   ├── lib/                   # Utility libraries
│   └── assets/                # Static assets
├── main.js                    # Electron main process
├── preload.js                 # Secure IPC bridge
├── agent-tools.js            # AI agent tools for Arduino CLI
├── resources/                # Bundled Arduino CLI & cores
├── functions/                # Firebase Cloud Functions
├── public/                   # Static files
└── dist_electron/           # Production builds
```

## 🛡️ Firebase Setup

### Authentication Configuration

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication with your preferred providers
3. Add your domain to authorized domains
4. Copy configuration to your `.env` file

### Cloud Functions (Optional)

For secure API key management, deploy the included Cloud Functions:

```bash
firebase deploy --only functions
```

### IAM Permissions

Grant the Firebase service account necessary permissions:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:firebase-adminsdk-xxxxx@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountTokenCreator"
```

## 🎯 Development

### Development Scripts

```bash
npm run dev                    # Vite dev server only
npm run electron:dev          # Full Electron development
npm run dev:emulators         # With Firebase emulators
npm run build                 # Build frontend only
npm run electron:build        # Build Electron app
npm run build:full           # Complete build with Arduino CLI
npm run prepare-arduino       # Setup Arduino cores
```

### Build Configuration

The app supports multiple build configurations:

- **Standard Build**: Requires Arduino CLI installation
- **Complete Build**: Bundles Arduino CLI and cores
- **Platform-Specific**: Windows, macOS, Linux builds
- **Architecture Support**: x64, ARM64, ia32

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines

- Follow Vue 3 Composition API patterns
- Use TypeScript for type safety
- Maintain consistent code formatting
- Add unit tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License**.

**You are free to:**
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

**Under the following terms:**
- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- **NonCommercial** — You may not use the material for commercial purposes

For commercial licensing options, please contact us at [contact@embedr.cc](mailto:contact@embedr.cc).

[![License: CC BY-NC 4.0](https://licensebuttons.net/l/by-nc/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc/4.0/)

## 📧 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/sinhaventures/embedr/issues)
- **Email**: [support@embedr.cc](mailto:support@embedr.cc)

## 🙏 Acknowledgments

- Arduino team for the excellent Arduino CLI
- Microsoft for Monaco Editor
- The Vue.js community
- All open-source contributors

---

Made with ❤️ for the Arduino community
