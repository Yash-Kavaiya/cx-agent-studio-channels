/**
 * /reset Slash Command
 * Reset the conversation session.
 */

const { SlashCommandBuilder } = require('discord.js');
const { logger } = require('../config');

// Import session management from messageCreate event
const { resetSession } = require('../events/messageCreate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Reset your conversation session'),

  /**
   * Execute the /reset command.
   * @param {CommandInteraction} interaction - Discord interaction
   * @param {Object} context - Context with config and CES clients
   */
  async execute(interaction, context) {
    const channelId = interaction.channelId;
    const threadId = interaction.channel?.isThread?.()
      ? interaction.channel.id
      : null;

    logger.info(`/reset command from ${interaction.user.tag}`);

    // Reset the session
    resetSession(channelId, threadId);

    await interaction.reply({
      content:
        'Your conversation session has been reset. You can now start a fresh conversation!',
      ephemeral: true,
    });
  },
};
