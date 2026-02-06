/**
 * Zoom OAuth Authentication Service.
 * Handles Server-to-Server OAuth and token management.
 */

const axios = require('axios');
const { logger } = require('../config');

// Token cache
let tokenCache = {
  accessToken: null,
  expiresAt: null,
};

/**
 * Zoom OAuth Authentication Manager.
 */
class ZoomAuth {
  /**
   * Initialize the Zoom Auth service.
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this.baseUrl = 'https://zoom.us/oauth';
  }

  /**
   * Get a valid access token, refreshing if necessary.
   * Uses Server-to-Server OAuth flow.
   * @returns {Promise<string>} Valid access token
   */
  async getAccessToken() {
    // Check if cached token is still valid
    if (tokenCache.accessToken && tokenCache.expiresAt > Date.now()) {
      logger.debug('Using cached Zoom access token');
      return tokenCache.accessToken;
    }

    logger.debug('Fetching new Zoom access token');

    try {
      const response = await axios.post(
        `${this.baseUrl}/token`,
        new URLSearchParams({
          grant_type: 'account_credentials',
          account_id: this.config.zoom.accountId,
        }),
        {
          auth: {
            username: this.config.zoom.clientId,
            password: this.config.zoom.clientSecret,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, expires_in } = response.data;

      // Cache token with 5 minute buffer
      tokenCache = {
        accessToken: access_token,
        expiresAt: Date.now() + (expires_in - 300) * 1000,
      };

      logger.info('Successfully obtained Zoom access token');
      return access_token;
    } catch (error) {
      logger.error('Failed to get Zoom access token:', error.message);
      throw error;
    }
  }

  /**
   * Get authorization header for API requests.
   * @returns {Promise<Object>} Headers object with Authorization
   */
  async getAuthHeaders() {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Verify webhook signature.
   * @param {string} signature - The x-zm-signature header
   * @param {string} timestamp - The x-zm-request-timestamp header
   * @param {string} body - Raw request body
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(signature, timestamp, body) {
    if (!this.config.zoom.secretToken) {
      logger.warn('No secret token configured, skipping signature verification');
      return true;
    }

    const crypto = require('crypto');
    const message = `v0:${timestamp}:${body}`;
    const hashForVerify = crypto
      .createHmac('sha256', this.config.zoom.secretToken)
      .update(message)
      .digest('hex');

    const expectedSignature = `v0=${hashForVerify}`;
    return signature === expectedSignature;
  }

  /**
   * Verify webhook verification token (for URL validation).
   * @param {string} token - The token from webhook payload
   * @returns {boolean} True if token matches
   */
  verifyToken(token) {
    return token === this.config.zoom.verificationToken;
  }

  /**
   * Clear cached token (useful for testing or forced refresh).
   */
  clearCache() {
    tokenCache = {
      accessToken: null,
      expiresAt: null,
    };
  }
}

module.exports = ZoomAuth;
