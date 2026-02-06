# WhatsApp Business Integration for CX Agent Studio

This integration enables you to deploy your CX Agent Studio agent application on WhatsApp Business, allowing customers to interact with your conversational AI through WhatsApp messaging.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Create a Meta Developer Account](#1-create-a-meta-developer-account)
  - [2. Create a Meta App](#2-create-a-meta-app)
  - [3. Configure WhatsApp Business](#3-configure-whatsapp-business)
  - [4. Set Up Webhooks](#4-set-up-webhooks)
  - [5. Set Up CX Agent Studio API Access](#5-set-up-cx-agent-studio-api-access)
  - [6. Deploy the Integration](#6-deploy-the-integration)
- [Configuration](#configuration)
- [Features](#features)
- [Message Types](#message-types)
- [Deployment Options](#deployment-options)
- [Troubleshooting](#troubleshooting)

## Overview

This integration uses the WhatsApp Business Cloud API (via Meta) to connect WhatsApp messaging with your CX Agent Studio agent application. The bot receives messages via webhooks and uses the `runSession` method to communicate with your agent.

### Features

- Real-time message handling via Meta webhooks
- Support for text messages, images, documents, and location
- Interactive messages (buttons, lists)
- Message templates for notifications
- Session management per phone number
- Read receipts and typing indicators
- Media message handling
- Docker support for easy deployment
- Health check endpoint for monitoring

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│    WhatsApp     │────▶│  WhatsApp Bot   │────▶│  CX Agent Studio     │
│    Users        │◀────│  Integration    │◀────│       API            │
└─────────────────┘     └─────────────────┘     └──────────────────────┘
        │                       │
   Meta Cloud API               │
   (Webhooks)                   ▼
                        ┌─────────────────┐
                        │  Google Cloud   │
                        │  Authentication │
                        └─────────────────┘
```

## Prerequisites

1. **Meta Developer Account** at [developers.facebook.com](https://developers.facebook.com)
2. **Meta Business Account** (for production)
3. **WhatsApp Business Account** linked to Meta Business
4. **Phone Number** for WhatsApp Business
5. **Google Cloud Project** with CX Agent Studio enabled
6. **CX Agent Studio Application** with an agent configured
7. **Node.js 18+** installed
8. **Public HTTPS URL** for webhooks

## Setup Guide

### 1. Create a Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **Get Started** or **My Apps**
3. Create a developer account if you don't have one
4. Verify your account

### 2. Create a Meta App

1. Go to [Meta App Dashboard](https://developers.facebook.com/apps/)
2. Click **Create App**
3. Select **Business** as the app type
4. Fill in app details:
   - App Name: "CX Agent WhatsApp Bot"
   - App Contact Email: Your email
   - Business Account: Select or create one
5. Click **Create App**

### 3. Configure WhatsApp Business

#### Add WhatsApp Product

1. In your app dashboard, click **Add Product**
2. Find **WhatsApp** and click **Set Up**
3. Select or create a **WhatsApp Business Account**

#### Get API Credentials

From the WhatsApp > API Setup page, note:

| Credential | Description |
|------------|-------------|
| **Phone Number ID** | ID of your WhatsApp business phone number |
| **WhatsApp Business Account ID** | Your WABA ID |
| **Access Token** | Temporary or permanent access token |

#### Generate Permanent Token (Recommended for Production)

1. Go to **Business Settings** > **System Users**
2. Create a system user with **Admin** role
3. Add the WhatsApp app to the system user
4. Generate a token with these permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`

#### Add a Phone Number

For testing:
- Use the provided test phone number
- Add your personal number as a recipient

For production:
1. Go to **WhatsApp** > **Phone Numbers**
2. Click **Add Phone Number**
3. Verify your business phone number
4. Complete business verification

### 4. Set Up Webhooks

#### Configure Webhook URL

1. In WhatsApp > Configuration, find **Webhook**
2. Click **Edit**
3. Enter your webhook URL: `https://your-domain.com/webhook`
4. Enter a **Verify Token** (create your own secret string)
5. Click **Verify and Save**

#### Subscribe to Webhook Fields

Subscribe to these webhook fields:
- `messages` - Incoming messages
- `messaging_postbacks` - Button responses
- `message_deliveries` - Delivery receipts (optional)
- `message_reads` - Read receipts (optional)

### 5. Set Up CX Agent Studio API Access

1. Open your CX Agent Studio application in the Google Cloud Console
2. Click **Deploy** at the top of the agent builder
3. Click **New channel**
4. Select **Set up API access**
5. Provide a channel name (e.g., "whatsapp-bot")
6. Select or create an agent application version
7. Click **Create channel**

Note the deployment details:
```
projects/PROJECT_ID/locations/REGION_ID/apps/APPLICATION_ID/deployments/DEPLOYMENT_ID
```

### 6. Deploy the Integration

#### Service Account Setup

```bash
# Create service account
gcloud iam service-accounts create whatsapp-bot-sa \
    --display-name="WhatsApp Bot Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:whatsapp-bot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/dialogflow.client"

# Create key file
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=whatsapp-bot-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### Local Development

1. Navigate to the whatsapp folder:
```bash
cd whatsapp
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
# Meta/WhatsApp credentials
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token

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

6. For development, use ngrok:
```bash
ngrok http 3000
# Update webhook URL in Meta App Dashboard
```

#### Docker Deployment

```bash
docker build -t whatsapp-ces-bot .
docker run -d \
    --name whatsapp-ces-bot \
    --env-file .env \
    -p 3000:3000 \
    -v /path/to/service-account-key.json:/app/credentials.json \
    whatsapp-ces-bot
```

#### Docker Compose Deployment

```bash
docker-compose up -d
```

#### Google Cloud Run Deployment

```bash
# Build and push
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/whatsapp-ces-bot

# Deploy
gcloud run deploy whatsapp-ces-bot \
    --image gcr.io/YOUR_PROJECT_ID/whatsapp-ces-bot \
    --platform managed \
    --region us-central1 \
    --set-env-vars="WHATSAPP_ACCESS_TOKEN=TOKEN,WHATSAPP_PHONE_NUMBER_ID=ID,WHATSAPP_VERIFY_TOKEN=SECRET,GCP_PROJECT_ID=PROJECT,GCP_REGION=us,CES_APP_ID=APP_ID" \
    --allow-unauthenticated
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WHATSAPP_ACCESS_TOKEN` | Yes | Meta API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | WhatsApp phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Yes | WhatsApp Business Account ID |
| `WHATSAPP_VERIFY_TOKEN` | Yes | Webhook verification token |
| `WHATSAPP_API_VERSION` | No | API version (default: `v18.0`) |
| `GCP_PROJECT_ID` | Yes | Google Cloud Project ID |
| `GCP_REGION` | Yes | CX Agent Studio region |
| `CES_APP_ID` | Yes | CX Agent Studio Application ID |
| `CES_DEPLOYMENT_ID` | No | Deployment ID (optional) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account key |
| `USE_BIDI_SESSION` | No | Use bidirectional streaming |
| `PORT` | No | Server port (default: `3000`) |
| `LOG_LEVEL` | No | Logging level (default: `info`) |

*Not required on Cloud Run with proper IAM

### Session Management

Sessions are managed per WhatsApp phone number:
```
whatsapp-{phone_number}
```

This ensures conversation continuity for each customer.

## Features

### Supported Incoming Message Types

| Type | Description | Handling |
|------|-------------|----------|
| `text` | Plain text messages | Sent to CX Agent Studio |
| `image` | Image with optional caption | Caption extracted |
| `document` | Documents/files | Filename noted |
| `audio` | Voice messages | Transcription (if enabled) |
| `video` | Video messages | Caption extracted |
| `location` | Location sharing | Coordinates extracted |
| `contacts` | Contact cards | Contact info extracted |
| `interactive` | Button/list responses | Selection sent to agent |

### Supported Outgoing Message Types

| Type | Description |
|------|-------------|
| `text` | Plain text responses |
| `image` | Image with caption |
| `document` | Document/file sharing |
| `interactive` | Buttons and lists |
| `template` | Pre-approved templates |
| `reaction` | Message reactions |

### Interactive Messages

#### Reply Buttons (up to 3)
```javascript
{
  type: 'button',
  body: { text: 'Choose an option:' },
  action: {
    buttons: [
      { type: 'reply', reply: { id: 'btn1', title: 'Option 1' } },
      { type: 'reply', reply: { id: 'btn2', title: 'Option 2' } }
    ]
  }
}
```

#### List Messages (up to 10 items)
```javascript
{
  type: 'list',
  body: { text: 'Select from menu:' },
  action: {
    button: 'View Options',
    sections: [{
      title: 'Section 1',
      rows: [
        { id: 'item1', title: 'Item 1', description: 'Description' }
      ]
    }]
  }
}
```

### Message Templates

For proactive messaging (24+ hours after last customer message):

```javascript
await whatsappClient.sendTemplate(phoneNumber, 'template_name', 'en', [
  { type: 'text', text: 'John' },  // Parameter 1
  { type: 'text', text: 'Order123' }  // Parameter 2
]);
```

## API Reference

### WhatsApp Cloud API

Base URL: `https://graph.facebook.com/{version}/{phone-number-id}/messages`

#### Send Message
```bash
POST /{phone-number-id}/messages
Authorization: Bearer {access-token}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "recipient-phone-number",
  "type": "text",
  "text": { "body": "Hello!" }
}
```

### Webhook Events

| Event | Field | Description |
|-------|-------|-------------|
| Message Received | `messages` | New incoming message |
| Message Status | `statuses` | Sent/delivered/read status |
| Button Click | `messages` (interactive) | User clicked button |

## Deployment Options

### 1. Express Server (Default)

Webhook server for receiving WhatsApp events.

### 2. Cloud Run (Recommended)

Serverless with automatic HTTPS and scaling.

### 3. Cloud Functions

Simple serverless deployment.

### 4. Kubernetes

Use provided Dockerfile for K8s deployment.

## Troubleshooting

### Common Issues

#### 1. Webhook Verification Failed

**Error:** Meta cannot verify webhook URL

**Solution:**
- Ensure server is publicly accessible with HTTPS
- Check `WHATSAPP_VERIFY_TOKEN` matches what you entered in Meta dashboard
- Verify the `/webhook` GET endpoint returns the challenge

#### 2. Messages Not Being Received

**Checks:**
1. Webhook is verified and subscribed to `messages` field
2. Phone number is correctly configured
3. Access token has required permissions
4. Server logs show incoming requests

#### 3. Cannot Send Messages

**Error:** `(#131030) Recipient phone number not in allowed list`

**Solution:**
- For test numbers, add recipients in Meta App Dashboard
- For production, complete business verification

#### 4. 24-Hour Window Expired

**Error:** Cannot send message outside conversation window

**Solution:**
- Use an approved message template
- Wait for customer to initiate conversation

#### 5. Authentication Errors (Google Cloud)

**Solution:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### Rate Limits

WhatsApp Cloud API has these limits:
- **Messages**: 80 messages/second (per phone number)
- **API Calls**: 200 calls/hour (during development)

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
whatsapp/
├── README.md                 # This file
├── package.json              # Node.js dependencies
├── .env.example              # Environment variables template
├── Dockerfile                # Docker build file
├── docker-compose.yml        # Docker Compose configuration
└── src/
    ├── index.js              # Main entry point
    ├── config.js             # Configuration management
    ├── cesClient.js          # CX Agent Studio API client
    ├── whatsappClient.js     # WhatsApp Cloud API client
    └── webhooks/
        ├── index.js          # Webhook router
        ├── verification.js   # Webhook verification
        └── messages.js       # Message handlers
```

## Resources

- [WhatsApp Business Platform](https://business.whatsapp.com/)
- [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Meta for Developers](https://developers.facebook.com/)
- [WhatsApp Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
- [CX Agent Studio Documentation](https://cloud.google.com/customer-engagement-ai/conversational-agents)

## License

This project is provided as a reference implementation for integrating CX Agent Studio with WhatsApp Business.
