/**
 * /join Slash Command
 * Join a voice channel to interact with users via voice.
 * Supports both voice input (speech-to-text) and voice output (text-to-speech).
 */

const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { logger, generateVoiceSessionId } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your current voice channel or a specified channel')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The voice channel to join (defaults to your current channel)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    ),

  /**
   * Execute the /join command.
   * @param {CommandInteraction} interaction - Discord interaction
   * @param {Object} context - Context with config, CES clients, voice manager, TTS and STT clients
   */
  async execute(interaction, context) {
    const { config, cesClient, bidiClient, voiceManager, ttsClient, sttClient } = context;

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

    // Get the target channel
    let targetChannel = interaction.options.getChannel('channel');

    // If no channel specified, use the user's current voice channel
    if (!targetChannel) {
      const member = interaction.member;
      if (!member.voice.channel) {
        await interaction.reply({
          content: 'You need to be in a voice channel or specify a channel to join.',
          ephemeral: true,
        });
        return;
      }
      targetChannel = member.voice.channel;
    }

    // Verify it's a voice channel
    if (
      targetChannel.type !== ChannelType.GuildVoice &&
      targetChannel.type !== ChannelType.GuildStageVoice
    ) {
      await interaction.reply({
        content: 'Please specify a valid voice channel.',
        ephemeral: true,
      });
      return;
    }

    // Check bot permissions
    const permissions = targetChannel.permissionsFor(interaction.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      await interaction.reply({
        content: 'I don\'t have permission to join that voice channel.',
        ephemeral: true,
      });
      return;
    }

    // Defer reply as joining might take a moment
    await interaction.deferReply();

    try {
      // Check if already connected to this channel
      const currentConnection = voiceManager.getConnection(interaction.guild.id);
      if (currentConnection && currentConnection.channelId === targetChannel.id) {
        await interaction.editReply(
          `I'm already in **${targetChannel.name}**! You can speak to me directly or use text messages.`
        );
        return;
      }

      // Create speech handler for voice interactions
      const speechHandler = createSpeechHandler(
        interaction.guild,
        config,
        cesClient,
        bidiClient,
        ttsClient,
        sttClient,
        voiceManager
      );

      // Join the voice channel with speech handler
      await voiceManager.joinChannel(targetChannel, config, speechHandler);

      logger.info(
        `/join command executed by ${interaction.user.tag} - joined ${targetChannel.name}`
      );

      await interaction.editReply(
        `Joined **${targetChannel.name}**! I'm now listening. You can speak to me directly or use text messages. I'll respond with voice!`
      );
    } catch (error) {
      logger.error('Error executing /join command:', error);
      await interaction.editReply(
        'Sorry, I couldn\'t join the voice channel. Please try again later.'
      );
    }
  },
};

/**
 * Create a speech handler for processing voice input.
 * @param {Guild} guild - Discord guild
 * @param {Object} config - Bot configuration
 * @param {Object} cesClient - CES client
 * @param {Object} bidiClient - Bidi client
 * @param {Object} ttsClient - TTS client
 * @param {Object} sttClient - STT client
 * @param {Object} voiceManager - Voice manager
 * @returns {Function} Speech handler function
 */
function createSpeechHandler(guild, config, cesClient, bidiClient, ttsClient, sttClient, voiceManager) {
  // Track processing state to avoid overlapping responses
  let isProcessing = false;

  return async (userId, audioBuffer, guildId) => {
    // Skip if already processing or bot is speaking
    if (isProcessing || voiceManager.isPlaying(guildId)) {
      logger.debug('Skipping speech - already processing or playing');
      return;
    }

    isProcessing = true;

    try {
      // Get user info
      const member = await guild.members.fetch(userId).catch(() => null);
      const userName = member?.displayName || `User ${userId}`;

      logger.info(`Processing voice input from ${userName}`);

      // Transcribe audio to text
      const transcription = await sttClient.transcribe(audioBuffer);

      if (!transcription || transcription.trim().length === 0) {
        logger.debug('Empty transcription, skipping');
        isProcessing = false;
        return;
      }

      logger.info(`Transcription from ${userName}: "${transcription}"`);

      // Generate session ID for this user in this channel
      const connectionData = voiceManager.getConnection(guildId);
      const sessionId = generateVoiceSessionId(
        guildId,
        connectionData?.channelId || 'voice',
        userId
      );

      // Send to CX Agent Studio
      let responseText;
      if (config.bot.useBidiSession && bidiClient) {
        responseText = await bidiClient.sendMessage(sessionId, transcription);
      } else {
        responseText = await cesClient.runSession(sessionId, transcription);
      }

      if (!responseText || responseText.trim().length === 0) {
        logger.warn('Empty response from agent');
        isProcessing = false;
        return;
      }

      logger.info(`Agent response: "${responseText.substring(0, 100)}..."`);

      // Convert response to speech
      const audioResponse = await ttsClient.synthesize(responseText);

      // Play the response
      await voiceManager.playAudio(guildId, audioResponse);

      logger.info(`Voice response played for ${userName}`);
    } catch (error) {
      logger.error(`Error processing voice input: ${error.message}`);
    } finally {
      isProcessing = false;
    }
  };
}
