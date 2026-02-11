# Discord Bot Integration for CX Agent Studio

This integration enables you to deploy your CX Agent Studio agent application as a Discord bot, allowing users to interact with your conversational AI through Discord servers, direct messages, and voice channels.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Create a Discord Application](#1-create-a-discord-application)
  - [2. Configure Bot Permissions](#2-configure-bot-permissions)
  - [3. Set Up CX Agent Studio API Access](#3-set-up-cx-agent-studio-api-access)
  - [4. Configure Google Cloud Authentication](#4-configure-google-cloud-authentication)
  - [5. Deploy the Integration](#5-deploy-the-integration)
- [Configuration](#configuration)
- [Features](#features)
- [Voice Channel Support](#voice-channel-support)
- [Slash Commands](#slash-commands)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)

## Overview

This integration uses the CX Agent Studio API access deployment option to connect a Discord bot with your agent application. The bot listens for messages and slash commands via Discord's Gateway WebSocket API and uses the `runSession` method to communicate with your CX Agent Studio agent.

### Features

- Real-time message handling via Discord Gateway WebSocket
- Slash command support (`/ask`, `/reset`, `/help`, `/join`, `/leave`)
- Session management per Discord channel/thread
- Support for direct messages and server channels
- Thread-based conversation continuity
- **Voice channel support** with auto-join and auto-leave
- Bidirectional streaming support (BidiRunSession)
- Docker support for easy deployment
- Health check endpoint for monitoring

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│   Discord   │────▶│   Discord Bot   │────▶│  CX Agent Studio     │
│   Server    │◀────│   Integration   │◀────│       API            │
└─────────────┘     └─────────────────┘     └──────────────────────┘
      │                    │
      │             Discord Gateway
      │              (WebSocket)
      │                    │
      ▼                    ▼
┌─────────────┐     ┌─────────────────┐
│   Voice     │     │  Google Cloud   │
│   Channels  │     │  Authentication │
└─────────────┘     └─────────────────┘
```

## Prerequisites

1. **Google Cloud Project** with CX Agent Studio enabled
2. **CX Agent Studio Application** with an agent configured
3. **API Access Channel** created in CX Agent Studio
4. **Discord Account** with a server you can add bots to
5. **Node.js 18+** installed
6. **Google Cloud SDK** (gcloud) installed and configured

## Setup Guide

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Enter an application name (e.g., "CX Agent Bot")
4. Click **Create**

#### Configure the Bot

1. In the left sidebar, click **Bot**
2. Click **Add Bot** and confirm
3. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent** (required for reading message content)
   - **Server Members Intent** (optional, for member info)
4. Click **Reset Token** and copy your bot token (save it securely!)

#### Get Application ID

1. In the left sidebar, click **General Information**
2. Copy the **Application ID** (you'll need this for registering commands)

### 2. Configure Bot Permissions

#### Generate Invite URL

1. In the left sidebar, click **OAuth2** > **URL Generator**
2. Under **Scopes**, select:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, select:
   - `Send Messages`
   - `Send Messages in Threads`
   - `Read Message History`
   - `Use Slash Commands`
   - `Embed Links`
   - `Attach Files`
   - `Add Reactions`
   - `Connect` (for voice channels)
   - `Speak` (for voice channels)
4. Copy the generated URL and open it in a browser
5. Select a server and authorize the bot

#### Required Permissions Integer

If you need the permissions integer: `3246080`

### 3. Set Up CX Agent Studio API Access

1. Open your CX Agent Studio application in the Google Cloud Console
2. Click **Deploy** at the top of the agent builder
3. Click **New channel**
4. Select **Set up API access**
5. Provide a channel name (e.g., "discord-bot")
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

**Example Deployment ID:**
```
projects/discord-bot-8fdf5/locations/us/apps/804e6e6c-115e-4da2-bbae-373d79929398/deployments/d3f12f5f-5fe1-4413-9d92-0c009b03db9c
```

### 4. Configure Google Cloud Authentication

#### Option A: Service Account (Recommended for Production)

1. Create a service account:
```bash
gcloud iam service-accounts create discord-bot-sa \
    --display-name="Discord Bot Service Account"
```

2. Grant necessary permissions:
```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="serviceAccount:discord-bot-sa@PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/dialogflow.client"
```

3. Create and download a key file:
```bash
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=discord-bot-sa@PROJECT_ID.iam.gserviceaccount.com
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

1. Clone this repository and navigate to the discord folder:
```bash
cd discord
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
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_application_id
GCP_PROJECT_ID=discord-bot-8fdf5
GCP_REGION=us
CES_APP_ID=804e6e6c-115e-4da2-bbae-373d79929398
CES_DEPLOYMENT_ID=d3f12f5f-5fe1-4413-9d92-0c009b03db9c
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

5. Register slash commands (run once):
```bash
npm run deploy-commands
```

6. Start the bot:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

#### Docker Deployment

1. Build the Docker image:
```bash
docker build -t discord-ces-bot .
```

2. Run with Docker:
```bash
docker run -d \
    --name discord-ces-bot \
    --env-file .env \
    -v /path/to/service-account-key.json:/app/credentials.json \
    -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
    discord-ces-bot
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
gcloud builds submit --tag gcr.io/PROJECT_ID/discord-ces-bot
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy discord-ces-bot \
    --image gcr.io/PROJECT_ID/discord-ces-bot \
    --platform managed \
    --region us-central1 \
    --set-env-vars="DISCORD_BOT_TOKEN=YOUR_TOKEN,DISCORD_CLIENT_ID=YOUR_ID,GCP_PROJECT_ID=PROJECT_ID,GCP_REGION=us,CES_APP_ID=APP_ID,CES_DEPLOYMENT_ID=DEPLOYMENT_ID" \
    --allow-unauthenticated
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application ID from Discord Developer Portal |
| `GCP_PROJECT_ID` | Yes | Google Cloud Project ID |
| `GCP_REGION` | Yes | CX Agent Studio region (e.g., `us`, `eu`) |
| `CES_APP_ID` | Yes | CX Agent Studio Application ID |
| `CES_DEPLOYMENT_ID` | No | Deployment ID (optional) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account key file |
| `USE_BIDI_SESSION` | No | Use bidirectional streaming (default: `false`) |
| `RESPOND_TO_MENTIONS_ONLY` | No | Only respond when mentioned (default: `false`) |
| `VOICE_ENABLED` | No | Enable voice channel support (default: `true`) |
| `VOICE_AUTO_JOIN` | No | Auto-join voice channels (default: `false`) |
| `VOICE_AUTO_LEAVE` | No | Auto-leave when alone (default: `true`) |
| `VOICE_AUTO_LEAVE_DELAY` | No | Delay before auto-leaving in ms (default: `30000`) |
| `LOG_LEVEL` | No | Logging level (default: `info`) |
| `HEALTH_CHECK_PORT` | No | Health check endpoint port (default: `8080`) |

*Not required if using Application Default Credentials

### Session ID Generation

Session IDs are automatically generated per Discord channel/thread using the format:
```
discord-{channel_id}-{thread_id or 'main'}
```

For voice channels:
```
voice-{guild_id}-{channel_id}-{user_id}
```

This ensures conversation continuity within each channel/thread while maintaining isolation.

## Features

### Message Handling

The bot responds to:
- **Direct Messages**: All DMs with the bot
- **Channel Mentions**: Messages that @mention the bot
- **Channel Messages**: All messages in channels (configurable)
- **Voice Channel Text Chat**: Messages in voice channel text chat

### Thread Support

- Conversations in threads maintain separate session context
- Replies continue the thread conversation
- Thread IDs are used for session identification

### Typing Indicator

The bot shows a typing indicator while processing requests.

### Embeds

Responses are formatted using Discord embeds for better presentation.

## Voice Channel Support

The bot supports Discord voice channels with the following features:

### Voice Commands

| Command | Description |
|---------|-------------|
| `/join [channel]` | Join a voice channel (defaults to your current channel) |
| `/leave` | Leave the current voice channel |

### Auto-Join Feature

When enabled (`VOICE_AUTO_JOIN=true`), the bot will automatically join a voice channel when a user enters it.

### Auto-Leave Feature

When enabled (`VOICE_AUTO_LEAVE=true`, default), the bot will automatically leave a voice channel after a configured delay when it becomes the only member in the channel.

### Voice Channel Text Chat

While in a voice channel, users can interact with the bot using:
- Text messages in the voice channel's text chat
- @mentioning the bot in any text channel
- Using slash commands (`/ask`, `/help`, etc.)

### Voice Channel Permissions

Ensure the bot has these permissions in voice channels:
- **Connect**: To join voice channels
- **Speak**: To be present in the channel

## Slash Commands

| Command | Description |
|---------|-------------|
| `/ask [question]` | Ask the AI agent a question |
| `/reset` | Reset your conversation session |
| `/help` | Show help information |
| `/join [channel]` | Join a voice channel |
| `/leave` | Leave the current voice channel |

### Registering Commands

Commands must be registered with Discord before use:

```bash
# Register commands globally (takes up to 1 hour to propagate)
npm run deploy-commands

# Register commands to a specific guild (instant)
DISCORD_GUILD_ID=your_guild_id npm run deploy-commands
```

## API Reference

### CX Agent Studio API

#### runSession (Node.js)

```javascript
const { SessionServiceClient } = require('@google-cloud/ces');

const sessionClient = new SessionServiceClient();
const sessionName = `projects/${PROJECT_ID}/locations/${REGION}/apps/${APP_ID}/sessions/${SESSION_ID}`;

const request = {
  config: { session: sessionName },
  inputs: [{ text: 'Hello!' }]
};

const [response] = await sessionClient.runSession(request);
```

#### BidiRunSession (WebSocket)

```javascript
const WebSocket = require('ws');

const uri = 'wss://ces.googleapis.com/ws/google.cloud.ces.v1.SessionService/BidiRunSession/locations/us';

const ws = new WebSocket(uri, {
  headers: { Authorization: `Bearer ${token}` }
});

ws.on('open', () => {
  // Send config
  ws.send(JSON.stringify({ config: { session: sessionName } }));
  // Send query
  ws.send(JSON.stringify({ realtimeInput: { text: 'Hello!' } }));
});

ws.on('message', (message) => {
  console.log('Response:', message.toString());
});
```

### Discord API

- **API Version**: 10
- **Gateway**: WebSocket connection for real-time events
- **REST API**: For sending messages and managing resources
- **Voice**: @discordjs/voice for voice channel connections

## Deployment Options

### 1. Gateway Mode (Default)

Uses WebSocket connection to Discord Gateway for receiving events.

```javascript
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates, // For voice channel support
  ]
});

client.login(token);
```

### 2. Interactions Endpoint (Advanced)

For serverless deployments, you can use Discord's Interactions Endpoint URL feature.

## Troubleshooting

### Common Issues

#### 1. Bot Not Responding to Messages

**Checks:**
- Verify Message Content Intent is enabled in Discord Developer Portal
- Ensure bot has proper permissions in the channel
- Check if `RESPOND_TO_MENTIONS_ONLY` is set correctly

#### 2. Slash Commands Not Showing

**Solutions:**
- Run `npm run deploy-commands` to register commands
- Wait up to 1 hour for global commands to propagate
- Use guild-specific commands for instant updates

#### 3. Authentication Errors

**Error:** `google.auth.exceptions.DefaultCredentialsError`

**Solution:** Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set correctly:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### 4. Permission Denied from CX Agent Studio

**Error:** `403 Permission denied`

**Solution:** Ensure the service account has required IAM roles:
- `roles/dialogflow.client`

#### 5. Invalid Token

**Error:** `An invalid token was provided`

**Solution:**
- Regenerate bot token in Discord Developer Portal
- Update `DISCORD_BOT_TOKEN` in your `.env` file

#### 6. Bot Cannot Join Voice Channel

**Checks:**
- Ensure bot has `Connect` and `Speak` permissions
- Check if voice is enabled (`VOICE_ENABLED=true`)
- Verify the channel is a voice or stage channel

#### 7. Bot Not Auto-Leaving Voice Channel

**Checks:**
- Verify `VOICE_AUTO_LEAVE=true`
- Check `VOICE_AUTO_LEAVE_DELAY` setting
- Ensure no other users are in the channel

### Logging

Enable debug logging for troubleshooting:

```bash
export LOG_LEVEL=debug
npm start
```

### Health Check

The bot exposes a health check endpoint at `http://localhost:8080/health` for monitoring.

## Project Structure

```
discord/
├── README.md                 # This file
├── package.json              # Node.js dependencies
├── .env.example              # Environment variables template
├── Dockerfile                # Docker build file
├── docker-compose.yml        # Docker Compose configuration
└── src/
    ├── index.js              # Main entry point
    ├── config.js             # Configuration management
    ├── cesClient.js          # CX Agent Studio API client
    ├── voiceManager.js       # Voice channel manager
    ├── deploy-commands.js    # Slash command registration
    ├── commands/
    │   ├── ask.js            # /ask command
    │   ├── reset.js          # /reset command
    │   ├── help.js           # /help command
    │   ├── join.js           # /join command (voice)
    │   └── leave.js          # /leave command (voice)
    └── events/
        ├── ready.js          # Bot ready event
        ├── messageCreate.js  # Message handler
        ├── interactionCreate.js  # Slash command handler
        └── voiceStateUpdate.js   # Voice state handler
```

## Resources

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord.js Documentation](https://discord.js.org/)
- [Discord API Documentation](https://discord.com/developers/docs)
- [Discord.js Voice Documentation](https://discordjs.guide/voice/)
- [CX Agent Studio Documentation](https://cloud.google.com/customer-engagement-ai/conversational-agents)
- [CX Agent Studio API Access](https://cloud.google.com/customer-engagement-ai/conversational-agents/docs/deploy/api-access)

## License

This project is provided as a reference implementation for integrating CX Agent Studio with Discord.
