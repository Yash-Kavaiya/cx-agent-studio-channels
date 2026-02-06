/**
 * Discord Interaction Create Event Handler.
 * Handles slash commands and other interactions.
 */

const { Events } = require('discord.js');
const { logger } = require('../config');

module.exports = {
  name: Events.InteractionCreate,

  /**
   * Execute when an interaction is created.
   * @param {Interaction} interaction - Discord interaction
   * @param {Object} context - Context with config and CES clients
   */
  async execute(interaction, context) {
    // Only handle chat input commands (slash commands)
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    logger.info(
      `Executing command: ${interaction.commandName} by ${interaction.user.tag}`
    );

    try {
      await command.execute(interaction, context);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, error);

      const errorMessage =
        'There was an error executing this command. Please try again later.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorMessage,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      }
    }
  },
};
