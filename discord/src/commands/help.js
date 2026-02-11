/**
 * /help Slash Command
 * Show help information about the bot.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { logger } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information about the bot'),

  /**
   * Execute the /help command.
   * @param {CommandInteraction} interaction - Discord interaction
   * @param {Object} context - Context with config and CES clients
   */
  async execute(interaction, context) {
    const { config } = context;

    logger.info(`/help command from ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2) // Discord blurple
      .setTitle('CX Agent Bot Help')
      .setDescription(
        "I'm an AI assistant powered by CX Agent Studio. Here's how to interact with me:"
      )
      .addFields(
        {
          name: 'Chatting',
          value: config.bot.respondToMentionsOnly
            ? 'Mention me in a channel or send me a direct message to chat.'
            : 'Send a message in any channel where I am present, or send me a direct message.',
        },
        {
          name: 'Text Commands',
          value: [
            '`/ask [question]` - Ask me a question',
            '`/reset` - Reset your conversation session',
            '`/help` - Show this help message',
          ].join('\n'),
        },
        {
          name: 'Voice Commands',
          value: [
            '`/join [channel]` - Have me join a voice channel',
            '`/leave` - Have me leave the voice channel',
          ].join('\n'),
        },
        {
          name: 'Conversations',
          value:
            'I maintain separate conversation contexts for each channel and thread. Use `/reset` to start a fresh conversation.',
        },
        {
          name: 'Tips',
          value: [
            '• Be specific with your questions for better answers',
            '• Use threads to keep related conversations organized',
            "• If I seem confused, try resetting the conversation with `/reset`",
            '• In voice channels, use the text chat to interact with me',
          ].join('\n'),
        }
      )
      .setFooter({
        text: 'Powered by CX Agent Studio',
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
