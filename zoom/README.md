# Zoom Integration for CX Agent Studio

This integration enables you to deploy your CX Agent Studio agent application across multiple Zoom products including Team Chat, Virtual Agent, Contact Center, and Phone.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Supported Zoom Products](#supported-zoom-products)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Create a Zoom App](#1-create-a-zoom-app)
  - [2. Configure App Permissions](#2-configure-app-permissions)
  - [3. Set Up CX Agent Studio API Access](#3-set-up-cx-agent-studio-api-access)
  - [4. Configure Google Cloud Authentication](#4-configure-google-cloud-authentication)
  - [5. Deploy the Integration](#5-deploy-the-integration)
- [Configuration](#configuration)
- [Features](#features)
- [API Reference](#api-reference)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)

## Overview

This integration uses the CX Agent Studio API access deployment option to connect Zoom's messaging and communication platforms with your agent application. The integration supports:

- **Zoom Team Chat**: Bot interactions in Team Chat channels and direct messages
- **Zoom Virtual Agent**: AI-powered virtual agent for customer interactions
- **Zoom Contact Center**: Integration with contact center workflows
- **Zoom Phone**: SMS and voice interactions (future)

### Features

- Real-time message handling via Zoom webhooks
- OAuth 2.0 authentication with Zoom API
- Session management per conversation/channel
- Support for Team Chat commands and mentions
- Virtual Agent handoff integration
- Contact Center variable management
- Docker support for easy deployment
- Health check endpoint for monitoring

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  Zoom Platform  │────▶│  Zoom Bot       │────▶│  CX Agent Studio     │
│  (Team Chat,    │◀────│  Integration    │◀────│       API            │
│   VA, CC)       │     └─────────────────┘     └──────────────────────┘
└─────────────────┘              │
        │                        │
   Webhooks/API                  ▼
                         ┌─────────────────┐
                         │  Google Cloud   │
                         │  Authentication │
                         └─────────────────┘
```

## Supported Zoom Products

### Zoom Team Chat
- Bot messages in channels and DMs
- Slash commands
- Interactive messages with buttons/actions
- File sharing support

### Zoom Virtual Agent
- Conversational AI integration
- Intent recognition handoff
- Context passing to CX Agent Studio
- Session management

### Zoom Contact Center
- Agent assist functionality
- Variable management
- Queue integration
- Customer data passthrough

### Zoom Phone (Planned)
- SMS messaging
- Call transcription integration

## Prerequisites

1. **Zoom Account** with developer access
2. **Zoom Marketplace** app registration
3. **Google Cloud Project** with CX Agent Studio enabled
4. **CX Agent Studio Application** with an agent configured
5. **API Access Channel** created in CX Agent Studio
6. **Node.js 18+** installed
7. **Public HTTPS URL** for webhooks (use ngrok for development)

## Setup Guide

### 1. Create a Zoom App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click **Develop** > **Build App**
3. Select **Team Chat Apps** (for Team Chat integration)
4. Click **Create**
5. Provide app details:
   - App Name: "CX Agent Bot"
   - Short Description: "AI-powered assistant using CX Agent Studio"
   - Company Name: Your company name

#### For Virtual Agent Integration

1. In Zoom Admin Portal, go to **Contact Center** > **Virtual Agent**
2. Create or configure a Virtual Agent flow
3. Note the Virtual Agent ID for webhook configuration

### 2. Configure App Permissions

#### Team Chat App Scopes

In your Zoom App settings, add these OAuth scopes:

**Chat Scopes:**
- `team_chat:read` - Read Team Chat messages
- `team_chat:write` - Send Team Chat messages
- `team_chat:read:admin` - Read as admin (optional)
- `team_chat:write:admin` - Write as admin (optional)

**User Scopes:**
- `user:read` - Read user information

**Bot Scopes:**
- `imchat:bot` - Bot chat functionality
- `imchat:read:admin` - Read bot messages
- `imchat:write:admin` - Write bot messages

#### Configure Webhooks

1. In your app settings, go to **Feature** > **Event Subscriptions**
2. Enable **Event Subscriptions**
3. Add your webhook URL: `https://your-domain.com/webhooks/zoom`
4. Subscribe to events:
   - `team_chat.message_received` - Incoming messages
   - `team_chat.bot_notification` - Bot notifications
   - `team_chat.channel_message_posted` - Channel messages

#### Get Credentials

From your Zoom App settings, note:
- **Client ID**
- **Client Secret**
- **Bot JID** (for Team Chat)
- **Verification Token** (for webhook validation)
- **Secret Token** (for webhook signature verification)

### 3. Set Up CX Agent Studio API Access

1. Open your CX Agent Studio application in the Google Cloud Console
2. Click **Deploy** at the top of the agent builder
3. Click **New channel**
4. Select **Set up API access**
5. Provide a channel name (e.g., "zoom-bot")
6. Select or create an agent application version
7. Click **Create channel**

Note the deployment details:
```
projects/PROJECT_ID/locations/REGION_ID/apps/APPLICATION_ID/deployments/DEPLOYMENT_ID
```

### 4. Configure Google Cloud Authentication

#### Option A: Service Account (Recommended)

```bash
# Create service account
gcloud iam service-accounts create zoom-bot-sa \
    --display-name="Zoom Bot Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:zoom-bot-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/dialogflow.client"

# Create key file
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=zoom-bot-sa@PROJECT_ID.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### Option B: User Credentials (Development Only)

```bash
gcloud auth application-default login
```

### 5. Deploy the Integration

#### Local Development

1. Navigate to the zoom folder:
```bash
cd zoom
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
# Zoom credentials
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_BOT_JID=your_bot_jid
ZOOM_VERIFICATION_TOKEN=your_verification_token
ZOOM_SECRET_TOKEN=your_secret_token
ZOOM_WEBHOOK_URL=https://your-domain.com/webhooks/zoom

# Google Cloud settings
GCP_PROJECT_ID=your_project_id
GCP_REGION=us
CES_APP_ID=your_app_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Server settings
PORT=3000
```

5. Start the server:
```bash
npm start
```

6. For development with ngrok:
```bash
# In another terminal
ngrok http 3000
# Update ZOOM_WEBHOOK_URL with the ngrok URL
```

#### Docker Deployment

```bash
docker build -t zoom-ces-bot .
docker run -d \
    --name zoom-ces-bot \
    --env-file .env \
    -p 3000:3000 \
    -v /path/to/service-account-key.json:/app/credentials.json \
    zoom-ces-bot
```

#### Docker Compose Deployment

```bash
docker-compose up -d
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZOOM_CLIENT_ID` | Yes | Zoom OAuth Client ID |
| `ZOOM_CLIENT_SECRET` | Yes | Zoom OAuth Client Secret |
| `ZOOM_BOT_JID` | Yes* | Bot JID for Team Chat |
| `ZOOM_VERIFICATION_TOKEN` | Yes | Webhook verification token |
| `ZOOM_SECRET_TOKEN` | Yes | Webhook signature secret |
| `ZOOM_WEBHOOK_URL` | Yes | Public webhook URL |
| `ZOOM_ACCOUNT_ID` | No | Account ID for Server-to-Server OAuth |
| `GCP_PROJECT_ID` | Yes | Google Cloud Project ID |
| `GCP_REGION` | Yes | CX Agent Studio region |
| `CES_APP_ID` | Yes | CX Agent Studio Application ID |
| `CES_DEPLOYMENT_ID` | No | Deployment ID (optional) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes** | Path to service account key |
| `USE_BIDI_SESSION` | No | Use bidirectional streaming |
| `PORT` | No | Server port (default: 3000) |
| `LOG_LEVEL` | No | Logging level (default: info) |

*Required for Team Chat integration
**Not required if using Application Default Credentials

### Session Management

Sessions are managed per:
- **Team Chat**: `zoom-chat-{channel_id}` or `zoom-dm-{user_jid}`
- **Virtual Agent**: `zoom-va-{session_id}`
- **Contact Center**: `zoom-cc-{engagement_id}`

## Features

### Team Chat Bot

The bot responds to:
- Direct messages to the bot
- @mentions in channels
- Slash commands (configurable)

Example interactions:
```
User: @CXAgentBot What are your store hours?
Bot: Our stores are open Monday-Friday 9 AM to 6 PM...

User: /ask How do I reset my password?
Bot: To reset your password, follow these steps...
```

### Interactive Messages

Support for Zoom's interactive message components:
- Buttons
- Dropdowns
- Form inputs

### Virtual Agent Handoff

When integrated with Zoom Virtual Agent:
1. VA receives customer query
2. VA calls CX Agent Studio API
3. Response is returned to customer
4. Context is maintained throughout conversation

### Contact Center Integration

Variables and context can be passed between:
- Zoom Contact Center
- CX Agent Studio
- Human agents (for escalation)

## API Reference

### Zoom API Endpoints Used

#### Team Chat
- `POST /v2/chat/users/{userId}/messages` - Send message
- `GET /v2/chat/users/{userId}/channels` - List channels
- `POST /v2/chat/users/{userId}/channels/{channelId}/messages` - Send channel message

#### Virtual Agent
- Webhook events for conversation flow
- Context variable management

#### Contact Center
- `GET /v2/contact_center/variables` - Get variables
- `POST /v2/contact_center/variables` - Create variables

### Webhook Events Handled

| Event | Description |
|-------|-------------|
| `team_chat.message_received` | New message received |
| `team_chat.bot_notification` | Bot-specific notification |
| `team_chat.channel_message_posted` | Channel message posted |
| `endpoint.url_validation` | Webhook URL validation |

### CX Agent Studio API

See the CES client module for `runSession` and `BidiRunSession` implementations.

## Deployment Options

### 1. Express Server (Default)

Webhook server using Express.js for receiving Zoom events.

### 2. Cloud Functions

Deploy as serverless function on Google Cloud Functions or AWS Lambda.

### 3. Kubernetes

Use the provided Dockerfile with Kubernetes for scalable deployment.

## Troubleshooting

### Common Issues

#### 1. Webhook Validation Failed

**Error:** Zoom cannot validate webhook URL

**Solution:**
- Ensure server is publicly accessible (use ngrok for development)
- Verify `ZOOM_VERIFICATION_TOKEN` is correct
- Check that `/webhooks/zoom` endpoint responds to validation requests

#### 2. Invalid Token

**Error:** `401 Unauthorized` from Zoom API

**Solution:**
- Regenerate OAuth credentials
- Check token expiration and refresh logic
- Verify scopes are correctly configured

#### 3. Bot Not Responding

**Checks:**
1. Verify webhook events are being received (check logs)
2. Ensure bot has proper permissions in channels
3. Check CX Agent Studio connectivity
4. Review error logs

#### 4. Authentication Errors (Google Cloud)

**Error:** `google.auth.exceptions.DefaultCredentialsError`

**Solution:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### Logging

Enable debug logging:
```bash
export LOG_LEVEL=debug
npm start
```

### Health Check

The server exposes:
- `GET /health` - Health check endpoint
- `GET /` - Basic info endpoint

## Project Structure

```
zoom/
├── README.md                 # This file
├── package.json              # Node.js dependencies
├── .env.example              # Environment variables template
├── Dockerfile                # Docker build file
├── docker-compose.yml        # Docker Compose configuration
└── src/
    ├── index.js              # Main entry point
    ├── config.js             # Configuration management
    ├── cesClient.js          # CX Agent Studio API client
    ├── services/
    │   ├── zoomAuth.js       # Zoom OAuth handling
    │   ├── zoomChat.js       # Team Chat service
    │   ├── zoomVA.js         # Virtual Agent service
    │   └── zoomCC.js         # Contact Center service
    └── webhooks/
        ├── index.js          # Webhook router
        ├── teamChat.js       # Team Chat webhooks
        ├── virtualAgent.js   # Virtual Agent webhooks
        └── validation.js     # Webhook validation
```

## Resources

- [Zoom Developer Documentation](https://developers.zoom.us/docs/)
- [Zoom Team Chat API](https://developers.zoom.us/docs/api/team-chat/)
- [Zoom Virtual Agent API](https://developers.zoom.us/docs/api/virtual-agent/)
- [Zoom Contact Center API](https://developers.zoom.us/docs/api/contact-center/)
- [Zoom App Marketplace](https://marketplace.zoom.us/)
- [CX Agent Studio Documentation](https://cloud.google.com/customer-engagement-ai/conversational-agents)

## License

This project is provided as a reference implementation for integrating CX Agent Studio with Zoom.
