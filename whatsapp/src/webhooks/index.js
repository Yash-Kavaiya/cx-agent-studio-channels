/**
 * WhatsApp Webhook Router.
 * Routes incoming webhooks to appropriate handlers.
 */

const express = require('express');
const { logger } = require('../config');
const { handleVerification } = require('./verification');
const { processMessage, handleStatus } = require('./messages');

/**
 * Create webhook router.
 * @param {Object} services - Services object
 * @returns {Router} Express router
 */
function createWebhookRouter(services) {
  const router = express.Router();
  const { config } = services;

  // Webhook verification (GET)
  router.get('/', (req, res) => {
    handleVerification(req, res, config);
  });

  // Webhook events (POST)
  router.post('/', async (req, res) => {
    try {
      const body = req.body;

      logger.debug('Received webhook:', JSON.stringify(body).substring(0, 500));

      // Verify this is a WhatsApp webhook
      if (body.object !== 'whatsapp_business_account') {
        logger.debug('Not a WhatsApp webhook, ignoring');
        return res.sendStatus(200);
      }

      // Process entries
      const entries = body.entry || [];

      for (const entry of entries) {
        const changes = entry.changes || [];

        for (const change of changes) {
          if (change.field !== 'messages') {
            logger.debug(`Ignoring non-message field: ${change.field}`);
            continue;
          }

          const value = change.value;

          // Process messages
          const messages = value.messages || [];
          for (const message of messages) {
            await processMessage(message, value.metadata, services);
          }

          // Process status updates
          const statuses = value.statuses || [];
          for (const status of statuses) {
            handleStatus(status, services);
          }
        }
      }

      // Always respond with 200 to acknowledge receipt
      res.sendStatus(200);
    } catch (error) {
      logger.error('Webhook processing error:', error);
      // Still return 200 to prevent retries
      res.sendStatus(200);
    }
  });

  return router;
}

module.exports = { createWebhookRouter };
