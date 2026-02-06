/**
 * Google Chat API Client.
 * Handles sending messages and interacting with Google Chat API.
 */

const { chat } = require('@googleapis/chat');
const { GoogleAuth } = require('google-auth-library');
const { logger } = require('./config');

/**
 * Google Chat Client for sending messages.
 */
class GoogleChatClient {
  constructor(config) {
    this.config = config;
    this._chatClient = null;
    this._auth = null;
  }

  /**
   * Get authenticated Chat API client.
   */
  async getChatClient() {
    if (!this._chatClient) {
      this._auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/chat.bot'],
      });

      this._chatClient = chat({
        version: 'v1',
        auth: this._auth,
      });
    }
    return this._chatClient;
  }

  /**
   * Send a text message to a space.
   * @param {string} spaceName - Space resource name
   * @param {string} text - Message text
   * @param {string} threadName - Thread name (optional)
   * @returns {Promise<Object>} Created message
   */
  async sendMessage(spaceName, text, threadName = null) {
    const client = await this.getChatClient();

    const requestBody = {
      text: text,
    };

    // Add thread if specified
    if (threadName) {
      requestBody.thread = { name: threadName };
    }

    try {
      const response = await client.spaces.messages.create({
        parent: spaceName,
        requestBody,
      });

      logger.debug('Message sent:', response.data.name);
      return response.data;
    } catch (error) {
      logger.error('Failed to send message:', error.message);
      throw error;
    }
  }

  /**
   * Send a card message to a space.
   * @param {string} spaceName - Space resource name
   * @param {Object} card - Card content
   * @param {string} text - Fallback text
   * @param {string} threadName - Thread name (optional)
   * @returns {Promise<Object>} Created message
   */
  async sendCardMessage(spaceName, card, text = '', threadName = null) {
    const client = await this.getChatClient();

    const requestBody = {
      text: text,
      cardsV2: [
        {
          cardId: `card-${Date.now()}`,
          card: card,
        },
      ],
    };

    if (threadName) {
      requestBody.thread = { name: threadName };
    }

    try {
      const response = await client.spaces.messages.create({
        parent: spaceName,
        requestBody,
      });

      logger.debug('Card message sent:', response.data.name);
      return response.data;
    } catch (error) {
      logger.error('Failed to send card message:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing message.
   * @param {string} messageName - Message resource name
   * @param {string} text - New message text
   * @returns {Promise<Object>} Updated message
   */
  async updateMessage(messageName, text) {
    const client = await this.getChatClient();

    try {
      const response = await client.spaces.messages.update({
        name: messageName,
        updateMask: 'text',
        requestBody: { text },
      });

      logger.debug('Message updated:', messageName);
      return response.data;
    } catch (error) {
      logger.error('Failed to update message:', error.message);
      throw error;
    }
  }

  /**
   * Create a simple text card.
   * @param {string} title - Card title
   * @param {string} text - Card text
   * @param {Array} buttons - Optional buttons
   * @returns {Object} Card object
   */
  createTextCard(title, text, buttons = []) {
    const card = {
      header: {
        title: title,
        imageUrl: '',
        imageType: 'CIRCLE',
      },
      sections: [
        {
          widgets: [
            {
              textParagraph: {
                text: text,
              },
            },
          ],
        },
      ],
    };

    // Add buttons if provided
    if (buttons.length > 0) {
      card.sections.push({
        widgets: [
          {
            buttonList: {
              buttons: buttons.map((btn) => ({
                text: btn.text,
                onClick: {
                  action: {
                    function: btn.action || 'handleButton',
                    parameters: [
                      {
                        key: 'value',
                        value: btn.value || btn.text,
                      },
                    ],
                  },
                },
              })),
            },
          },
        ],
      });
    }

    return card;
  }

  /**
   * Create a help card.
   * @returns {Object} Help card object
   */
  createHelpCard() {
    return {
      header: {
        title: 'CX Agent Bot Help',
        subtitle: 'How to use this bot',
        imageType: 'CIRCLE',
      },
      sections: [
        {
          header: 'Chatting',
          widgets: [
            {
              textParagraph: {
                text: 'Simply send me a message or @mention me in a space to chat.',
              },
            },
          ],
        },
        {
          header: 'Commands',
          widgets: [
            {
              decoratedText: {
                topLabel: '/ask [question]',
                text: 'Ask the AI a question',
              },
            },
            {
              decoratedText: {
                topLabel: '/reset',
                text: 'Reset your conversation',
              },
            },
            {
              decoratedText: {
                topLabel: '/help',
                text: 'Show this help message',
              },
            },
          ],
        },
        {
          header: 'Tips',
          widgets: [
            {
              textParagraph: {
                text: '• Be specific with your questions\n• Use /reset to start fresh\n• Conversations are tracked per space/thread',
              },
            },
          ],
        },
      ],
    };
  }
}

module.exports = GoogleChatClient;
