# Telegram Bot Integration for CX Agent Studio

This integration enables you to deploy your CX Agent Studio agent application as a Telegram bot, allowing users to interact with your conversational AI through Telegram messenger.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Create a Telegram Bot](#1-create-a-telegram-bot)
  - [2. Set Up CX Agent Studio API Access](#2-set-up-cx-agent-studio-api-access)
  - [3. Configure Google Cloud Authentication](#3-configure-google-cloud-authentication)
  - [4. Deploy the Integration](#4-deploy-the-integration)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)

## Overview

This integration uses the CX Agent Studio API access deployment option to connect a Telegram bot with your agent application. For each user message received via Telegram, the integration calls the `runSession` method to send the message and receive the agent's response.

### Features

- Real-time message handling via Telegram Bot API
- Session management per Telegram user/chat
- Support for both `runSession` (synchronous) and `BidiRunSession` (bidirectional streaming)
- Automatic retry with exponential backoff
- Docker support for easy deployment
- Health check endpoint for monitoring

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│   Telegram  │────▶│  Telegram Bot   │────▶│  CX Agent Studio     │
│    User     │◀────│   Integration   │◀────│       API            │
└─────────────┘     └─────────────────┘     └──────────────────────┘
                           │
                           │ Uses
                           ▼
                    ┌─────────────────┐
                    │  Google Cloud   │
                    │  Authentication │
                    └─────────────────┘
```

## Prerequisites

1. **Google Cloud Project** with CX Agent Studio enabled
2. **CX Agent Studio Application** with an agent configured
3. **API Access Channel** created in CX Agent Studio
4. **Telegram Account** to create a bot
5. **Python 3.9+** installed
6. **Google Cloud SDK** (gcloud) installed and configured

## Setup Guide

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat and send `/newbot`
3. Follow the prompts to:
   - Provide a name for your bot (e.g., "My CX Agent Bot")
   - Provide a username (must end with `bot`, e.g., `my_cx_agent_bot`)
4. **Save the API token** provided by BotFather - you'll need this later

Optional bot configuration with BotFather:
```
/setdescription - Set bot description
/setabouttext - Set bot about info
/setuserpic - Set bot profile picture
/setcommands - Set bot commands menu
```

Recommended commands to set:
```
start - Start conversation with the bot
help - Get help information
reset - Reset conversation session
```

### 2. Set Up CX Agent Studio API Access

1. Open your CX Agent Studio application in the Google Cloud Console
2. Click **Deploy** at the top of the agent builder
3. Click **New channel**
4. Select **Set up API access**
5. Provide a channel name (e.g., "telegram-bot")
6. Select or create an agent application version
7. (Optional) Configure channel-specific behavior settings
8. Click **Create channel**

From the dialog window, note down the **Deployment ID** which contains:
- `PROJECT_ID`
- `REGION_ID` (e.g., `us`)
- `APPLICATION_ID`
- `DEPLOYMENT_ID`

The format is:
```
projects/PROJECT_ID/locations/REGION_ID/apps/APPLICATION_ID/deployments/DEPLOYMENT_ID
```

### 3. Configure Google Cloud Authentication

#### Option A: Service Account (Recommended for Production)

1. Create a service account:
```bash
gcloud iam service-accounts create telegram-bot-sa \
    --display-name="Telegram Bot Service Account"
```

2. Grant necessary permissions:
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:telegram-bot-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/dialogflow.client"
```

3. Create and download a key file:
```bash
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=telegram-bot-sa@PROJECT_ID.iam.gserviceaccount.com
```

4. Set the environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### Option B: User Credentials (Development Only)

```bash
gcloud auth application-default login
```

### 4. Deploy the Integration

#### Local Development

1. Clone this repository and navigate to the telegram folder:
```bash
cd telegram
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create `.env` file from template:
```bash
cp .env.example .env
```

5. Edit `.env` with your configuration:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GCP_PROJECT_ID=your_project_id
GCP_REGION=us
CES_APP_ID=your_app_id
CES_DEPLOYMENT_ID=your_deployment_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

6. Run the bot:
```bash
python main.py
```

#### Docker Deployment

1. Build the Docker image:
```bash
docker build -t telegram-ces-bot .
```

2. Run with Docker:
```bash
docker run -d \
    --name telegram-ces-bot \
    --env-file .env \
    -v /path/to/service-account-key.json:/app/credentials.json \
    -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
    telegram-ces-bot
```

#### Docker Compose Deployment

1. Update `docker-compose.yml` with your settings
2. Run:
```bash
docker-compose up -d
```

#### Google Cloud Run Deployment

1. Build and push to Container Registry:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/telegram-ces-bot
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy telegram-ces-bot \
    --image gcr.io/PROJECT_ID/telegram-ces-bot \
    --platform managed \
    --region us-central1 \
    --set-env-vars="TELEGRAM_BOT_TOKEN=YOUR_TOKEN,GCP_PROJECT_ID=PROJECT_ID,GCP_REGION=us,CES_APP_ID=APP_ID,CES_DEPLOYMENT_ID=DEPLOYMENT_ID" \
    --allow-unauthenticated
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from BotFather |
| `GCP_PROJECT_ID` | Yes | Google Cloud Project ID |
| `GCP_REGION` | Yes | CX Agent Studio region (e.g., `us`, `eu`) |
| `CES_APP_ID` | Yes | CX Agent Studio Application ID |
| `CES_DEPLOYMENT_ID` | No | Deployment ID (optional, for specific deployment) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account key file |
| `USE_BIDI_SESSION` | No | Use bidirectional streaming (default: `false`) |
| `LOG_LEVEL` | No | Logging level (default: `INFO`) |
| `HEALTH_CHECK_PORT` | No | Health check endpoint port (default: `8080`) |

*Not required if using Application Default Credentials

### Session ID Generation

Session IDs are automatically generated per Telegram chat using the format:
```
telegram-{chat_id}
```

This ensures conversation continuity within each Telegram chat while maintaining isolation between different users/groups.

## API Reference

### CX Agent Studio API Endpoints

#### runSession (Synchronous)

Used for standard request-response interactions:

```python
from google.cloud import ces_v1

session_service_client = ces_v1.SessionServiceClient()
session_name = f"projects/{PROJECT_ID}/locations/{REGION}/apps/{APP_ID}/sessions/{SESSION_ID}"

config = ces_v1.SessionConfig(session=session_name)
input_ = ces_v1.SessionInput(text="Hello!")
inputs = [input_]

request = ces_v1.RunSessionRequest(config=config, inputs=inputs)
response = session_service_client.run_session(request=request)
```

#### BidiRunSession (Bidirectional Streaming)

Used for real-time streaming interactions via WebSocket:

```python
uri = "wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/us"

# Config message
config_message = ces_v1.BidiSessionClientMessage(
    config=ces_v1.SessionConfig(session=session_name)
)

# Query message
query_message = ces_v1.BidiSessionClientMessage(
    realtime_input=ces_v1.SessionInput(text="Hello!")
)
```

### Telegram Bot API

The integration uses the following Telegram Bot API methods:

- `getUpdates` / Webhooks - Receive messages
- `sendMessage` - Send text responses
- `sendChatAction` - Show typing indicator

## Deployment Options

### 1. Polling Mode (Default)

The bot continuously polls Telegram servers for updates. Best for development and simple deployments.

```python
# Enabled by default in main.py
application.run_polling()
```

### 2. Webhook Mode

More efficient for production. Requires HTTPS endpoint.

```python
application.run_webhook(
    listen="0.0.0.0",
    port=8443,
    url_path=TELEGRAM_BOT_TOKEN,
    webhook_url=f"https://your-domain.com/{TELEGRAM_BOT_TOKEN}"
)
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Error:** `google.auth.exceptions.DefaultCredentialsError`

**Solution:** Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set correctly:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### 2. Permission Denied

**Error:** `403 Permission denied`

**Solution:** Ensure the service account has the required IAM roles:
- `roles/dialogflow.client`
- `roles/ces.sessionUser` (if available)

#### 3. Session Not Found

**Error:** `Session not found`

**Solution:** The session is created automatically on first message. Ensure the APP_ID and REGION are correct.

#### 4. Bot Not Responding

**Checks:**
1. Verify bot token is correct
2. Check bot is not blocked
3. Review logs for errors
4. Ensure network connectivity to both Telegram and Google Cloud APIs

### Logging

Enable debug logging for troubleshooting:

```bash
export LOG_LEVEL=DEBUG
python main.py
```

### Health Check

The bot exposes a health check endpoint at `http://localhost:8080/health` for monitoring.

## Project Structure

```
telegram/
├── README.md              # This file
├── main.py                # Main bot application
├── ces_client.py          # CX Agent Studio API client
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variables template
├── Dockerfile             # Docker build file
└── docker-compose.yml     # Docker Compose configuration
```

## License

This project is provided as a reference implementation for integrating CX Agent Studio with Telegram.

## Support

For issues related to:
- **CX Agent Studio**: See [Google Cloud Documentation](https://cloud.google.com/customer-engagement-ai/conversational-agents)
- **Telegram Bot API**: See [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- **This Integration**: Open an issue in this repository
