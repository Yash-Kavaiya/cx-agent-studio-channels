# Google Chat Integration for CX Agent Studio

This integration enables you to deploy your CX Agent Studio agent application as a Google Chat bot, allowing users to interact with your conversational AI through Google Chat spaces and direct messages.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Create a Google Cloud Project](#1-create-a-google-cloud-project)
  - [2. Enable Google Chat API](#2-enable-google-chat-api)
  - [3. Configure the Chat App](#3-configure-the-chat-app)
  - [4. Set Up CX Agent Studio API Access](#4-set-up-cx-agent-studio-api-access)
  - [5. Deploy the Integration](#5-deploy-the-integration)
- [Configuration](#configuration)
- [Features](#features)
- [Slash Commands](#slash-commands)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)

## Overview

This integration uses the CX Agent Studio API access deployment option to connect a Google Chat bot with your agent application. The bot can receive events via HTTP endpoint or Cloud Pub/Sub and uses the `runSession` method to communicate with your CX Agent Studio agent.

### Features

- Real-time message handling via HTTP endpoint or Pub/Sub
- Support for direct messages (DMs) and spaces
- Slash command support
- Interactive cards with buttons and actions
- Thread-based conversation continuity
- Session management per space/DM
- Bidirectional streaming support (BidiRunSession)
- Docker support for easy deployment
- Health check endpoint for monitoring

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  Google Chat    │────▶│  Chat Bot       │────▶│  CX Agent Studio     │
│  (Spaces, DMs)  │◀────│  Integration    │◀────│       API            │
└─────────────────┘     └─────────────────┘     └──────────────────────┘
        │                       │
   HTTP/Pub/Sub                 │
                                ▼
                        ┌─────────────────┐
                        │  Google Cloud   │
                        │  (Same Project) │
                        └─────────────────┘
```

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **Google Workspace** account (or Google Workspace Developer Preview)
3. **CX Agent Studio** enabled in your project
4. **CX Agent Studio Application** with an agent configured
5. **API Access Channel** created in CX Agent Studio
6. **Node.js 18+** installed
7. **Public HTTPS URL** for HTTP endpoint (or use Pub/Sub)

## Setup Guide

### 1. Create a Google Cloud Project

If you don't have a project:

```bash
gcloud projects create YOUR_PROJECT_ID --name="Chat Bot Project"
gcloud config set project YOUR_PROJECT_ID
```

Enable billing for the project in the Google Cloud Console.

### 2. Enable Google Chat API

```bash
# Enable required APIs
gcloud services enable chat.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
```

### 3. Configure the Chat App

#### Create the Chat App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Google Chat API**
3. Click **Configuration** tab
4. Fill in the app details:

| Field | Value |
|-------|-------|
| App name | CX Agent Bot |
| Avatar URL | (optional) URL to bot avatar |
| Description | AI assistant powered by CX Agent Studio |
| Interactive features | Enabled |
| Functionality | Receive 1:1 messages, Join spaces and group conversations |
| Connection settings | See below |
| Slash commands | See below |
| Permissions | Specific people and groups (or Everyone in your domain) |

#### Connection Settings

**Option A: HTTP Endpoint (Recommended)**
- Select "App URL"
- Enter your endpoint URL: `https://your-domain.com/chat`

**Option B: Cloud Pub/Sub**
- Select "Cloud Pub/Sub"
- Create a topic: `projects/YOUR_PROJECT_ID/topics/chat-bot-events`
- The integration will subscribe to this topic

#### Configure Slash Commands (Optional)

Add these recommended commands:

| Command | Description |
|---------|-------------|
| `/ask` | Ask the AI a question |
| `/reset` | Reset conversation |
| `/help` | Show help |

### 4. Set Up CX Agent Studio API Access

1. Open your CX Agent Studio application in the Google Cloud Console
2. Click **Deploy** at the top of the agent builder
3. Click **New channel**
4. Select **Set up API access**
5. Provide a channel name (e.g., "google-chat-bot")
6. Select or create an agent application version
7. Click **Create channel**

Note the deployment details:
```
projects/PROJECT_ID/locations/REGION_ID/apps/APPLICATION_ID/deployments/DEPLOYMENT_ID
```

### 5. Deploy the Integration

#### Service Account Setup

Create a service account for the bot:

```bash
# Create service account
gcloud iam service-accounts create chat-bot-sa \
    --display-name="Chat Bot Service Account"

# Grant Chat API permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:chat-bot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/chat.bot"

# Grant CX Agent Studio permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:chat-bot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/dialogflow.client"

# Create key file
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=chat-bot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### Local Development

1. Navigate to the google-chat folder:
```bash
cd google-chat
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from template:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
GCP_PROJECT_ID=your_project_id
GCP_REGION=us
CES_APP_ID=your_app_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
PORT=3000
```

5. Start the server:
```bash
npm start
```

6. For development, use ngrok to expose the endpoint:
```bash
ngrok http 3000
# Update your Chat app configuration with the ngrok URL
```

#### Docker Deployment

```bash
docker build -t google-chat-ces-bot .
docker run -d \
    --name google-chat-ces-bot \
    --env-file .env \
    -p 3000:3000 \
    -v /path/to/service-account-key.json:/app/credentials.json \
    google-chat-ces-bot
```

#### Docker Compose Deployment

```bash
docker-compose up -d
```

#### Google Cloud Run Deployment (Recommended)

```bash
# Build and push
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/google-chat-ces-bot

# Deploy
gcloud run deploy google-chat-ces-bot \
    --image gcr.io/YOUR_PROJECT_ID/google-chat-ces-bot \
    --platform managed \
    --region us-central1 \
    --set-env-vars="GCP_PROJECT_ID=YOUR_PROJECT_ID,GCP_REGION=us,CES_APP_ID=YOUR_APP_ID" \
    --service-account=chat-bot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
    --allow-unauthenticated

# Get the URL and update Chat app configuration
gcloud run services describe google-chat-ces-bot --format='value(status.url)'
```

#### Google Cloud Functions Deployment

```bash
gcloud functions deploy google-chat-bot \
    --runtime nodejs18 \
    --trigger-http \
    --entry-point handleChat \
    --set-env-vars="GCP_PROJECT_ID=YOUR_PROJECT_ID,GCP_REGION=us,CES_APP_ID=YOUR_APP_ID" \
    --service-account=chat-bot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com \
    --allow-unauthenticated
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GCP_PROJECT_ID` | Yes | Google Cloud Project ID |
| `GCP_REGION` | Yes | CX Agent Studio region (e.g., `us`, `eu`) |
| `CES_APP_ID` | Yes | CX Agent Studio Application ID |
| `CES_DEPLOYMENT_ID` | No | Deployment ID (optional) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account key file |
| `USE_BIDI_SESSION` | No | Use bidirectional streaming (default: `false`) |
| `USE_PUBSUB` | No | Use Pub/Sub instead of HTTP (default: `false`) |
| `PUBSUB_SUBSCRIPTION` | No** | Pub/Sub subscription name |
| `PORT` | No | Server port (default: `3000`) |
| `LOG_LEVEL` | No | Logging level (default: `info`) |

*Not required on Cloud Run/Functions with proper IAM
**Required if USE_PUBSUB=true

### Session Management

Sessions are managed per:
- **Direct Messages**: `gchat-dm-{user_id}`
- **Spaces**: `gchat-space-{space_id}-{thread_id}`

This ensures conversation continuity within each context.

## Features

### Message Handling

The bot responds to:
- **Direct Messages**: All messages in 1:1 chats
- **Space Mentions**: Messages that @mention the bot
- **Thread Replies**: Replies in threads where bot is active

### Card Messages

The bot can send rich card messages with:
- Headers and sections
- Text paragraphs
- Images
- Buttons and actions
- Decorated text with icons

### Interactive Actions

Support for button clicks and form submissions:
- Action callbacks are processed as user messages
- Context is maintained throughout interactions

### Threading

- Responses in spaces are sent to the originating thread
- New threads are created for new conversations
- Thread context is preserved for follow-up questions

## Slash Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `/ask` | Ask the AI a question | `/ask What are your hours?` |
| `/reset` | Reset conversation | `/reset` |
| `/help` | Show help message | `/help` |

## API Reference

### Google Chat API

The integration uses the Chat API for sending messages:

```javascript
const { chat } = require('@googleapis/chat');

const chatClient = chat({ version: 'v1', auth });

// Send message
await chatClient.spaces.messages.create({
  parent: spaceName,
  requestBody: {
    text: 'Hello!',
    thread: { name: threadName }
  }
});
```

### Event Types Handled

| Event Type | Description |
|------------|-------------|
| `MESSAGE` | New message received |
| `ADDED_TO_SPACE` | Bot added to space |
| `REMOVED_FROM_SPACE` | Bot removed from space |
| `CARD_CLICKED` | Card button clicked |

### CX Agent Studio API

See the CES client module for `runSession` and `BidiRunSession` implementations.

## Deployment Options

### 1. HTTP Endpoint (Default)

Express server receiving events directly from Google Chat.

### 2. Cloud Pub/Sub

For high-volume or more reliable message delivery:

```bash
# Create topic
gcloud pubsub topics create chat-bot-events

# Create subscription
gcloud pubsub subscriptions create chat-bot-sub \
    --topic=chat-bot-events
```

### 3. Cloud Run (Recommended)

Serverless deployment with automatic scaling and HTTPS.

### 4. Cloud Functions

Simple serverless deployment for single-function bots.

## Troubleshooting

### Common Issues

#### 1. Bot Not Responding

**Checks:**
1. Verify the endpoint URL in Chat API configuration
2. Check that the service account has correct permissions
3. Review Cloud Logging for errors
4. Ensure the bot is published (not in draft)

#### 2. 403 Forbidden

**Error:** Permission denied when calling Chat API

**Solution:**
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:YOUR_SA@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/chat.bot"
```

#### 3. Authentication Errors

**Error:** Could not load default credentials

**Solution:**
- For local development: Set `GOOGLE_APPLICATION_CREDENTIALS`
- For Cloud Run: Use `--service-account` flag
- For Cloud Functions: Configure service account in deployment

#### 4. Message Not Delivered

**Checks:**
1. Verify bot is added to the space
2. Check bot permissions (1:1 messages, spaces enabled)
3. Review event logs for errors

### Logging

Enable debug logging:

```bash
export LOG_LEVEL=debug
npm start
```

View Cloud Run logs:
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit=50
```

### Health Check

The server exposes:
- `GET /health` - Health check endpoint
- `GET /` - Basic info endpoint

## Project Structure

```
google-chat/
├── README.md                 # This file
├── package.json              # Node.js dependencies
├── .env.example              # Environment variables template
├── Dockerfile                # Docker build file
├── docker-compose.yml        # Docker Compose configuration
└── src/
    ├── index.js              # Main entry point
    ├── config.js             # Configuration management
    ├── cesClient.js          # CX Agent Studio API client
    ├── chatClient.js         # Google Chat API client
    └── handlers/
        ├── message.js        # Message event handler
        ├── space.js          # Space events handler
        └── card.js           # Card action handler
```

## Resources

- [Google Chat API Documentation](https://developers.google.com/chat)
- [Building Chat Apps](https://developers.google.com/chat/how-tos/apps-script)
- [Chat API Reference](https://developers.google.com/chat/api/reference/rest)
- [CX Agent Studio Documentation](https://cloud.google.com/customer-engagement-ai/conversational-agents)

## License

This project is provided as a reference implementation for integrating CX Agent Studio with Google Chat.
