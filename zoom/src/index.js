/**
 * Zoom Integration for CX Agent Studio.
 * Main entry point for the Zoom bot server.
 */

const express = require('express');
const http = require('http');

const { loadConfig, logger } = require('./config');
const { createClient, createBidiClient } = require('./cesClient');
const ZoomAuth = require('./services/zoomAuth');
const ZoomChatService = require('./services/zoomChat');
const ZoomVAService = require('./services/zoomVA');
const ZoomCCService = require('./services/zoomCC');
const { createWebhookRouter } = require('./webhooks');

// Global instances
let config;
let cesClient;
let bidiClient;
let zoomAuth;
let chatService;
let vaService;
let ccService;

/**
 * Create and configure Express app.
 * @param {Object} services - Services object
 * @returns {Express} Configured Express app
 */
function createApp(services) {
  const app = express();

  // Trust proxy for accurate IP logging behind load balancers
  app.set('trust proxy', 1);

  // Parse JSON bodies
  app.use(express.json());

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'zoom-ces-bot',
    });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'Zoom CX Agent Studio Integration',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health',
        webhooks: '/webhooks/zoom',
        teamChat: '/webhooks/zoom/team-chat',
        virtualAgent: '/webhooks/zoom/virtual-agent',
        contactCenter: '/webhooks/zoom/contact-center',
      },
    });
  });

  // Mount webhook router
  app.use('/webhooks/zoom', createWebhookRouter(services));

  // Legacy webhook endpoint (for backwards compatibility)
  app.use('/webhook', createWebhookRouter(services));

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
 * Start health check server on separate port.
 * @param {number} port - Health check port
 */
function startHealthCheckServer(port) {
  if (port === config.server.port) {
    // Same port, health check is on main server
    return;
  }

  const healthApp = express();
  healthApp.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  healthApp.listen(port, '0.0.0.0', () => {
    logger.info(`Health check server started on port ${port}`);
  });
}

/**
 * Main function to start the server.
 */
async function main() {
  try {
    // Load configuration
    config = loadConfig();
    logger.setLevel(config.server.logLevel);
    logger.info('Starting Zoom CX Agent Studio Integration');

    // Initialize CES clients
    cesClient = createClient(config);
    if (config.bot.useBidiSession) {
      bidiClient = createBidiClient(config);
      logger.info('Using BidiRunSession for streaming responses');
    } else {
      logger.info('Using runSession for synchronous responses');
    }

    // Initialize Zoom services
    zoomAuth = new ZoomAuth(config);
    chatService = new ZoomChatService(config, zoomAuth);
    vaService = new ZoomVAService(config, zoomAuth);
    ccService = new ZoomCCService(config, zoomAuth);

    // Create services object
    const services = {
      config,
      cesClient,
      bidiClient,
      zoomAuth,
      chatService,
      vaService,
      ccService,
    };

    // Create and start Express app
    const app = createApp(services);
    const server = http.createServer(app);

    // Start server
    server.listen(config.server.port, '0.0.0.0', () => {
      logger.info(`Server started on port ${config.server.port}`);
      logger.info(`Webhook URL: ${config.zoom.webhookUrl || `http://localhost:${config.server.port}/webhooks/zoom`}`);
      logger.info('Waiting for Zoom webhook events...');
    });

    // Start health check server if different port
    startHealthCheckServer(config.server.healthCheckPort);

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

// Start the server
main();
