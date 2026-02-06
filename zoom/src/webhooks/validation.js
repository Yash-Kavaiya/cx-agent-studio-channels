/**
 * Zoom Webhook Validation Handler.
 * Handles URL validation challenge from Zoom.
 */

const crypto = require('crypto');
const { logger } = require('../config');

/**
 * Handle Zoom webhook URL validation.
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} config - Application configuration
 * @returns {boolean} True if validation was handled
 */
function handleValidation(req, res, config) {
  const { event, payload } = req.body;

  // Check if this is a URL validation request
  if (event === 'endpoint.url_validation') {
    logger.info('Received Zoom webhook URL validation request');

    const plainToken = payload.plainToken;
    const secretToken = config.zoom.secretToken;

    if (!secretToken) {
      logger.error('Secret token not configured for URL validation');
      res.status(500).json({ error: 'Secret token not configured' });
      return true;
    }

    // Generate encrypted token
    const encryptedToken = crypto
      .createHmac('sha256', secretToken)
      .update(plainToken)
      .digest('hex');

    logger.info('Responding to URL validation challenge');

    res.status(200).json({
      plainToken: plainToken,
      encryptedToken: encryptedToken,
    });

    return true;
  }

  return false;
}

/**
 * Verify webhook signature middleware.
 * @param {Object} config - Application configuration
 * @returns {Function} Express middleware
 */
function verifySignature(config) {
  return (req, res, next) => {
    const signature = req.headers['x-zm-signature'];
    const timestamp = req.headers['x-zm-request-timestamp'];

    if (!config.zoom.secretToken) {
      logger.warn('No secret token configured, skipping signature verification');
      return next();
    }

    if (!signature || !timestamp) {
      logger.warn('Missing signature headers');
      return next();
    }

    // Reconstruct the message
    const message = `v0:${timestamp}:${JSON.stringify(req.body)}`;
    const hashForVerify = crypto
      .createHmac('sha256', config.zoom.secretToken)
      .update(message)
      .digest('hex');

    const expectedSignature = `v0=${hashForVerify}`;

    if (signature !== expectedSignature) {
      logger.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  };
}

/**
 * Verify verification token (legacy validation).
 * @param {string} token - Token from request
 * @param {Object} config - Application configuration
 * @returns {boolean} True if valid
 */
function verifyToken(token, config) {
  return token === config.zoom.verificationToken;
}

module.exports = {
  handleValidation,
  verifySignature,
  verifyToken,
};
