/**
 * Discord Voice State Update Event Handler.
 * Handles voice channel join/leave events for auto-join and auto-leave functionality.
 */

const { Events } = require('discord.js');
const { logger } = require('../config');

module.exports = {
  name: Events.VoiceStateUpdate,

  /**
   * Execute when a voice state changes.
   * @param {VoiceState} oldState - Previous voice state
   * @param {VoiceState} newState - New voice state
   * @param {Object} context - Context with config, CES clients, and voice manager
   */
  async execute(oldState, newState, context) {
    const { config, voiceManager } = context;

    if (!config.voice.enabled) {
      return;
    }

    try {
      await voiceManager.handleVoiceStateUpdate(
        oldState,
        newState,
        config,
        newState.client
      );
    } catch (error) {
      logger.error('Error handling voice state update:', error);
    }
  },
};
