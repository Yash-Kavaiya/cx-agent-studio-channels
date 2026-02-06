/**
 * WhatsApp Message Webhook Handler.
 * Processes incoming messages from WhatsApp.
 */

const { generateSessionId, logger } = require('../config');

// Session tracking
const userSessions = new Map();

/**
 * Get or create a session ID for a phone number.
 * @param {string} phoneNumber - WhatsApp phone number
 * @returns {string} Session ID
 */
function getSessionId(phoneNumber) {
  if (!userSessions.has(phoneNumber)) {
    userSessions.set(phoneNumber, generateSessionId(phoneNumber));
  }
  return userSessions.get(phoneNumber);
}

/**
 * Reset session for a phone number.
 * @param {string} phoneNumber - WhatsApp phone number
 */
function resetSession(phoneNumber) {
  const newSession = generateSessionId(`${phoneNumber}-${Date.now()}`);
  userSessions.set(phoneNumber, newSession);
}

/**
 * Extract text content from a WhatsApp message.
 * @param {Object} message - WhatsApp message object
 * @returns {string} Extracted text
 */
function extractMessageText(message) {
  const type = message.type;

  switch (type) {
    case 'text':
      return message.text?.body || '';

    case 'image':
      return message.image?.caption || '[Image received]';

    case 'video':
      return message.video?.caption || '[Video received]';

    case 'audio':
      return '[Voice message received]';

    case 'document':
      const filename = message.document?.filename || 'document';
      const caption = message.document?.caption || '';
      return caption || `[Document received: ${filename}]`;

    case 'location':
      const lat = message.location?.latitude;
      const lon = message.location?.longitude;
      const name = message.location?.name || '';
      return name || `[Location: ${lat}, ${lon}]`;

    case 'contacts':
      const contacts = message.contacts || [];
      if (contacts.length > 0) {
        const names = contacts.map((c) => c.name?.formatted_name || 'Unknown').join(', ');
        return `[Contacts shared: ${names}]`;
      }
      return '[Contacts received]';

    case 'interactive':
      // Handle button/list responses
      const interactive = message.interactive;
      if (interactive?.type === 'button_reply') {
        return interactive.button_reply?.title || interactive.button_reply?.id || '';
      }
      if (interactive?.type === 'list_reply') {
        return interactive.list_reply?.title || interactive.list_reply?.id || '';
      }
      return '';

    case 'button':
      // Legacy button response
      return message.button?.text || message.button?.payload || '';

    default:
      logger.debug(`Unknown message type: ${type}`);
      return '';
  }
}

/**
 * Process incoming WhatsApp message.
 * @param {Object} message - WhatsApp message object
 * @param {Object} metadata - Message metadata
 * @param {Object} services - Services object
 * @returns {Promise<void>}
 */
async function processMessage(message, metadata, services) {
  const { cesClient, bidiClient, whatsappClient, config } = services;

  const from = message.from; // Sender's phone number
  const messageId = message.id;
  const messageType = message.type;

  logger.info(`Received ${messageType} message from ${from}`);

  // Mark message as read
  try {
    await whatsappClient.markAsRead(messageId);
  } catch (error) {
    logger.debug('Failed to mark message as read:', error.message);
  }

  // Extract message text
  const messageText = extractMessageText(message);

  if (!messageText) {
    logger.debug('No text content in message');
    return;
  }

  // Check for reset command
  if (messageText.toLowerCase().trim() === '/reset' || messageText.toLowerCase().trim() === 'reset') {
    resetSession(from);
    await whatsappClient.sendTextMessage(
      from,
      'Your conversation has been reset. You can start a new conversation!'
    );
    return;
  }

  // Check for help command
  if (messageText.toLowerCase().trim() === '/help' || messageText.toLowerCase().trim() === 'help') {
    const helpMessage = `*How to use this bot:*

Simply send me a message and I'll respond using AI.

*Commands:*
• Type "reset" - Start a new conversation
• Type "help" - Show this message

I'm powered by CX Agent Studio and ready to help! 🤖`;

    await whatsappClient.sendTextMessage(from, helpMessage);
    return;
  }

  // Get session ID and process with CX Agent Studio
  const sessionId = getSessionId(from);

  try {
    let responseText;

    if (config.bot.useBidiSession && bidiClient) {
      responseText = await bidiClient.sendMessage(sessionId, messageText);
    } else {
      responseText = await cesClient.runSession(sessionId, messageText);
    }

    if (responseText) {
      // WhatsApp has a 4096 character limit per message
      if (responseText.length > 4096) {
        // Split into multiple messages
        const chunks = splitMessage(responseText, 4096);
        for (const chunk of chunks) {
          await whatsappClient.sendTextMessage(from, chunk);
        }
      } else {
        await whatsappClient.sendTextMessage(from, responseText);
      }
    } else {
      await whatsappClient.sendTextMessage(
        from,
        "I received your message but couldn't generate a response. Please try again."
      );
    }
  } catch (error) {
    logger.error('Error processing message:', error);
    await whatsappClient.sendTextMessage(
      from,
      'Sorry, I encountered an error processing your message. Please try again later.'
    );
  }
}

/**
 * Split a long message into chunks.
 * @param {string} text - Text to split
 * @param {number} maxLength - Maximum chunk length
 * @returns {Array<string>} Array of chunks
 */
function splitMessage(text, maxLength) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point
    let breakPoint = remaining.lastIndexOf('\n', maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(' ', maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}

/**
 * Handle status updates (delivery, read receipts).
 * @param {Object} status - Status update object
 * @param {Object} services - Services object
 */
function handleStatus(status, services) {
  const statusType = status.status; // sent, delivered, read, failed
  const messageId = status.id;
  const recipientId = status.recipient_id;

  logger.debug(`Message ${messageId} status: ${statusType} for ${recipientId}`);

  // Handle failed messages
  if (statusType === 'failed') {
    const errors = status.errors || [];
    for (const error of errors) {
      logger.error(`Message delivery failed: ${error.code} - ${error.title}`);
    }
  }
}

module.exports = {
  processMessage,
  handleStatus,
  extractMessageText,
  getSessionId,
  resetSession,
};
