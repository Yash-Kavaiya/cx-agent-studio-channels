/**
 * WhatsApp Cloud API Client.
 * Handles sending messages via Meta's WhatsApp Business Cloud API.
 */

const axios = require('axios');
const { logger } = require('./config');

/**
 * WhatsApp Cloud API Client.
 */
class WhatsAppClient {
  constructor(config) {
    this.config = config;
    this.baseUrl = `https://graph.facebook.com/${config.whatsapp.apiVersion}`;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.accessToken = config.whatsapp.accessToken;
  }

  /**
   * Get default headers for API requests.
   * @returns {Object} Headers object
   */
  getHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Send a text message.
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @param {boolean} previewUrl - Enable URL preview
   * @returns {Promise<Object>} API response
   */
  async sendTextMessage(to, text, previewUrl = false) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body: text,
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
      });
      logger.debug('Text message sent:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send text message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send an image message.
   * @param {string} to - Recipient phone number
   * @param {string} imageUrl - Image URL
   * @param {string} caption - Optional caption
   * @returns {Promise<Object>} API response
   */
  async sendImageMessage(to, imageUrl, caption = '') {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption,
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
      });
      logger.debug('Image message sent:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send image message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a document message.
   * @param {string} to - Recipient phone number
   * @param {string} documentUrl - Document URL
   * @param {string} filename - Document filename
   * @param {string} caption - Optional caption
   * @returns {Promise<Object>} API response
   */
  async sendDocumentMessage(to, documentUrl, filename, caption = '') {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'document',
      document: {
        link: documentUrl,
        filename: filename,
        caption: caption,
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
      });
      logger.debug('Document message sent:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send document message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send an interactive button message.
   * @param {string} to - Recipient phone number
   * @param {string} bodyText - Message body text
   * @param {Array} buttons - Array of button objects [{id, title}]
   * @param {string} headerText - Optional header text
   * @param {string} footerText - Optional footer text
   * @returns {Promise<Object>} API response
   */
  async sendButtonMessage(to, bodyText, buttons, headerText = '', footerText = '') {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const interactive = {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title.substring(0, 20), // Max 20 chars
          },
        })),
      },
    };

    if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      interactive.footer = { text: footerText };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: interactive,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
      });
      logger.debug('Button message sent:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send button message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send an interactive list message.
   * @param {string} to - Recipient phone number
   * @param {string} bodyText - Message body text
   * @param {string} buttonText - Button text to open list
   * @param {Array} sections - Array of section objects
   * @param {string} headerText - Optional header text
   * @param {string} footerText - Optional footer text
   * @returns {Promise<Object>} API response
   */
  async sendListMessage(to, bodyText, buttonText, sections, headerText = '', footerText = '') {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const interactive = {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText.substring(0, 20),
        sections: sections.map((section) => ({
          title: section.title,
          rows: section.rows.slice(0, 10).map((row) => ({
            id: row.id,
            title: row.title.substring(0, 24),
            description: row.description?.substring(0, 72) || '',
          })),
        })),
      },
    };

    if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      interactive.footer = { text: footerText };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: interactive,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
      });
      logger.debug('List message sent:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send list message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a template message.
   * @param {string} to - Recipient phone number
   * @param {string} templateName - Template name
   * @param {string} languageCode - Language code (e.g., 'en')
   * @param {Array} components - Template components/parameters
   * @returns {Promise<Object>} API response
   */
  async sendTemplate(to, templateName, languageCode = 'en', components = []) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components,
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
      });
      logger.debug('Template message sent:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send template message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a reaction to a message.
   * @param {string} to - Recipient phone number
   * @param {string} messageId - Message ID to react to
   * @param {string} emoji - Emoji to react with
   * @returns {Promise<Object>} API response
   */
  async sendReaction(to, messageId, emoji) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji: emoji,
      },
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
      });
      logger.debug('Reaction sent:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Failed to send reaction:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Mark a message as read.
   * @param {string} messageId - Message ID to mark as read
   * @returns {Promise<Object>} API response
   */
  async markAsRead(messageId) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: this.getHeaders(),
      });
      logger.debug('Message marked as read:', messageId);
      return response.data;
    } catch (error) {
      logger.error('Failed to mark as read:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Download media from WhatsApp.
   * @param {string} mediaId - Media ID
   * @returns {Promise<Buffer>} Media content
   */
  async downloadMedia(mediaId) {
    // First, get the media URL
    const mediaUrl = `${this.baseUrl}/${mediaId}`;

    try {
      const urlResponse = await axios.get(mediaUrl, {
        headers: this.getHeaders(),
      });

      const downloadUrl = urlResponse.data.url;

      // Download the actual media
      const mediaResponse = await axios.get(downloadUrl, {
        headers: this.getHeaders(),
        responseType: 'arraybuffer',
      });

      return mediaResponse.data;
    } catch (error) {
      logger.error('Failed to download media:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = WhatsAppClient;
