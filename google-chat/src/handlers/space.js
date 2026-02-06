/**
 * Google Chat Space Event Handler.
 * Handles ADDED_TO_SPACE and REMOVED_FROM_SPACE events.
 */

const { logger } = require('../config');

/**
 * Handle ADDED_TO_SPACE event.
 * @param {Object} event - Chat event
 * @param {Object} services - Services object
 * @returns {Object} Response object
 */
function handleAddedToSpace(event, services) {
  const { chatClient } = services;
  const space = event.space;
  const user = event.user;

  logger.info(`Bot added to ${space.type}: ${space.displayName || space.name}`);

  // Different welcome messages for DMs vs spaces
  if (space.type === 'DM') {
    return {
      text: `Hello ${user.displayName}! 👋\n\nI'm your AI assistant powered by CX Agent Studio. Simply send me a message to get started!\n\nType /help to see available commands.`,
    };
  } else {
    return {
      text: `Hello everyone! 👋\n\nI'm an AI assistant powered by CX Agent Studio. Mention me @${event.user?.displayName || 'CX Agent Bot'} or use /ask to interact with me.\n\nType /help to see available commands.`,
    };
  }
}

/**
 * Handle REMOVED_FROM_SPACE event.
 * @param {Object} event - Chat event
 * @param {Object} services - Services object
 * @returns {Object|null} Response object or null
 */
function handleRemovedFromSpace(event, services) {
  const space = event.space;

  logger.info(`Bot removed from: ${space.displayName || space.name}`);

  // No response needed when removed
  return null;
}

module.exports = {
  handleAddedToSpace,
  handleRemovedFromSpace,
};
