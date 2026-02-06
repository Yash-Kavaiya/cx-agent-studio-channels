/**
 * Google Chat Integration for CX Agent Studio.
 * Main entry point for the Google Chat bot server.
 */

const express = require('express');
const http = require('http');

const { loadConfig, logger } = require('./config');
const { createClient, createBidiClient } = require('./cesClient');
const GoogleChatClient = require('./chatClient');
const { handleMessage } = require('./handlers/message');
const { handleAddedToSpace, handleRemovedFromSpace } = require('./handlers/space');
const { handleCardClicked, handleFormSubmission } = require('./handlers/card');

// Global instances
let config;
let cesClient;
let bidiClient;
let chatClient;

/**
 * Process a Google Chat event.
 * @param {Object} event - Chat event from webhook
 * @param {Object} services - Services object
 * @returns {Promise<Object>} Response object
 */
async function processEvent(event, services) {
  const eventType = event.type;

  logger.debug(`Processing event type: ${eventType}`);

  switch (eventType) {
    case 'MESSAGE':
      return handleMessage(event, services);

    case 'ADDED_TO_SPACE':
      return handleAddedToSpace(event, services);

    case 'REMOVED_FROM_SPACE':
      return handleRemovedFromSpace(event, services);

    case 'CARD_CLICKED':
      return handleCardClicked(event, services);

    default:
      logger.debug(`Unhandled event type: ${eventType}`);
      return null;
  }
}

/**
 * Create and configure Express app.
 * @param {Object} services - Services object
 * @returns {Express} Configured Express app
 */
function createApp(services) {
  const app = express();

  // Trust proxy for Cloud Run
  app.set('trust proxy', 1);

  // Parse JSON bodies
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'google-chat-ces-bot',
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'Google Chat CX Agent Studio Integration',
      version: '1.0.0',
      status: 'running',
    });
  });

  // Main Chat webhook endpoint
  app.post('/', async (req, res) => {
    try {
      const event = req.body;

      logger.debug('Received event:', JSON.stringify(event).substring(0, 200));

      const response = await processEvent(event, services);

      if (response) {
        res.status(200).json(response);
      } else {
        res.status(200).json({});
      }
    } catch (error) {
      logger.error('Error processing event:', error);
      res.status(200).json({
        text: 'Sorry, I encountered an error processing your request.',
      });
    }
  });

  // Alternative endpoint path
  app.post('/chat', async (req, res) => {
    try {
      const event = req.body;
      const response = await processEvent(event, services);
      res.status(200).json(response || {});
    } catch (error) {
      logger.error('Error processing event:', error);
      res.status(200).json({
        text: 'Sorry, I encountered an error processing your request.',
      });
    }
  });

  // Cloud Functions compatible handler
  app.post('/handleChat', async (req, res) => {
    try {
      const event = req.body;
      const response = await processEvent(event, services);
      res.status(200).json(response || {});
    } catch (error) {
      logger.error('Error processing event:', error);
      res.status(200).json({
        text: 'Sorry, I encountered an error processing your request.',
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * Cloud Functions entry point.
 * @param {Object} req - HTTP request
 * @param {Object} res - HTTP response
 */
async function handleChat(req, res) {
  // Initialize if needed
  if (!config) {
    config = loadConfig();
    logger.setLevel(config.server.logLevel);
    cesClient = createClient(config);
    if (config.bot.useBidiSession) {
      bidiClient = createBidiClient(config);
    }
    chatClient = new GoogleChatClient(config);
  }

  const services = { config, cesClient, bidiClient, chatClient };

  try {
    const event = req.body;
    const response = await processEvent(event, services);
    res.status(200).json(response || {});
  } catch (error) {
    logger.error('Error in Cloud Function:', error);
    res.status(200).json({
      text: 'Sorry, I encountered an error processing your request.',
    });
  }
}

/**
 * Main function to start the server.
 */
async function main() {
  try {
    // Load configuration
    config = loadConfig();
    logger.setLevel(config.server.logLevel);
    logger.info('Starting Google Chat CX Agent Studio Bot');

    // Initialize CES clients
    cesClient = createClient(config);
    if (config.bot.useBidiSession) {
      bidiClient = createBidiClient(config);
      logger.info('Using BidiRunSession for streaming responses');
    } else {
      logger.info('Using runSession for synchronous responses');
    }

    // Initialize Chat client
    chatClient = new GoogleChatClient(config);

    // Create services object
    const services = { config, cesClient, bidiClient, chatClient };

    // Create and start Express app
    const app = createApp(services);
    const server = http.createServer(app);

    server.listen(config.server.port, '0.0.0.0', () => {
      logger.info(`Server started on port ${config.server.port}`);
      logger.info('Configure your Google Chat app to use this endpoint');
      logger.info('Waiting for Chat events...');
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');
      server.close(() => {
        logger.info('HTTP server closed');
      });
      if (cesClient) {
        await cesClient.close();
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export for Cloud Functions
module.exports = { handleChat };

// Start server if run directly
if (require.main === module) {
  main();
}
