/**
 * Zoom Team Chat Service.
 * Handles sending and receiving messages via Zoom Team Chat API.
 */

const axios = require('axios');
const { logger } = require('../config');

/**
 * Zoom Team Chat Service.
 */
class ZoomChatService {
  /**
   * Initialize the Zoom Chat service.
   * @param {Object} config - Application configuration
   * @param {ZoomAuth} auth - Zoom auth service
   */
  constructor(config, auth) {
    this.config = config;
    this.auth = auth;
    this.baseUrl = 'https://api.zoom.us/v2';
  }

  /**
   * Send a message to a user (DM).
   * @param {string} toJid - Recipient's JID
   * @param {string} message - Message content
   * @param {Object} options - Additional options (rich_text, at_items, etc.)
   * @returns {Promise<Object>} API response
   */
  async sendDirectMessage(toJid, message, options = {}) {
    const headers = await this.auth.getAuthHeaders();
    const robotJid = this.config.zoom.botJid;

    if (!robotJid) {
      throw new Error('Bot JID not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/im/chat/messages`,
        {
          robot_jid: robotJid,
          to_jid: toJid,
          content: {
            head: {
              text: message.substring(0, 100), // Preview text
            },
            body: [
              {
                type: 'message',
                text: message,
                ...options,
              },
            ],
          },
        },
        { headers }
      );

      logger.debug('Message sent successfully:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send direct message:', error.message);
      throw error;
    }
  }

  /**
   * Send a message to a channel.
   * @param {string} channelId - Channel ID (to_jid)
   * @param {string} message - Message content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async sendChannelMessage(channelId, message, options = {}) {
    const headers = await this.auth.getAuthHeaders();
    const robotJid = this.config.zoom.botJid;

    if (!robotJid) {
      throw new Error('Bot JID not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/im/chat/messages`,
        {
          robot_jid: robotJid,
          to_jid: channelId,
          content: {
            head: {
              text: message.substring(0, 100),
            },
            body: [
              {
                type: 'message',
                text: message,
                ...options,
              },
            ],
          },
        },
        { headers }
      );

      logger.debug('Channel message sent successfully:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send channel message:', error.message);
      throw error;
    }
  }

  /**
   * Send an interactive message with buttons.
   * @param {string} toJid - Recipient's JID
   * @param {string} message - Message content
   * @param {Array} buttons - Array of button objects
   * @returns {Promise<Object>} API response
   */
  async sendInteractiveMessage(toJid, message, buttons = []) {
    const headers = await this.auth.getAuthHeaders();
    const robotJid = this.config.zoom.botJid;

    if (!robotJid) {
      throw new Error('Bot JID not configured');
    }

    const body = [
      {
        type: 'message',
        text: message,
      },
    ];

    // Add buttons if provided
    if (buttons.length > 0) {
      body.push({
        type: 'actions',
        items: buttons.map((btn) => ({
          text: btn.text,
          value: btn.value || btn.text,
          style: btn.style || 'Default',
        })),
      });
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/im/chat/messages`,
        {
          robot_jid: robotJid,
          to_jid: toJid,
          content: {
            head: {
              text: message.substring(0, 100),
            },
            body,
          },
        },
        { headers }
      );

      logger.debug('Interactive message sent successfully:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send interactive message:', error.message);
      throw error;
    }
  }

  /**
   * Reply to a message in a thread.
   * @param {string} toJid - Channel/user JID
   * @param {string} replyMainMessageId - ID of the message to reply to
   * @param {string} message - Reply message content
   * @returns {Promise<Object>} API response
   */
  async replyToMessage(toJid, replyMainMessageId, message) {
    const headers = await this.auth.getAuthHeaders();
    const robotJid = this.config.zoom.botJid;

    if (!robotJid) {
      throw new Error('Bot JID not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/im/chat/messages`,
        {
          robot_jid: robotJid,
          to_jid: toJid,
          reply_main_message_id: replyMainMessageId,
          content: {
            head: {
              text: message.substring(0, 100),
            },
            body: [
              {
                type: 'message',
                text: message,
              },
            ],
          },
        },
        { headers }
      );

      logger.debug('Reply sent successfully:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send reply:', error.message);
      throw error;
    }
  }

  /**
   * Get list of channels the bot has access to.
   * @returns {Promise<Array>} List of channels
   */
  async getChannels() {
    const headers = await this.auth.getAuthHeaders();

    try {
      const response = await axios.get(
        `${this.baseUrl}/chat/users/me/channels`,
        { headers }
      );

      return response.data.channels || [];
    } catch (error) {
      logger.error('Failed to get channels:', error.message);
      throw error;
    }
  }

  /**
   * Extract message text from webhook payload.
   * @param {Object} payload - Webhook payload
   * @returns {string} Extracted message text
   */
  extractMessageText(payload) {
    // Handle different message formats
    if (payload.cmd) {
      // Slash command
      return payload.cmd;
    }

    if (payload.payload && payload.payload.cmd) {
      return payload.payload.cmd;
    }

    // Regular message
    const content = payload.content || payload.payload?.content;
    if (content) {
      // Extract text from body
      if (content.body && Array.isArray(content.body)) {
        const textParts = content.body
          .filter((item) => item.type === 'message' || item.text)
          .map((item) => item.text)
          .filter(Boolean);
        return textParts.join(' ');
      }

      if (typeof content === 'string') {
        return content;
      }
    }

    // Fallback to message field
    return payload.message || payload.payload?.message || '';
  }
}

module.exports = ZoomChatService;
