# Slack Bot Integration for CX Agent Studio

This integration enables you to deploy your CX Agent Studio agent application as a Slack bot, allowing users to interact with your conversational AI through Slack workspaces.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Create a Slack App](#1-create-a-slack-app)
  - [2. Configure Bot Permissions](#2-configure-bot-permissions)
  - [3. Set Up CX Agent Studio API Access](#3-set-up-cx-agent-studio-api-access)
  - [4. Configure Google Cloud Authentication](#4-configure-google-cloud-authentication)
  - [5. Deploy the Integration](#5-deploy-the-integration)
- [Configuration](#configuration)
- [Features](#features)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)

## Overview

This integration uses the CX Agent Studio API access deployment option to connect a Slack bot with your agent application. The bot listens for messages via Slack's Socket Mode or Events API and uses the `runSession` method to communicate with your CX Agent Studio agent.

### Features

- Real-time message handling via Slack Socket Mode (no public URL required)
- Events API support for webhook-based deployments
- Session management per Slack channel/thread
- Support for direct messages and channel mentions
- Thread-based conversation continuity
- Slash command support
- Docker support for easy deployment
- Health check endpoint for monitoring

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│    Slack    │────▶│   Slack Bot     │────▶│  CX Agent Studio     │
│  Workspace  │◀────│   Integration   │◀────│       API            │
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
4. **Slack Workspace** with admin permissions to install apps
5. **Python 3.9+** installed
6. **Google Cloud SDK** (gcloud) installed and configured

## Setup Guide

### 1. Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From scratch**
4. Enter an App Name (e.g., "CX Agent Bot")
5. Select your workspace
6. Click **Create App**

### 2. Configure Bot Permissions

#### OAuth & Permissions

1. In your app settings, go to **OAuth & Permissions**
2. Under **Scopes** > **Bot Token Scopes**, add:
   - `app_mentions:read` - View messages that mention the bot
   - `channels:history` - View messages in public channels
   - `channels:read` - View basic channel info
   - `chat:write` - Send messages
   - `groups:history` - View messages in private channels
   - `groups:read` - View basic private channel info
   - `im:history` - View direct messages
   - `im:read` - View basic DM info
   - `im:write` - Start direct messages
   - `mpim:history` - View group DM messages
   - `mpim:read` - View group DM info
   - `users:read` - View user info

3. Click **Install to Workspace**
4. Authorize the app
5. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

#### Enable Socket Mode (Recommended)

Socket Mode allows your bot to receive events without exposing a public URL.

1. Go to **Socket Mode** in the sidebar
2. Toggle **Enable Socket Mode** to ON
3. Create an App-Level Token:
   - Token Name: `socket-mode-token`
   - Scope: `connections:write`
4. Click **Generate**
5. Copy the **App-Level Token** (starts with `xapp-`)

#### Event Subscriptions

1. Go to **Event Subscriptions**
2. Toggle **Enable Events** to ON
3. If using Socket Mode, skip the Request URL
4. Under **Subscribe to bot events**, add:
   - `app_mention` - When someone mentions your bot
   - `message.channels` - Messages in public channels
   - `message.groups` - Messages in private channels
   - `message.im` - Direct messages
   - `message.mpim` - Group direct messages

5. Click **Save Changes**

#### Slash Commands (Optional)

1. Go to **Slash Commands**
2. Click **Create New Command**
3. Configure:
   - Command: `/ask` (or your preferred command)
   - Description: "Ask the AI agent a question"
   - Usage Hint: "[your question]"
4. Click **Save**

### 3. Set Up CX Agent Studio API Access

1. Open your CX Agent Studio application in the Google Cloud Console
2. Click **Deploy** at the top of the agent builder
3. Click **New channel**
4. Select **Set up API access**
5. Provide a channel name (e.g., "slack-bot")
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

### 4. Configure Google Cloud Authentication

#### Option A: Service Account (Recommended for Production)

1. Create a service account:
```bash
gcloud iam service-accounts create slack-bot-sa \
    --display-name="Slack Bot Service Account"
```

2. Grant necessary permissions:
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:slack-bot-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/dialogflow.client"
```

3. Create and download a key file:
```bash
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=slack-bot-sa@PROJECT_ID.iam.gserviceaccount.com
```

4. Set the environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### Option B: User Credentials (Development Only)

```bash
gcloud auth application-default login
```

### 5. Deploy the Integration

#### Local Development

1. Clone this repository and navigate to the slack folder:
```bash
cd slack
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
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret
GCP_PROJECT_ID=your_project_id
GCP_REGION=us
CES_APP_ID=your_app_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

6. Run the bot:
```bash
python main.py
```

#### Docker Deployment

1. Build the Docker image:
```bash
docker build -t slack-ces-bot .
```

2. Run with Docker:
```bash
docker run -d \
    --name slack-ces-bot \
    --env-file .env \
    -v /path/to/service-account-key.json:/app/credentials.json \
    -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
    slack-ces-bot
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
gcloud builds submit --tag gcr.io/PROJECT_ID/slack-ces-bot
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy slack-ces-bot \
    --image gcr.io/PROJECT_ID/slack-ces-bot \
    --platform managed \
    --region us-central1 \
    --set-env-vars="SLACK_BOT_TOKEN=YOUR_TOKEN,SLACK_SIGNING_SECRET=YOUR_SECRET,GCP_PROJECT_ID=PROJECT_ID,GCP_REGION=us,CES_APP_ID=APP_ID" \
    --allow-unauthenticated
```

Note: For Cloud Run, you'll need to use Events API mode instead of Socket Mode.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SLACK_BOT_TOKEN` | Yes | Bot User OAuth Token (xoxb-...) |
| `SLACK_APP_TOKEN` | Yes* | App-Level Token for Socket Mode (xapp-...) |
| `SLACK_SIGNING_SECRET` | Yes | Signing secret for request verification |
| `GCP_PROJECT_ID` | Yes | Google Cloud Project ID |
| `GCP_REGION` | Yes | CX Agent Studio region (e.g., `us`, `eu`) |
| `CES_APP_ID` | Yes | CX Agent Studio Application ID |
| `CES_DEPLOYMENT_ID` | No | Deployment ID (optional) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes** | Path to service account key file |
| `USE_SOCKET_MODE` | No | Use Socket Mode (default: `true`) |
| `USE_BIDI_SESSION` | No | Use bidirectional streaming (default: `false`) |
| `LOG_LEVEL` | No | Logging level (default: `INFO`) |
| `HEALTH_CHECK_PORT` | No | Health check endpoint port (default: `8080`) |
| `RESPOND_TO_MENTIONS_ONLY` | No | Only respond to @mentions (default: `false`) |

*Required only for Socket Mode
**Not required if using Application Default Credentials

### Session ID Generation

Session IDs are automatically generated per Slack channel/thread using the format:
```
slack-{channel_id}-{thread_ts or 'main'}
```

This ensures conversation continuity within each thread while maintaining isolation between different conversations.

## Features

### Message Handling

The bot responds to:
- **Direct Messages**: All messages in DMs with the bot
- **Channel Mentions**: Messages that @mention the bot
- **Channel Messages**: All messages in channels (configurable)

### Thread Support

- Conversations in threads maintain separate session context
- Replies to bot messages continue the thread
- Thread timestamps are used for session identification

### Slash Commands

If configured, users can use:
```
/ask What is the weather today?
```

### Typing Indicator

The bot shows a typing indicator while processing requests.

## API Reference

### CX Agent Studio API

The integration uses the same `runSession` and `BidiRunSession` methods as documented in the Telegram integration. See the CES client module for implementation details.

### Slack API Methods Used

- `chat_postMessage` - Send messages
- `conversations_info` - Get channel information
- `users_info` - Get user information

## Deployment Options

### 1. Socket Mode (Recommended for Development)

Uses WebSocket connection to receive events. No public URL required.

```python
# Enabled by default
handler = SocketModeHandler(app, slack_app_token)
handler.start()
```

### 2. Events API Mode (Production)

Uses HTTP webhooks. Requires a public HTTPS URL.

```python
from flask import Flask, request
from slack_bolt.adapter.flask import SlackRequestHandler

flask_app = Flask(__name__)
handler = SlackRequestHandler(app)

@flask_app.route("/slack/events", methods=["POST"])
def slack_events():
    return handler.handle(request)
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Error:** `google.auth.exceptions.DefaultCredentialsError`

**Solution:** Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set correctly:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### 2. Slack Token Invalid

**Error:** `slack_sdk.errors.SlackApiError: invalid_auth`

**Solution:**
- Verify your `SLACK_BOT_TOKEN` is correct
- Ensure the app is installed to the workspace
- Check that required scopes are added

#### 3. Socket Mode Connection Failed

**Error:** `Could not open a connection`

**Solution:**
- Verify `SLACK_APP_TOKEN` is correct (starts with `xapp-`)
- Ensure Socket Mode is enabled in app settings
- Check network connectivity

#### 4. Bot Not Responding to Messages

**Checks:**
1. Verify the bot is in the channel (`/invite @botname`)
2. Check Event Subscriptions are enabled
3. Ensure correct bot events are subscribed
4. Review application logs for errors

#### 5. Permission Denied from CX Agent Studio

**Error:** `403 Permission denied`

**Solution:** Ensure the service account has required IAM roles:
- `roles/dialogflow.client`

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
slack/
├── README.md              # This file
├── main.py                # Main bot application
├── ces_client.py          # CX Agent Studio API client
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── .env.example           # Environment variables template
├── Dockerfile             # Docker build file
└── docker-compose.yml     # Docker Compose configuration
```

## Resources

- [Slack Bolt for Python](https://slack.dev/bolt-python/concepts)
- [Python Slack SDK](https://docs.slack.dev/tools/python-slack-sdk/)
- [Slack API Documentation](https://api.slack.com/)
- [CX Agent Studio Documentation](https://cloud.google.com/customer-engagement-ai/conversational-agents)

## License

This project is provided as a reference implementation for integrating CX Agent Studio with Slack.
