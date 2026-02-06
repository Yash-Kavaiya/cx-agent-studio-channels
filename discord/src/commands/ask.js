/**
 * /ask Slash Command
 * Ask the AI agent a question.
 */

const { SlashCommandBuilder } = require('discord.js');
const { generateSessionId, logger } = require('../config');

// Import session management from messageCreate event
const { getSessionId } = require('../events/messageCreate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the AI agent a question')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Your question for the AI agent')
        .setRequired(true)
    ),

  /**
   * Execute the /ask command.
   * @param {CommandInteraction} interaction - Discord interaction
   * @param {Object} context - Context with config and CES clients
   */
  async execute(interaction, context) {
    const { config, cesClient, bidiClient } = context;

    const question = interaction.options.getString('question');
    const channelId = interaction.channelId;
    const threadId = interaction.channel?.isThread?.()
      ? interaction.channel.id
      : null;

    logger.info(`/ask command from ${interaction.user.tag}: ${question}`);

    // Defer reply to allow for longer processing time
    await interaction.deferReply();

    try {
      // Get session ID
      const sessionId = getSessionId(channelId, threadId);

      // Process message with CX Agent Studio
      let responseText;
      if (config.bot.useBidiSession && bidiClient) {
        responseText = await bidiClient.sendMessage(sessionId, question);
      } else {
        responseText = await cesClient.runSession(sessionId, question);
      }

      // Send response
      if (responseText) {
        // Discord has a 2000 character limit
        if (responseText.length > 2000) {
          // Split into multiple messages
          const chunks = [];
          let remaining = responseText;

          while (remaining.length > 0) {
            if (remaining.length <= 2000) {
              chunks.push(remaining);
              break;
            }

            // Find a good break point
            let breakPoint = remaining.lastIndexOf('\n', 2000);
            if (breakPoint === -1 || breakPoint < 1000) {
              breakPoint = remaining.lastIndexOf(' ', 2000);
            }
            if (breakPoint === -1 || breakPoint < 1000) {
              breakPoint = 2000;
            }

            chunks.push(remaining.substring(0, breakPoint));
            remaining = remaining.substring(breakPoint).trim();
          }

          // Send first chunk as reply
          await interaction.editReply(chunks[0]);

          // Send remaining chunks as follow-ups
          for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp(chunks[i]);
          }
        } else {
          await interaction.editReply(responseText);
        }
      } else {
        await interaction.editReply(
          "I received your question but couldn't generate a response. Please try again."
        );
      }
    } catch (error) {
      logger.error('Error processing /ask command:', error);
      await interaction.editReply(
        'Sorry, I encountered an error processing your question. Please try again later.'
      );
    }
  },
};
