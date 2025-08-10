# 🚀 **Project Start Guide - TeAlquilamos Bot**

> **Guía completa de inicio rápido para desarrolladores**

## ⚡ **Quick Start (5 minutos)**

### **1. 📋 Prerequisites**
```bash
# Node.js 18+ required
node --version  # Should be 18.x or higher

# Install pnpm (recommended package manager)
npm install -g pnpm

# Verify pnpm installation  
pnpm --version
```

### **2. 🔧 Environment Setup**
```bash
# Clone and setup
git clone <repository-url>
cd Bot-Wsp-Whapi-IA

# Install dependencies
pnpm install

# Create environment file
cp env.example .env

# Edit .env with your API keys
# REQUIRED: OPENAI_API_KEY, WHAPI_TOKEN, ASSISTANT_ID
```

### **3. 🎯 Essential Configuration**

**📄 Edit `.env` file:**
```bash
# 🔑 REQUIRED SECRETS
OPENAI_API_KEY=sk-your-openai-key-here
ASSISTANT_ID=asst_your-assistant-id-here  
WHAPI_TOKEN=your-whapi-token-here

# 🎤 MULTIMEDIA FEATURES (Toggle as needed)
ENABLE_VOICE_TRANSCRIPTION=true
ENABLE_VOICE_RESPONSES=true
ENABLE_IMAGE_PROCESSING=true
ENABLE_REPLY_DETECTION=true
```

### **4. 🚀 Start Development**
```bash
# Start bot in development mode
pnpm run dev

# With ngrok for webhook testing
pnpm run dev:local

# Production simulation
pnpm run dev:cloud
```

---

## 📁 **Project Structure Overview**

```
Bot-Wsp-Whapi-IA/
├── 🚀 PROJECT_START.md           # ← This quick start guide
├── 📖 README.md                  # ← Detailed project documentation
├── ⚙️ package.json               # ← Scripts and dependencies
├── 🐳 Dockerfile                 # ← Container configuration
├── 🔧 tsconfig.json              # ← TypeScript configuration
├── 🌍 env.example                # ← Environment template
│
├── 📁 src/                       # ← Source code
│   ├── app-unified.ts            # Main application entry
│   ├── config/                   # Runtime configurations
│   ├── handlers/                 # AI and message handlers
│   ├── functions/                # OpenAI functions
│   ├── services/                 # Business logic services
│   └── utils/                    # Utilities and helpers
│
├── 📁 config/                    # ← Build & development configs
│   ├── assistant/                # OpenAI assistant config
│   ├── development/              # Dev tools (nodemon, jest)
│   └── build/                    # Build configurations
│
├── 📁 tests/                     # ← Test suite (organized)
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests  
│   ├── functional/               # Functional tests
│   ├── audio/                    # 🎤 Audio testing
│   ├── media/                    # 🖼️ Image testing
│   └── voice/                    # 🎤 Voice testing
│
├── 📁 scripts/                   # ← Development scripts
│   ├── assistant-management/     # OpenAI assistant management
│   ├── voice/                    # 🎤 Voice/audio scripts
│   ├── testing/                  # Test scripts
│   ├── deployment/               # Deploy scripts
│   └── windows/                  # Windows-specific scripts
│
├── 📁 docs/                      # ← Documentation
│   ├── features/                 # Feature documentation
│   ├── architecture/             # System architecture
│   ├── guides/                   # User guides
│   └── rag/                      # RAG context files
│
├── 📁 logs/                      # ← Logging system
│   ├── sessions/current/         # Active session logs
│   ├── sessions/archived/        # Archived logs
│   └── railway/downloads/        # Production logs
│
└── 📁 tmp/                       # ← Temporary files
    ├── audio/                    # 🎤 Voice file cache
    ├── backups/threads/          # Conversation backups
    ├── threads.json              # Current conversation state
    └── threads.json.backup       # Immediate backup
```

---

## 🎯 **Development Workflows**

### **🎤 Multimedia Development (Priority)**
```bash
# Test voice configuration
pnpm run check:voice

# Test audio processing
node tests/audio/test-simple-audio.js

# Test image processing  
node tests/media/test-direct-vision.js

# Voice-to-voice testing
node tests/voice/test-voice-to-voice.mjs
```

### **🤖 AI Assistant Management**
```bash
# Assistant CLI
pnpm run assistant

# Update assistant prompt
node scripts/assistant-management/update-prompt.js

# Add RAG file
node scripts/assistant-management/add-rag-file.js docs/new-context.txt

# Update functions
node scripts/assistant-management/update-functions.js
```

### **🧪 Testing Workflows**
```bash
# Run all tests
pnpm test

# Unit tests only
pnpm run test:unit

# Test specific functionality
node scripts/testing/test-context-direct.js
node scripts/testing/test-reply-detection.js
```

### **🚀 Deployment Workflows**
```bash
# Pre-deployment checks
pnpm run predeploy-checklist

# Build verification
pnpm run build:check

# Environment verification
pnpm run verify

# Full pre-deploy
pnpm run pre-deploy:full
```

---

## 📊 **Available Scripts**

### **🔧 Development**
```bash
pnpm run dev              # Hot reload development
pnpm run dev:local        # Dev + ngrok tunnel
pnpm run dev:cloud        # Production simulation
pnpm run build            # TypeScript compilation
pnpm run start            # Production start
```

### **🧪 Testing**
```bash
pnpm test                 # All tests
pnpm run test:watch       # Watch mode
pnpm run test:coverage    # With coverage
pnpm run test:unit        # Unit tests only
pnpm run test:env         # Environment test
```

### **🤖 Assistant Management**
```bash
pnpm run assistant        # Assistant CLI
pnpm run verify           # Environment verification
pnpm run config           # Show configuration
```

### **🔧 Quality & Maintenance**
```bash
pnpm run lint             # ESLint fix
pnpm run check:types      # TypeScript check
pnpm run check:deps       # Dependency check
pnpm run audit:security   # Security audit
pnpm run clean            # Clean build/temp files
```

---

## 🎯 **Feature Flags (Environment)**

### **🎤 Multimedia Features**
```bash
# Voice processing
ENABLE_VOICE_TRANSCRIPTION=true    # Audio → Text
ENABLE_VOICE_RESPONSES=true        # Text → Audio  

# Image processing
ENABLE_IMAGE_PROCESSING=true       # Image analysis

# Advanced features
ENABLE_REPLY_DETECTION=true        # Reply context
```

### **⚡ Performance Tuning**
```bash
# OpenAI settings
OPENAI_TIMEOUT=45000               # Request timeout
OPENAI_RETRIES=3                   # Retry attempts
CACHE_TTL_SECONDS=3600             # Cache duration

# History settings
HISTORY_INJECT_MONTHS=3            # Context months
HISTORY_MSG_COUNT=200              # Message count
ENABLE_HISTORY_INJECT=true         # Enable injection
```

---

## 🚨 **Common Issues & Solutions**

### **🔧 Environment Issues**
```bash
# Missing API keys
✅ Check .env file exists and has required keys
✅ Verify OPENAI_API_KEY format (sk-...)
✅ Confirm ASSISTANT_ID format (asst_...)

# Port conflicts
✅ Change PORT in .env (default: 3008)
✅ Kill existing processes: lsof -ti:3008 | xargs kill
```

### **🎤 Multimedia Issues**
```bash
# Voice not working
✅ Check WHAPI_TOKEN is valid
✅ Verify ENABLE_VOICE_TRANSCRIPTION=true
✅ Test with: pnpm run check:voice

# Image processing failed
✅ Confirm ENABLE_IMAGE_PROCESSING=true
✅ OpenAI API key needs GPT-4 Vision access
```

### **🤖 Assistant Issues**
```bash
# Assistant not responding
✅ Verify ASSISTANT_ID exists in OpenAI
✅ Check assistant has correct functions
✅ Run: pnpm run assistant status

# Function calling failed
✅ Update functions: node scripts/assistant-management/update-functions.js
✅ Check function registry: pnpm run test:functions
```

---

## 📚 **Next Steps**

### **📖 Documentation**
- Read detailed [README.md](README.md) for complete features
- Check [docs/](docs/) for architecture and guides  
- Review [tests/](tests/) for usage examples

### **🎯 Development Priority**
1. **🎤 Multimedia features** - Voice, audio, image processing
2. **🤖 AI optimization** - Assistant functions and context
3. **🏨 Business logic** - Beds24 integration and reservations
4. **📊 Analytics** - Logging and performance monitoring

---

**🎯 You're ready to start developing!**

Run `pnpm run dev` and start building amazing WhatsApp AI experiences! 🚀