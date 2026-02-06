# CX Agent Studio - Multi-Channel Integrations

Deploy your [CX Agent Studio](https://cloud.google.com/customer-engagement-ai/conversational-agents) conversational AI agents across multiple messaging platforms with production-ready integrations.

![Channels Overview](https://img.shields.io/badge/Channels-7-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933)
![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB)

## 🚀 Supported Channels

| Channel | Status | Language | Docs |
|---------|--------|----------|------|
| 💬 [WhatsApp Business](#whatsapp) | ✅ Ready | Node.js | [README](./whatsapp/README.md) |
| 💼 [Slack](#slack) | ✅ Ready | Python | [README](./slack/README.md) |
| 📱 [Telegram](#telegram) | ✅ Ready | Python | [README](./telegram/README.md) |
| 🎮 [Discord](#discord) | ✅ Ready | Node.js | [README](./discord/README.md) |
| 💬 [Google Chat](#google-chat) | ✅ Ready | Node.js | [README](./google-chat/README.md) |
| 🎥 [Zoom](#zoom) | ✅ Ready | Node.js | [README](./zoom/README.md) |
| 👥 Microsoft Teams | 🚧 Coming Soon | - | - |

## 📋 Overview

This repository provides production-ready integrations to connect your CX Agent Studio conversational AI agents with popular messaging platforms. Each integration handles:

- **Webhook Management** - Receives and processes incoming messages
- **Message Formatting** - Translates between platform-specific formats and CX Agent Studio
- **Session Management** - Maintains conversation context per user
- **Rich Media Support** - Handles images, documents, buttons, and interactive elements
- **Easy Deployment** - Docker, Cloud Run, and Cloud Functions support

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Messaging Platforms                          │
├─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┤
│WhatsApp │  Slack  │Telegram │ Discord │ G-Chat  │  Zoom   │  Teams  │
└────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘
     │         │         │         │         │         │         │
     ▼         ▼         ▼         ▼         ▼         ▼         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Channel Integration Layer                         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  • Webhook Handlers  • Message Parsing  • Session Management    │ │
│  │  • Rich Media        • Platform Auth    • Error Handling        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     CX Agent Studio API                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  runSession() - Send user messages and receive agent responses  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Your CX Agent Studio Agent                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌──────────────────┐ │
│  │  Playbooks        │  │  Data Stores      │  │  Tools           │ │
│  └───────────────────┘  └───────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## 🛠️ Prerequisites

1. **Google Cloud Project** with CX Agent Studio enabled
2. **CX Agent Studio Application** with configured agent
3. **Service Account** with `roles/dialogflow.client` permission
4. **Platform Developer Account** (Meta, Slack, Telegram, Discord, etc.)

## 📦 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Yash-Kavaiya/cx-agent-studio-channels.git
cd cx-agent-studio-channels
```

### 2. Choose Your Channel

Navigate to the channel folder you want to set up:

```bash
cd whatsapp  # or slack, telegram, discord, google-chat, zoom
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Run with Docker

```bash
docker-compose up -d
```

Or deploy to Cloud Run (see channel-specific docs).

---

## 📱 Channel Details

### WhatsApp

**Language:** Node.js | **Platform:** Meta Cloud API

Deploy your agent on WhatsApp Business for customer engagement.

**Features:**
- Text, image, document, and location messages
- Interactive buttons and list menus
- Message templates for proactive outreach
- Read receipts and typing indicators

**Quick Setup:**
```bash
cd whatsapp
npm install
cp .env.example .env
npm start
```

[📖 Full Documentation](./whatsapp/README.md)

---

### Slack

**Language:** Python | **Platform:** Slack API

Integrate your agent into Slack workspaces.

**Features:**
- Direct messages and channel mentions
- Thread support for organized conversations
- Rich message formatting with blocks
- Slash commands support

**Quick Setup:**
```bash
cd slack
pip install -r requirements.txt
cp .env.example .env
python main.py
```

[📖 Full Documentation](./slack/README.md)

---

### Telegram

**Language:** Python | **Platform:** Telegram Bot API

Create a Telegram bot powered by your CX Agent Studio agent.

**Features:**
- Private and group chat support
- Inline keyboards and reply keyboards
- Media handling (photos, documents, voice)
- Webhook and long-polling modes

**Quick Setup:**
```bash
cd telegram
pip install -r requirements.txt
cp .env.example .env
python main.py
```

[📖 Full Documentation](./telegram/README.md)

---

### Discord

**Language:** Node.js | **Platform:** Discord.js

Add your agent to Discord servers.

**Features:**
- Direct messages and channel messages
- Slash commands integration
- Rich embeds and buttons
- Role-based access control

**Quick Setup:**
```bash
cd discord
npm install
cp .env.example .env
npm start
```

[📖 Full Documentation](./discord/README.md)

---

### Google Chat

**Language:** Node.js | **Platform:** Google Chat API

Deploy your agent in Google Workspace.

**Features:**
- Spaces and direct message support
- Cards and interactive elements
- @mention handling
- Seamless Google Cloud integration

**Quick Setup:**
```bash
cd google-chat
npm install
cp .env.example .env
npm start
```

[📖 Full Documentation](./google-chat/README.md)

---

### Zoom

**Language:** Node.js | **Platform:** Zoom Team Chat API

Integrate with Zoom Team Chat.

**Features:**
- Team chat messaging
- Channel and direct message support
- Webhook event handling
- OAuth 2.0 authentication

**Quick Setup:**
```bash
cd zoom
npm install
cp .env.example .env
npm start
```

[📖 Full Documentation](./zoom/README.md)

---

## 🚀 Deployment Options

All integrations support multiple deployment methods:

| Method | Best For | HTTPS | Scaling |
|--------|----------|-------|---------|
| **Cloud Run** | Production | ✅ Auto | ✅ Auto |
| **Cloud Functions** | Simple setups | ✅ Auto | ✅ Auto |
| **Docker** | Self-hosted | Manual | Manual |
| **Kubernetes** | Enterprise | Manual | Manual |

### Cloud Run Deployment (Recommended)

```bash
# From any channel folder
gcloud builds submit --tag gcr.io/PROJECT_ID/CHANNEL-bot
gcloud run deploy CHANNEL-bot \
    --image gcr.io/PROJECT_ID/CHANNEL-bot \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated
```

## 🔐 Security Best Practices

1. **Never commit credentials** - Use environment variables or Secret Manager
2. **Validate webhook signatures** - Each integration includes signature validation
3. **Use service accounts** - Don't use personal credentials in production
4. **Enable audit logging** - Monitor API usage in Google Cloud
5. **Rate limiting** - Implement rate limiting for production deployments

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📚 Resources

- [CX Agent Studio Documentation](https://cloud.google.com/customer-engagement-ai/conversational-agents)
- [CX Agent Studio API Reference](https://cloud.google.com/dialogflow/cx/docs/reference)
- [Google Cloud Authentication](https://cloud.google.com/docs/authentication)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for the CX Agent Studio community
</p>