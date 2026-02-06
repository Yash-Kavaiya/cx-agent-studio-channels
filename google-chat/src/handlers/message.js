/**
 * Google Chat Message Event Handler.
 * Processes incoming messages and generates responses.
 */

const { generateSessionId, logger } = require('../config');

// Session tracking
const userSessions = new Map();

/**
 * Get or create a session ID for a chat context.
 * @param {string} type - Type (dm or space)
 * @param {string} identifier - User ID or space ID
 * @param {string} threadId - Thread ID (optional)
 * @returns {string} Session ID
 */
function getSessionId(type, identifier, threadId = null) {
  const key = `${type}:${identifier}:${threadId || 'main'}`;
  if (!userSessions.has(key)) {
    userSessions.set(key, generateSessionId(type, identifier, threadId));
  }
  return userSessions.get(key);
}

/**
 * Reset session for a chat context.
 * @param {string} type - Type (dm or space)
 * @param {string} identifier - User ID or space ID
 * @param {string} threadId - Thread ID (optional)
 */
function resetSession(type, identifier, threadId = null) {
  const key = `${type}:${identifier}:${threadId || 'main'}`;
  const newSession = generateSessionId(type, `${identifier}-${Date.now()}`, threadId);
  userSessions.set(key, newSession);
}

/**
 * Handle MESSAGE event from Google Chat.
 * @param {Object} event - Chat event
 * @param {Object} services - Services object
 * @returns {Promise<Object>} Response object
 */
async function handleMessage(event, services) {
  const { cesClient, bidiClient, chatClient, config } = services;

  const message = event.message;
  const space = event.space;
  const user = event.user;

  // Extract message text
  let messageText = message.argumentText || message.text || '';
  messageText = messageText.trim();

  if (!messageText) {
    logger.debug('Empty message received');
    return { text: 'Please send a message and I\'ll do my best to help!' };
  }

  // Determine if this is a DM or space message
  const isDM = space.type === 'DM';
  const spaceId = space.name.split('/')[1];
  const threadId = message.thread?.name?.split('/').pop() || null;

  logger.info(
    `Message from ${user.displayName} in ${isDM ? 'DM' : 'space'}: ${messageText.substring(0, 50)}...`
  );

  // Handle slash commands
  if (message.slashCommand) {
    return handleSlashCommand(message.slashCommand, event, services);
  }

  // Check for built-in commands
  const lowerText = messageText.toLowerCase();
  if (lowerText === '/reset' || lowerText === 'reset') {
    resetSession(isDM ? 'dm' : 'space', isDM ? user.name : spaceId, threadId);
    return { text: 'Your conversation has been reset. You can start a new conversation!' };
  }

  if (lowerText === '/help' || lowerText === 'help') {
    return {
      cardsV2: [
        {
          cardId: 'help-card',
          card: chatClient.createHelpCard(),
        },
      ],
    };
  }

  // Get session ID
  const sessionId = getSessionId(
    isDM ? 'dm' : 'space',
    isDM ? user.name.split('/')[1] : spaceId,
    threadId
  );

  try {
    // Process with CX Agent Studio
    let responseText;
    if (config.bot.useBidiSession && bidiClient) {
      responseText = await bidiClient.sendMessage(sessionId, messageText);
    } else {
      responseText = await cesClient.runSession(sessionId, messageText);
    }

    if (responseText) {
      // Split long responses if needed
      if (responseText.length > 4096) {
        return { text: responseText.substring(0, 4096) + '...' };
      }
      return { text: responseText };
    } else {
      return {
        text: "I received your message but couldn't generate a response. Please try again.",
      };
    }
  } catch (error) {
    logger.error('Error processing message:', error);
    return {
      text: 'Sorry, I encountered an error processing your message. Please try again later.',
    };
  }
}

/**
 * Handle slash commands.
 * @param {Object} slashCommand - Slash command object
 * @param {Object} event - Chat event
 * @param {Object} services - Services object
 * @returns {Promise<Object>} Response object
 */
async function handleSlashCommand(slashCommand, event, services) {
  const { cesClient, bidiClient, chatClient, config } = services;

  const commandId = slashCommand.commandId;
  const message = event.message;
  const space = event.space;
  const user = event.user;

  const isDM = space.type === 'DM';
  const spaceId = space.name.split('/')[1];
  const threadId = message.thread?.name?.split('/').pop() || null;

  // Get argument text (text after the command)
  const argumentText = message.argumentText?.trim() || '';

  logger.info(`Slash command ${commandId} from ${user.displayName}: ${argumentText}`);

  // Handle different commands based on commandId
  // Note: commandId is assigned when configuring the Chat app
  switch (commandId) {
    case '1': // /ask
    case 'ask':
      if (!argumentText) {
        return { text: 'Please provide a question. Usage: `/ask [your question]`' };
      }

      const sessionId = getSessionId(
        isDM ? 'dm' : 'space',
        isDM ? user.name.split('/')[1] : spaceId,
        threadId
      );

      try {
        let responseText;
        if (config.bot.useBidiSession && bidiClient) {
          responseText = await bidiClient.sendMessage(sessionId, argumentText);
        } else {
          responseText = await cesClient.runSession(sessionId, argumentText);
        }

        return { text: responseText || 'No response generated.' };
      } catch (error) {
        logger.error('Error processing /ask command:', error);
        return { text: 'Sorry, I encountered an error. Please try again.' };
      }

    case '2': // /reset
    case 'reset':
      resetSession(isDM ? 'dm' : 'space', isDM ? user.name : spaceId, threadId);
      return { text: 'Your conversation has been reset. Start fresh!' };

    case '3': // /help
    case 'help':
      return {
        cardsV2: [
          {
            cardId: 'help-card',
            card: chatClient.createHelpCard(),
          },
        ],
      };

    default:
      return { text: `Unknown command. Type /help for available commands.` };
  }
}

module.exports = {
  handleMessage,
  handleSlashCommand,
  getSessionId,
  resetSession,
};
