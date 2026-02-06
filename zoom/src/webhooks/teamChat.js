/**
 * Zoom Team Chat Webhook Handler.
 * Processes incoming Team Chat messages and events.
 */

const { generateSessionId, logger } = require('../config');

// Session tracking
const userSessions = new Map();

/**
 * Get or create a session ID for a chat.
 * @param {string} type - Type (dm or channel)
 * @param {string} identifier - User JID or channel ID
 * @returns {string} Session ID
 */
function getSessionId(type, identifier) {
  const key = `${type}:${identifier}`;
  if (!userSessions.has(key)) {
    userSessions.set(key, generateSessionId(type, identifier));
  }
  return userSessions.get(key);
}

/**
 * Reset session for a chat.
 * @param {string} type - Type (dm or channel)
 * @param {string} identifier - User JID or channel ID
 */
function resetSession(type, identifier) {
  const key = `${type}:${identifier}`;
  const newSession = generateSessionId(type, `${identifier}-${Date.now()}`);
  userSessions.set(key, newSession);
}

/**
 * Handle Team Chat webhook events.
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object { cesClient, chatService, config }
 * @returns {Promise<Object>} Processing result
 */
async function handleTeamChatEvent(payload, services) {
  const { cesClient, bidiClient, chatService, config } = services;
  const event = payload.event;

  logger.debug('Processing Team Chat event:', event);

  switch (event) {
    case 'bot_notification':
      return handleBotNotification(payload, services);

    case 'team_chat.message_received':
    case 'chat_message.received':
      return handleMessageReceived(payload, services);

    case 'interactive_message_select':
    case 'interactive_message_actions':
      return handleInteractiveMessage(payload, services);

    default:
      logger.debug('Unhandled Team Chat event:', event);
      return { handled: false };
  }
}

/**
 * Handle bot notification (direct message to bot).
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object
 */
async function handleBotNotification(payload, services) {
  const { cesClient, bidiClient, chatService, config } = services;

  const p = payload.payload;
  const userJid = p.userJid || p.user_jid;
  const toJid = p.toJid || p.to_jid;
  const accountId = p.accountId || p.account_id;

  // Extract message text
  const messageText = chatService.extractMessageText(payload);

  if (!messageText) {
    logger.debug('No message text found in bot notification');
    return { handled: true, action: 'no_message' };
  }

  logger.info(`Received bot notification from ${userJid}: ${messageText.substring(0, 50)}...`);

  // Check for reset command
  if (messageText.toLowerCase().trim() === '/reset') {
    resetSession('dm', userJid);
    await chatService.sendDirectMessage(
      userJid,
      'Your conversation has been reset. You can start a new conversation!'
    );
    return { handled: true, action: 'reset' };
  }

  // Check for help command
  if (messageText.toLowerCase().trim() === '/help') {
    const helpMessage = `Here's how to use me:

• Simply type your question or message
• Use /reset to start a new conversation
• Use /help to see this message

I'm powered by CX Agent Studio and ready to assist you!`;

    await chatService.sendDirectMessage(userJid, helpMessage);
    return { handled: true, action: 'help' };
  }

  // Get session and process with CX Agent Studio
  const sessionId = getSessionId('dm', userJid);

  try {
    let responseText;
    if (config.bot.useBidiSession && bidiClient) {
      responseText = await bidiClient.sendMessage(sessionId, messageText);
    } else {
      responseText = await cesClient.runSession(sessionId, messageText);
    }

    if (responseText) {
      await chatService.sendDirectMessage(userJid, responseText);
    } else {
      await chatService.sendDirectMessage(
        userJid,
        "I received your message but couldn't generate a response. Please try again."
      );
    }

    return { handled: true, action: 'responded' };
  } catch (error) {
    logger.error('Error processing bot notification:', error);
    await chatService.sendDirectMessage(
      userJid,
      'Sorry, I encountered an error processing your message. Please try again later.'
    );
    return { handled: true, action: 'error', error: error.message };
  }
}

/**
 * Handle message received in channel.
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object
 */
async function handleMessageReceived(payload, services) {
  const { cesClient, bidiClient, chatService, config } = services;

  const p = payload.payload;
  const channelId = p.channelId || p.channel_id || p.toJid || p.to_jid;
  const senderJid = p.userJid || p.user_jid || p.senderJid || p.sender_jid;

  // Don't respond to bot's own messages
  if (senderJid === config.zoom.botJid) {
    return { handled: true, action: 'self_message' };
  }

  // Extract message text
  const messageText = chatService.extractMessageText(payload);

  if (!messageText) {
    return { handled: true, action: 'no_message' };
  }

  // Check if bot is mentioned (for channels)
  const botMentioned = messageText.includes(`@${config.zoom.botJid}`) ||
    p.bot_mentioned === true ||
    p.robotJid === config.zoom.botJid;

  // Skip if not a DM and bot not mentioned
  if (p.channel_type !== 'im' && !botMentioned) {
    return { handled: true, action: 'not_mentioned' };
  }

  logger.info(`Received message from ${senderJid}: ${messageText.substring(0, 50)}...`);

  // Clean message (remove bot mention)
  const cleanMessage = messageText
    .replace(new RegExp(`@${config.zoom.botJid}`, 'gi'), '')
    .trim();

  if (!cleanMessage) {
    return { handled: true, action: 'empty_after_clean' };
  }

  // Get session and process
  const sessionId = getSessionId('channel', channelId);

  try {
    let responseText;
    if (config.bot.useBidiSession && bidiClient) {
      responseText = await bidiClient.sendMessage(sessionId, cleanMessage);
    } else {
      responseText = await cesClient.runSession(sessionId, cleanMessage);
    }

    if (responseText) {
      await chatService.sendChannelMessage(channelId, responseText);
    }

    return { handled: true, action: 'responded' };
  } catch (error) {
    logger.error('Error processing channel message:', error);
    return { handled: true, action: 'error', error: error.message };
  }
}

/**
 * Handle interactive message (button clicks, etc.).
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object
 */
async function handleInteractiveMessage(payload, services) {
  const { cesClient, bidiClient, chatService, config } = services;

  const p = payload.payload;
  const userJid = p.userJid || p.user_jid;
  const actionValue = p.actionValue || p.action_value || p.selectedItem?.value;

  if (!actionValue) {
    return { handled: true, action: 'no_action_value' };
  }

  logger.info(`Interactive action from ${userJid}: ${actionValue}`);

  // Process action as a message
  const sessionId = getSessionId('dm', userJid);

  try {
    let responseText;
    if (config.bot.useBidiSession && bidiClient) {
      responseText = await bidiClient.sendMessage(sessionId, actionValue);
    } else {
      responseText = await cesClient.runSession(sessionId, actionValue);
    }

    if (responseText) {
      await chatService.sendDirectMessage(userJid, responseText);
    }

    return { handled: true, action: 'responded' };
  } catch (error) {
    logger.error('Error processing interactive message:', error);
    return { handled: true, action: 'error', error: error.message };
  }
}

module.exports = {
  handleTeamChatEvent,
  getSessionId,
  resetSession,
};
