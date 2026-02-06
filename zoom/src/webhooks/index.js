/**
 * Zoom Webhook Router.
 * Routes incoming webhooks to appropriate handlers.
 */

const express = require('express');
const { logger } = require('../config');
const { handleValidation, verifySignature } = require('./validation');
const { handleTeamChatEvent } = require('./teamChat');
const { handleVirtualAgentEvent } = require('./virtualAgent');

/**
 * Create webhook router.
 * @param {Object} services - Services object
 * @returns {Router} Express router
 */
function createWebhookRouter(services) {
  const router = express.Router();
  const { config } = services;

  // Apply signature verification middleware
  router.use(verifySignature(config));

  // Main webhook endpoint
  router.post('/', async (req, res) => {
    try {
      const payload = req.body;

      logger.debug('Received webhook:', JSON.stringify(payload).substring(0, 200));

      // Handle URL validation
      if (handleValidation(req, res, config)) {
        return;
      }

      // Route based on event type
      const event = payload.event || '';
      let result;

      if (
        event.startsWith('bot_notification') ||
        event.startsWith('team_chat') ||
        event.startsWith('chat_message') ||
        event.startsWith('interactive_message')
      ) {
        // Team Chat events
        result = await handleTeamChatEvent(payload, services);
      } else if (event.startsWith('virtual_agent')) {
        // Virtual Agent events
        result = await handleVirtualAgentEvent(payload, services);

        // VA expects a response body
        if (result && result.response_type) {
          return res.status(200).json(result);
        }
      } else if (event.startsWith('contact_center')) {
        // Contact Center events - handled separately
        logger.info('Contact Center event received:', event);
        result = { handled: true, action: 'contact_center' };
      } else {
        logger.debug('Unknown event type:', event);
        result = { handled: false };
      }

      // Standard acknowledgment
      res.status(200).json({ status: 'ok', result });
    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Team Chat specific endpoint
  router.post('/team-chat', async (req, res) => {
    try {
      const payload = req.body;

      if (handleValidation(req, res, config)) {
        return;
      }

      const result = await handleTeamChatEvent(payload, services);
      res.status(200).json({ status: 'ok', result });
    } catch (error) {
      logger.error('Team Chat webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Virtual Agent specific endpoint
  router.post('/virtual-agent', async (req, res) => {
    try {
      const payload = req.body;

      if (handleValidation(req, res, config)) {
        return;
      }

      const result = await handleVirtualAgentEvent(payload, services);

      // VA expects specific response format
      if (result && result.response_type) {
        return res.status(200).json(result);
      }

      res.status(200).json({ status: 'ok', result });
    } catch (error) {
      logger.error('Virtual Agent webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Contact Center specific endpoint
  router.post('/contact-center', async (req, res) => {
    try {
      const payload = req.body;

      if (handleValidation(req, res, config)) {
        return;
      }

      // Process CC event
      const { ccService, cesClient, bidiClient, config: cfg } = services;

      if (ccService) {
        const eventData = ccService.processWebhookEvent(payload);
        logger.info('Contact Center event:', eventData.type);

        // If there's a message, process it
        if (eventData.message && eventData.engagementId) {
          const sessionId = `cc-${eventData.engagementId}`;

          try {
            let responseText;
            if (cfg.bot.useBidiSession && bidiClient) {
              responseText = await bidiClient.sendMessage(sessionId, eventData.message);
            } else {
              responseText = await cesClient.runSession(sessionId, eventData.message);
            }

            const assistResponse = ccService.formatAgentAssistResponse(responseText);
            return res.status(200).json(assistResponse);
          } catch (error) {
            logger.error('Error processing CC message:', error);
          }
        }
      }

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Contact Center webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createWebhookRouter };
