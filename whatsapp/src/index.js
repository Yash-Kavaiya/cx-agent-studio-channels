/**
 * WhatsApp Business Integration for CX Agent Studio.
 * Main entry point for the WhatsApp bot server.
 */

const express = require('express');
const http = require('http');

const { loadConfig, logger } = require('./config');
const { createClient, createBidiClient } = require('./cesClient');
const WhatsAppClient = require('./whatsappClient');
const { createWebhookRouter } = require('./webhooks');

// Global instances
let config;
let cesClient;
let bidiClient;
let whatsappClient;

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
      service: 'whatsapp-ces-bot',
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'WhatsApp CX Agent Studio Integration',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health',
        webhook: '/webhook',
      },
    });
  });

  // Mount webhook router
  app.use('/webhook', createWebhookRouter(services));

  // Alternative webhook path
  app.use('/webhooks/whatsapp', createWebhookRouter(services));

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
async function handleWebhook(req, res) {
  // Initialize if needed
  if (!config) {
    config = loadConfig();
    logger.setLevel(config.server.logLevel);
    cesClient = createClient(config);
    if (config.bot.useBidiSession) {
      bidiClient = createBidiClient(config);
    }
    whatsappClient = new WhatsAppClient(config);
  }

  const services = { config, cesClient, bidiClient, whatsappClient };
  const app = createApp(services);

  // Handle the request
  app(req, res);
}

/**
 * Main function to start the server.
 */
async function main() {
  try {
    // Load configuration
    config = loadConfig();
    logger.setLevel(config.server.logLevel);
    logger.info('Starting WhatsApp CX Agent Studio Bot');

    // Initialize CES clients
    cesClient = createClient(config);
    if (config.bot.useBidiSession) {
      bidiClient = createBidiClient(config);
      logger.info('Using BidiRunSession for streaming responses');
    } else {
      logger.info('Using runSession for synchronous responses');
    }

    // Initialize WhatsApp client
    whatsappClient = new WhatsAppClient(config);
    logger.info(`WhatsApp Phone Number ID: ${config.whatsapp.phoneNumberId}`);

    // Create services object
    const services = { config, cesClient, bidiClient, whatsappClient };

    // Create and start Express app
    const app = createApp(services);
    const server = http.createServer(app);

    server.listen(config.server.port, '0.0.0.0', () => {
      logger.info(`Server started on port ${config.server.port}`);
      logger.info(`Webhook URL: https://your-domain.com/webhook`);
      logger.info('Configure this URL in Meta App Dashboard');
      logger.info('Waiting for WhatsApp messages...');
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
module.exports = { handleWebhook };

// Start server if run directly
if (require.main === module) {
  main();
}
