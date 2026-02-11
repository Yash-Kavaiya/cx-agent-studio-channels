/**
 * /leave Slash Command
 * Leave the current voice channel.
 */

const { SlashCommandBuilder } = require('discord.js');
const { logger } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the current voice channel'),

  /**
   * Execute the /leave command.
   * @param {CommandInteraction} interaction - Discord interaction
   * @param {Object} context - Context with config, CES clients, and voice manager
   */
  async execute(interaction, context) {
    const { config, voiceManager } = context;

    // Check if voice is enabled
    if (!config.voice.enabled) {
      await interaction.reply({
        content: 'Voice channel support is currently disabled.',
        ephemeral: true,
      });
      return;
    }

    // Check if in a guild
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    // Check if connected to a voice channel
    const connectionData = voiceManager.getConnection(interaction.guild.id);
    if (!connectionData) {
      await interaction.reply({
        content: 'I\'m not currently in any voice channel.',
        ephemeral: true,
      });
      return;
    }

    try {
      const channelName = connectionData.channelName;

      // Leave the voice channel
      voiceManager.leaveChannel(interaction.guild.id);

      logger.info(
        `/leave command executed by ${interaction.user.tag} - left ${channelName}`
      );

      await interaction.reply(`Left **${channelName}**. See you next time!`);
    } catch (error) {
      logger.error('Error executing /leave command:', error);
      await interaction.reply({
        content: 'Sorry, I encountered an error while leaving the voice channel.',
        ephemeral: true,
      });
    }
  },
};
