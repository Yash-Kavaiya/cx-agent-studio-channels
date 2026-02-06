/**
 * WhatsApp Webhook Verification Handler.
 * Handles the webhook verification challenge from Meta.
 */

const { logger } = require('../config');

/**
 * Handle webhook verification request (GET).
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} config - Application configuration
 */
function handleVerification(req, res, config) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.debug('Webhook verification request:', { mode, token: token ? '***' : 'missing' });

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.status(403).send('Forbidden');
  }
}

module.exports = { handleVerification };
