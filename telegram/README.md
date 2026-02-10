# Telegram Bot Integration for CX Agent Studio

Deploy your Google Cloud CX Agent Studio (Customer Engagement Suite) conversational AI agent as a Telegram bot. Users can interact with your AI agent directly through Telegram messenger.

![Telegram Bot Demo](https://img.shields.io/badge/Status-Production%20Ready-green)
![Python](https://img.shields.io/badge/Python-3.9+-blue)
![License](https://img.shields.io/badge/License-Apache%202.0-blue)

## Table of Contents

- [Overview](#overview)
- [Live Demo](#live-demo)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [CX Agent Studio API](#cx-agent-studio-api)
- [Bot Commands](#bot-commands)
- [Session Management](#session-management)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)
- [Security Best Practices](#security-best-practices)
- [Project Structure](#project-structure)

---

## Overview

This integration bridges Telegram's Bot API with Google Cloud's CX Agent Studio using the REST API (`runSession` endpoint). It enables:

- **Real-time conversations** - Users chat with your AI agent directly in Telegram
- **Session persistence** - Conversation context maintained per user
- **Seamless deployment** - Deploy any CX Agent Studio agent to Telegram
- **Production ready** - Health checks, error handling, and Docker support

### Key Features

| Feature | Description |
|---------|-------------|
| Text Messaging | Full support for text-based conversations |
| Bot Commands | `/start`, `/help`, `/reset` commands |
| Session Management | Unique session per Telegram user |
| Long Message Handling | Automatic splitting for messages >4096 chars |
| Typing Indicators | Shows "typing..." while agent processes |
| Health Endpoint | `/health` endpoint for monitoring |
| Debug Logging | Configurable log levels for troubleshooting |

---

## Live Demo

Here's an example of the bot in action with a Cymbal Home & Garden retail agent:

```
User: hi
Bot: Welcome back to Cymbal Home & Garden, Patrick! I see you've already
     got some items in your cart: Standard Potting Soil and General
     Purpose Fertilizer. How can I help you today?

User: /reset
Bot: Your conversation session has been reset. You can now start a fresh conversation!

User: Hello
Bot: Welcome back, Patrick! I see you've already got some items in your
     Cymbal Home & Garden cart. How can I help you today?
```

---

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│                 │  Bot    │                  │  REST   │                     │
│  Telegram User  │ ◀─────▶ │  Telegram Bot    │ ◀─────▶ │  CX Agent Studio    │
│                 │  API    │  (Python)        │  API    │  (Google Cloud)     │
│                 │         │                  │         │                     │
└─────────────────┘         └──────────────────┘         └─────────────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │ Health Check │
                            │  :8080       │
                            └──────────────┘
```

### Data Flow

1. User sends message in Telegram
2. Telegram Bot API delivers message to bot
3. Bot generates session ID from user's chat ID
4. Bot calls CX Agent Studio `runSession` API
5. Agent processes message and returns response
6. Bot sends response back to user in Telegram

---

## Prerequisites

### 1. Google Cloud Setup

- [ ] Google Cloud project with billing enabled
- [ ] CX Agent Studio API enabled
- [ ] Application created in CX Agent Studio
- [ ] Deployment created for API access

### 2. Telegram Bot

- [ ] Telegram account
- [ ] Bot created via @BotFather
- [ ] Bot token saved

### 3. Development Environment

- [ ] Python 3.9 or higher
- [ ] Google Cloud SDK (`gcloud`) installed
- [ ] pip package manager

---

## Quick Start

### Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Provide a display name (e.g., "My CX Agent")
4. Provide a username (must end with `bot`, e.g., `my_cx_agent_bot`)
5. **Save the bot token** - you'll need this

Optional - Set bot commands with BotFather:
```
/setcommands
```
Then send:
```
start - Start conversation
help - Get help information
reset - Reset conversation session
```

### Step 2: Get CX Agent Studio IDs

1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **CX Agent Studio** > **Applications**
3. Select your application
4. Click **Deploy** > **API Access**
5. Note down the resource path:

```
projects/{PROJECT_ID}/locations/{REGION}/apps/{APP_ID}/deployments/{DEPLOYMENT_ID}
```

**Example:**
```
projects/discord-bot-8fdf5/locations/us/apps/896b0766-4096-4dae-aa7b-18055575261b/deployments/5a3f89ed-b325-4ebb-9f48-9edcb5771ac2
```

### Step 3: Configure the Bot

1. Navigate to the telegram directory:
```bash
cd telegram
```

2. Create `.env` file from template:
```bash
cp .env.example .env
```

3. Edit `.env` with your values:
```env
# Required Settings
TELEGRAM_BOT_TOKEN=8355469863:AAGNsjCWD9pqNqLPMuWPdZVgI4KNhjxbNNw
GCP_PROJECT_ID=discord-bot-8fdf5
GCP_REGION=us
CES_APP_ID=896b0766-4096-4dae-aa7b-18055575261b

# Optional Settings
CES_DEPLOYMENT_ID=5a3f89ed-b325-4ebb-9f48-9edcb5771ac2
LOG_LEVEL=INFO
HEALTH_CHECK_PORT=8080
```

### Step 4: Authenticate with Google Cloud

**For Development:**
```bash
gcloud auth application-default login
```

**For Production (Service Account):**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Step 5: Install and Run

```bash
# Install dependencies
pip install -r requirements.txt

# Run the bot
python main.py
```

### Step 6: Test Your Bot

1. Open Telegram
2. Search for your bot by username
3. Send `/start` or any message
4. Your CX Agent Studio agent responds!

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | **Yes** | - | Bot token from @BotFather |
| `GCP_PROJECT_ID` | **Yes** | - | Google Cloud project ID |
| `GCP_REGION` | No | `us` | CX Agent Studio region (`us`, `eu`, etc.) |
| `CES_APP_ID` | **Yes** | - | CX Agent Studio application ID (UUID) |
| `CES_DEPLOYMENT_ID` | No | - | Specific deployment ID to use |
| `USE_BIDI_SESSION` | No | `false` | Use bidirectional streaming |
| `LOG_LEVEL` | No | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `HEALTH_CHECK_PORT` | No | `8080` | Port for health check endpoint |
| `GOOGLE_APPLICATION_CREDENTIALS` | No* | - | Path to service account key file |

*Required for production if not using Application Default Credentials

### Sample .env File

```env
# =============================================================================
# TELEGRAM BOT CONFIGURATION
# =============================================================================

# Telegram Bot Token (from @BotFather)
TELEGRAM_BOT_TOKEN=8355469863:AAGNsjCWD9pqNqLPMuWPdZVgI4KNhjxbNNw

# =============================================================================
# GOOGLE CLOUD / CX AGENT STUDIO CONFIGURATION
# =============================================================================

# Google Cloud Project ID
GCP_PROJECT_ID=discord-bot-8fdf5

# CX Agent Studio Region
GCP_REGION=us

# CX Agent Studio Application ID
CES_APP_ID=896b0766-4096-4dae-aa7b-18055575261b

# CX Agent Studio Deployment ID (optional)
CES_DEPLOYMENT_ID=5a3f89ed-b325-4ebb-9f48-9edcb5771ac2

# =============================================================================
# OPTIONAL SETTINGS
# =============================================================================

# Logging level (DEBUG, INFO, WARNING, ERROR)
LOG_LEVEL=INFO

# Health check endpoint port
HEALTH_CHECK_PORT=8080

# Use bidirectional streaming (advanced)
USE_BIDI_SESSION=false
```

---

## CX Agent Studio API

### REST Endpoint

The bot calls the `runSession` endpoint:

```
POST https://ces.googleapis.com/v1beta/projects/{PROJECT_ID}/locations/{REGION}/apps/{APP_ID}/sessions/{SESSION_ID}:runSession
```

### Request Format

```json
{
  "config": {
    "session": "projects/{PROJECT_ID}/locations/{REGION}/apps/{APP_ID}/sessions/{SESSION_ID}",
    "deployment": "projects/{PROJECT_ID}/locations/{REGION}/apps/{APP_ID}/deployments/{DEPLOYMENT_ID}"
  },
  "inputs": [
    {
      "text": "User message here"
    }
  ]
}
```

### Response Format

```json
{
  "outputs": [
    {
      "text": "Agent response here",
      "turnCompleted": true,
      "turnIndex": 1
    }
  ]
}
```

### Authentication

Requests are authenticated using Google Cloud OAuth2 tokens:

```bash
# Get token manually for testing
gcloud auth print-access-token
```

The bot automatically handles token generation and refresh using the Google Auth library.

### Example cURL Request

```bash
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "session": "projects/discord-bot-8fdf5/locations/us/apps/896b0766-4096-4dae-aa7b-18055575261b/sessions/test-session",
      "deployment": "projects/discord-bot-8fdf5/locations/us/apps/896b0766-4096-4dae-aa7b-18055575261b/deployments/5a3f89ed-b325-4ebb-9f48-9edcb5771ac2"
    },
    "inputs": [{"text": "hi"}]
  }' \
  "https://ces.googleapis.com/v1beta/projects/discord-bot-8fdf5/locations/us/apps/896b0766-4096-4dae-aa7b-18055575261b/sessions/test-session:runSession"
```

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Display welcome message with usage instructions |
| `/help` | Show help information and available commands |
| `/reset` | Reset conversation session (clears context) |

### Customizing Welcome Message

Edit the `start_command` function in `main.py`:

```python
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    welcome_message = (
        f"Hello {update.effective_user.first_name}! "
        "I'm your AI assistant powered by CX Agent Studio.\n\n"
        "Just send me a message to get started!"
    )
    await update.message.reply_text(welcome_message)
```

---

## Session Management

### How Sessions Work

Each Telegram user gets a unique session ID based on their chat ID:

```
Format: telegram-{CHAT_ID}
Example: telegram-739222198
```

This ensures:
- **Conversation continuity** within each chat
- **Context preservation** across messages
- **User isolation** between different chats

### Session Lifecycle

1. **Creation**: Session created on first message
2. **Persistence**: Context maintained across messages
3. **Reset**: User can reset with `/reset` command

### Reset Behavior

When a user sends `/reset`:
1. New session ID generated with timestamp: `telegram-{CHAT_ID}-{TIMESTAMP}`
2. All previous conversation context is cleared
3. Fresh conversation starts with the agent

---

## Deployment Options

### Option 1: Local Development

```bash
# Authenticate
gcloud auth application-default login

# Install dependencies
pip install -r requirements.txt

# Run
python main.py
```

### Option 2: Docker

**Build:**
```bash
docker build -t telegram-ces-bot .
```

**Run:**
```bash
docker run -d \
  --name telegram-ces-bot \
  -p 8080:8080 \
  --env-file .env \
  -v /path/to/credentials.json:/app/credentials.json \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
  telegram-ces-bot
```

### Option 3: Docker Compose

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Option 4: Google Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/telegram-ces-bot

# Deploy
gcloud run deploy telegram-ces-bot \
  --image gcr.io/PROJECT_ID/telegram-ces-bot \
  --platform managed \
  --region us-central1 \
  --set-env-vars "TELEGRAM_BOT_TOKEN=xxx,GCP_PROJECT_ID=xxx,GCP_REGION=us,CES_APP_ID=xxx,CES_DEPLOYMENT_ID=xxx" \
  --allow-unauthenticated \
  --min-instances 1
```

### Option 5: Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: telegram-ces-bot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: telegram-ces-bot
  template:
    metadata:
      labels:
        app: telegram-ces-bot
    spec:
      containers:
      - name: bot
        image: telegram-ces-bot:latest
        ports:
        - containerPort: 8080
        envFrom:
        - secretRef:
            name: telegram-bot-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
```

---

## Troubleshooting

### Common Issues

#### Bot Not Responding

1. **Check bot token:**
   ```bash
   # Verify token works
   curl "https://api.telegram.org/bot<TOKEN>/getMe"
   ```

2. **Check logs:**
   ```bash
   LOG_LEVEL=DEBUG python main.py
   ```

3. **Verify bot isn't blocked** in Telegram

#### Authentication Errors

**Error:** `google.auth.exceptions.DefaultCredentialsError`

**Solution:**
```bash
# Re-authenticate
gcloud auth application-default login

# Or set service account path
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

#### Permission Denied (403)

**Error:** `403 Permission denied on resource`

**Solution:**
1. Verify CX Agent Studio API is enabled
2. Check service account permissions:
   ```bash
   gcloud projects add-iam-policy-binding PROJECT_ID \
     --member="serviceAccount:SA_EMAIL" \
     --role="roles/dialogflow.client"
   ```

#### Invalid Session ID

**Error:** `Session ID format invalid`

**Solution:** Session IDs must:
- Be 5-63 characters
- Start with alphanumeric character
- Only contain: `a-zA-Z0-9-_`

The bot handles this automatically, but custom session IDs must follow this pattern.

### Debug Mode

Enable verbose logging:

```bash
export LOG_LEVEL=DEBUG
python main.py
```

This shows:
- API request/response details
- Session ID generation
- Telegram update processing
- Error stack traces

### Health Check

Verify the bot is running:

```bash
curl http://localhost:8080/health
```

**Expected response:**
```json
{"status": "healthy"}
```

---

## Security Best Practices

### Credential Management

- **Never commit** `.env` files to version control
- **Never commit** service account keys
- Use **environment variables** or **secret managers**
- **Rotate** credentials periodically

### Production Checklist

- [ ] Use service account (not user credentials)
- [ ] Restrict service account permissions to minimum required
- [ ] Enable audit logging in Google Cloud
- [ ] Use secrets manager for credentials
- [ ] Restrict health check endpoint access
- [ ] Enable HTTPS for webhook mode
- [ ] Monitor for unusual activity

### Bot Token Security

- Keep token secret - anyone with it can control your bot
- If compromised, regenerate via @BotFather: `/revoke`
- Never log or display the full token

---

## Project Structure

```
telegram/
├── main.py              # Bot application entry point
│                        # - Command handlers (/start, /help, /reset)
│                        # - Message handler for CES integration
│                        # - Health check server
│
├── ces_client.py        # CX Agent Studio REST API client
│                        # - Authentication handling
│                        # - runSession API calls
│                        # - Response parsing
│
├── config.py            # Configuration management
│                        # - Environment variable loading
│                        # - Validation
│                        # - Resource name generation
│
├── requirements.txt     # Python dependencies
├── .env.example         # Environment template
├── .env                 # Your configuration (git-ignored)
├── Dockerfile           # Container build file
├── docker-compose.yml   # Docker Compose configuration
└── README.md            # This documentation
```

---

## Resources

### Documentation

- [CX Agent Studio Documentation](https://cloud.google.com/customer-engagement-suite/docs)
- [CX Agent Studio REST API Reference](https://docs.cloud.google.com/customer-engagement-ai/conversational-agents/ps/reference/rest/v1beta-overview)
- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [python-telegram-bot Library](https://python-telegram-bot.org/)

### Related Integrations

- [Discord Bot Integration](../discord/)
- [Slack Bot Integration](../slack/)
- [WhatsApp Integration](../whatsapp/)
- [Google Chat Integration](../google-chat/)

---

## License

Apache 2.0 - See [LICENSE](../LICENSE) for details.

---

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

---

**Built with Google Cloud CX Agent Studio**
