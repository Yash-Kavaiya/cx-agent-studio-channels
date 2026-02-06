/**
 * Zoom Virtual Agent Webhook Handler.
 * Processes Virtual Agent conversation events.
 */

const { generateSessionId, logger } = require('../config');

// Session tracking for VA
const vaSessions = new Map();

/**
 * Get or create session ID for Virtual Agent.
 * @param {string} sessionId - VA session ID
 * @returns {string} CES session ID
 */
function getSessionId(sessionId) {
  const key = `va:${sessionId}`;
  if (!vaSessions.has(key)) {
    vaSessions.set(key, generateSessionId('va', sessionId));
  }
  return vaSessions.get(key);
}

/**
 * Handle Virtual Agent webhook events.
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object { cesClient, vaService, config }
 * @returns {Promise<Object>} Response for Virtual Agent
 */
async function handleVirtualAgentEvent(payload, services) {
  const { cesClient, bidiClient, vaService, config } = services;
  const event = payload.event;

  logger.debug('Processing Virtual Agent event:', event);

  switch (event) {
    case 'virtual_agent.conversation_start':
      return handleConversationStart(payload, services);

    case 'virtual_agent.message':
    case 'virtual_agent.user_message':
      return handleUserMessage(payload, services);

    case 'virtual_agent.conversation_end':
      return handleConversationEnd(payload, services);

    case 'virtual_agent.handoff_request':
      return handleHandoffRequest(payload, services);

    default:
      logger.debug('Unhandled Virtual Agent event:', event);
      return { handled: false };
  }
}

/**
 * Handle conversation start event.
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object
 */
async function handleConversationStart(payload, services) {
  const { vaService } = services;
  const context = vaService.extractContext(payload);

  logger.info(`VA conversation started: ${context.sessionId}`);

  // Initialize session
  getSessionId(context.sessionId);

  // Send welcome message
  return vaService.formatResponse(
    'Hello! I\'m your virtual assistant powered by CX Agent Studio. How can I help you today?',
    {
      suggestions: ['Ask a question', 'Get help', 'Talk to an agent'],
    }
  );
}

/**
 * Handle user message event.
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object
 */
async function handleUserMessage(payload, services) {
  const { cesClient, bidiClient, vaService, config } = services;

  const eventData = vaService.processWebhookEvent(payload);
  const context = vaService.extractContext(payload);

  if (!eventData.message) {
    logger.debug('No message in VA event');
    return vaService.formatResponse(
      'I didn\'t receive a message. Could you please try again?'
    );
  }

  logger.info(`VA message from session ${context.sessionId}: ${eventData.message.substring(0, 50)}...`);

  // Check for handoff keywords
  const handoffKeywords = ['agent', 'human', 'representative', 'speak to someone'];
  const lowerMessage = eventData.message.toLowerCase();

  if (handoffKeywords.some((kw) => lowerMessage.includes(kw))) {
    return vaService.createHandoffResponse(
      'Customer requested to speak with an agent',
      {
        lastMessage: eventData.message,
        sessionContext: context.variables,
      }
    );
  }

  // Get CES session and process
  const cesSessionId = getSessionId(context.sessionId);

  try {
    let responseText;
    if (config.bot.useBidiSession && bidiClient) {
      responseText = await bidiClient.sendMessage(cesSessionId, eventData.message);
    } else {
      responseText = await cesClient.runSession(cesSessionId, eventData.message);
    }

    if (responseText) {
      return vaService.formatResponse(responseText);
    } else {
      return vaService.formatResponse(
        'I apologize, but I couldn\'t generate a response. Would you like to speak with an agent?',
        {
          suggestions: ['Yes, connect me', 'No, let me try again'],
        }
      );
    }
  } catch (error) {
    logger.error('Error processing VA message:', error);

    return vaService.formatResponse(
      'I encountered an error processing your request. Would you like to speak with an agent?',
      {
        suggestions: ['Yes, connect me', 'No, try again'],
      }
    );
  }
}

/**
 * Handle conversation end event.
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object
 */
async function handleConversationEnd(payload, services) {
  const { vaService } = services;
  const context = vaService.extractContext(payload);

  logger.info(`VA conversation ended: ${context.sessionId}`);

  // Clean up session
  const key = `va:${context.sessionId}`;
  vaSessions.delete(key);

  return { handled: true, action: 'conversation_ended' };
}

/**
 * Handle handoff request event.
 * @param {Object} payload - Webhook payload
 * @param {Object} services - Services object
 */
async function handleHandoffRequest(payload, services) {
  const { vaService } = services;
  const context = vaService.extractContext(payload);

  logger.info(`VA handoff requested: ${context.sessionId}`);

  return vaService.createHandoffResponse(
    'Transferring to a human agent',
    {
      sessionId: context.sessionId,
      variables: context.variables,
      conversationHistory: context.history,
    }
  );
}

module.exports = {
  handleVirtualAgentEvent,
  getSessionId,
};
