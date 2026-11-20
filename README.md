# 🤖 Anya AI — Autonomous Agentic Virtual Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg)](https://www.python.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Local-47A248.svg)](https://www.mongodb.com/)
[![Ollama](https://img.shields.io/badge/LLM-Ollama%20(Llama%203.1)-black.svg)](https://ollama.ai/)

**Anya AI** is a full-stack, local-first agentic AI desktop assistant featuring an interactive **Live2D animated avatar**, hands-free **wake-word activation**, multimodal **voice synthesis**, autonomous **tool calling**, sandboxed **code execution**, and **RAG (Retrieval-Augmented Generation)** memory.

---

## ✨ Features

### 🎭 Interactive Live2D Avatar
- **Live2D Cubism 4 Integration**: Rendered via Pixi.js with real-time lip-sync, blinking, breathing, and emotional reactivity.
- **Dynamic Expression & Movement**: Reacts to AI conversational state, user voice input, and wake-word triggers.

### 🎙️ Hands-Free Voice Interaction
- **Wake-Word Detection**: "Hey Anya" hands-free trigger powered by **Picovoice Porcupine v4** (WASM) and TensorFlow.js fallback.
- **Speech-to-Text (STT)**: Real-time speech recognition via Web Speech API with pulsing audio indicators.
- **Text-to-Speech (TTS)**: Built-in voice synthesis with customizable pitch, speed, and voice profile selection.

### 🛠️ Agentic Tool Execution Suite
The AI autonomously determines when to invoke specialized tools:
- **💻 Code Runner**: Executes Python and JavaScript code snippets within a sandboxed workspace and returns terminal output.
- **📁 File Manager**: Reads, writes, modifies, and previews workspace files with real-time diffs.
- **🔍 Web Search**: Searches real-time information via web search engines and formats summarized answers.
- **⏰ Clock & Productivity**: Alarms, countdown timers, stopwatch, and to-do lists managed by a dedicated microservice.
- **🌤️ Weather & News**: Real-time city weather forecasts via OpenWeatherMap API and news feeds.
- **🎵 Media & Music Player**: Play YouTube audio/video directly within tool widgets.
- **📐 Unit & Currency Converter**: Instant conversions across physical and digital units.

### 🧠 Local RAG & Long-Term Memory
- **Persistent Vector Database**: Powered by **ChromaDB** running locally with `sentence-transformers/all-MiniLM-L6-v2`.
- **Knowledge Upload**: Supports ingestion of PDFs, Markdown, and text files for document question-answering.
- **Conversational Memory**: Stores user preferences, memories, and multi-turn context in MongoDB.

### 🔐 Authentication & Multi-User Support
- **JWT & Session Management**: Secure user authentication with access tokens and refresh tokens.
- **Social Login**: Google OAuth 2.0 integration.
- **Email OTP Verification**: Two-factor and registration verification via Nodemailer (SMTP).
- **Admin Dashboard**: Dedicated control panel for monitoring active sessions, users, and system status.

---

## 🏛️ System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │                       FRONTEND                         │
               │  • Vanilla JS + Modern Glassmorphism CSS               │
               │  • Pixi.js + Live2D Avatar (Cubism 4)                  │
               │  • Web Speech STT/TTS + Picovoice "Hey Anya" Wake-Word │
               │  • Interactive Tool Modals & Code Diffs                │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                     HTTP / REST
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         │                                                                   │
         ▼                                                                   ▼
┌───────────────────────────────┐                             ┌───────────────────────────────┐
│     NODE.JS MAIN SERVER       │                             │         CLOCK SERVICE         │
│         (Port 5000)           │                             │          (Port 6500)          │
│ • Express + CORS + Rate-Limit │                             │ • Dedicated Timer Engine      │
│ • MongoDB (Users, Chats, Mem) │                             │ • Alarms & Stopwatch Logic    │
│ • Tool Routing & Dispatcher   │                             └───────────────────────────────┘
│ • JWT Auth + Google OAuth     │
└───────────────┬───────────────┘
                │
          Internal REST
                │
                ▼
┌───────────────────────────────┐
│       FASTAPI AI ENGINE       │
│         (Port 8000)           │
│ • Ollama (Llama 3.1:8b)       │
│ • ChromaDB Vector Memory      │
│ • Sentence-Transformers RAG   │
│ • Sandboxed Code Execution    │
└───────────────────────────────┘
```

---

## 📂 Project Structure

```text
my-ai-app/
├── clock-service/           # Dedicated Express service for timers/alarms (Port 6500)
│   ├── server.js
│   └── package.json
├── fastapi-ai/              # Python FastAPI service for AI & RAG (Port 8000)
│   ├── main.py              # LLM inference, ChromaDB, code runner
│   ├── requirements.txt     # Python dependencies
│   └── chroma_db/           # Local vector database storage (git-ignored)
├── frontend/                # Client web application
│   ├── index.html           # Main chat interface
│   ├── admin.html           # Admin dashboard
│   ├── script.js            # Frontend logic & event handling
│   ├── avatar-live2d.js     # Live2D / Pixi.js controller
│   ├── voice.js             # STT, TTS, and wake-word integration
│   ├── hiyori_free_en/      # Live2D Cubism model assets
│   └── *.css                # Glassmorphism styling system
├── node-server/             # Primary backend orchestrator (Port 5000)
│   ├── server.js            # Express application entry point
│   ├── routes/              # Auth, chat, sessions, config, admin routes
│   ├── services/tools/      # Weather, code runner, files, search, music
│   ├── .env.example         # Template for environment secrets
│   └── package.json
├── workspace/               # Local working directory for AI file generation
├── start.bat                # Windows one-click startup script
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [Python](https://www.python.org/) (v3.10 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) (Running locally on `mongodb://127.0.0.1:27017`)
- [Ollama](https://ollama.ai/) with Llama 3.1:
  ```bash
  ollama run llama3.1:8b
  ```

---

### 2. Installation & Setup

#### A. Node.js Backend (`node-server`)
```bash
cd node-server
npm install
cp .env.example .env
```
Open `node-server/.env` and supply your keys:
```env
JWT_SECRET=your_secret_key_here
ADMIN_EMAIL=your_email@example.com
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
PICOVOICE_ACCESS_KEY=your_picovoice_key       # Optional (for wake-word)
OPENWEATHER_API_KEY=your_openweather_key     # Optional (for weather tool)
```

#### B. Clock Service (`clock-service`)
```bash
cd ../clock-service
npm install
```

#### C. FastAPI AI Service (`fastapi-ai`)
```bash
cd ../fastapi-ai
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate
pip install -r requirements.txt
```

---

### 3. Running the Application

#### Option 1: One-Click Launch (Windows)
Double-click `start.bat` in the root folder. It will automatically launch all 4 services in dedicated terminal windows.

#### Option 2: Manual Terminal Launch

| Service | Directory | Command | URL |
| :--- | :--- | :--- | :--- |
| **FastAPI AI** | `fastapi-ai/` | `uvicorn main:app --reload --port 8000` | `http://localhost:8000` |
| **Clock Service** | `clock-service/` | `npm start` | `http://localhost:6500` |
| **Node Server** | `node-server/` | `npm run dev` | `http://localhost:5000` |
| **Frontend** | `frontend/` | `npx serve -l 3000` | `http://localhost:3000` |

Once started, open **`http://localhost:3000`** in your browser (Google Chrome or Microsoft Edge recommended for Web Speech APIs).

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `JWT_SECRET` | Secret key for signing authentication tokens | `anya_secret_key` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/llamaAI` |
| `ADMIN_EMAIL` | Email granted administrator privileges | `admin@example.com` |
| `GOOGLE_OAUTH_CLIENT_ID`| Client ID for Google Identity sign-in | *Optional* |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials for sending OTP emails | *Optional* |
| `PICOVOICE_ACCESS_KEY` | Picovoice key for "Hey Anya" wake word | *Optional* |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key for weather tool | *Optional* |
| `FASTAPI_URL` | Endpoint of the FastAPI AI engine | `http://localhost:8000` |
| `CLOCK_SERVICE_URL` | Endpoint of the Clock microservice | `http://localhost:6500` |

---

## 🛡️ Security Best Practices
- Never commit `.env` files or API credentials to version control.
- Use `node-server/.env.example` as a template for public distribution.
- Code execution tools run commands locally; deploy in containerized sandboxes (e.g., Docker) for untrusted network environments.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
