/**
 * Discord Message Create Event Handler.
 * Handles incoming messages and responds using CX Agent Studio.
 */

const { Events, ChannelType } = require('discord.js');
const { generateSessionId, logger } = require('../config');

// Session tracking for reset functionality
const userSessions = new Map();

/**
 * Get or create a session ID for a channel/thread.
 * @param {string} channelId - Discord channel ID
 * @param {string|null} threadId - Thread ID (optional)
 * @returns {string} Session ID
 */
function getSessionId(channelId, threadId = null) {
  const key = `${channelId}:${threadId || 'main'}`;
  if (!userSessions.has(key)) {
    userSessions.set(key, generateSessionId(channelId, threadId));
  }
  return userSessions.get(key);
}

/**
 * Reset the session for a channel/thread.
 * @param {string} channelId - Discord channel ID
 * @param {string|null} threadId - Thread ID (optional)
 * @returns {string} New session ID
 */
function resetSession(channelId, threadId = null) {
  const key = `${channelId}:${threadId || 'main'}`;
  const newSession = `discord-${channelId}-${Date.now()}`.substring(0, 63);
  userSessions.set(key, newSession);
  return newSession;
}

/**
 * Check if the bot should respond to a message.
 * @param {Message} message - Discord message
 * @param {Client} client - Discord client
 * @param {Object} config - Bot configuration
 * @returns {boolean} True if bot should respond
 */
function shouldRespond(message, client, config) {
  // Ignore bot messages
  if (message.author.bot) {
    return false;
  }

  // Always respond to DMs
  if (message.channel.type === ChannelType.DM) {
    return true;
  }

  // Check for mentions
  if (message.mentions.has(client.user)) {
    return true;
  }

  // If configured to only respond to mentions, don't respond otherwise
  if (config.bot.respondToMentionsOnly) {
    return false;
  }

  return true;
}

/**
 * Extract clean message text, removing bot mentions.
 * @param {Message} message - Discord message
 * @param {Client} client - Discord client
 * @returns {string} Cleaned message text
 */
function extractMessageText(message, client) {
  let text = message.content;

  // Remove bot mentions
  text = text.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '');

  // Remove extra whitespace
  text = text.trim().replace(/\s+/g, ' ');

  return text;
}

/**
 * Send a long message, splitting if necessary.
 * @param {Message} message - Original message to reply to
 * @param {string} text - Response text
 */
async function sendLongMessage(message, text) {
  const MAX_LENGTH = 2000;

  if (text.length <= MAX_LENGTH) {
    await message.reply(text);
    return;
  }

  // Split at natural breakpoints
  const chunks = [];
  let currentChunk = '';

  for (const line of text.split('\n')) {
    if (currentChunk.length + line.length + 1 <= MAX_LENGTH) {
      currentChunk += line + '\n';
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      // Handle lines longer than MAX_LENGTH
      let remaining = line;
      while (remaining.length > MAX_LENGTH) {
        chunks.push(remaining.substring(0, MAX_LENGTH));
        remaining = remaining.substring(MAX_LENGTH);
      }
      currentChunk = remaining + '\n';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Send first chunk as reply, rest as follow-ups
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      await message.reply(chunks[i]);
    } else {
      await message.channel.send(chunks[i]);
    }
  }
}

module.exports = {
  name: Events.MessageCreate,

  /**
   * Execute when a message is created.
   * @param {Message} message - Discord message
   * @param {Object} context - Context with config and CES clients
   */
  async execute(message, context) {
    const { config, cesClient, bidiClient, voiceManager, ttsClient } = context;

    // Check if we should respond
    if (!shouldRespond(message, message.client, config)) {
      return;
    }

    // Extract message text
    const userMessage = extractMessageText(message, message.client);

    if (!userMessage) {
      return;
    }

    logger.info(
      `Received message from ${message.author.tag}: ${userMessage.substring(0, 50)}...`
    );

    // Get session ID
    const threadId = message.channel.isThread() ? message.channel.id : null;
    const sessionId = getSessionId(message.channelId, threadId);

    // Check if user is in a voice channel where bot is connected
    const guildId = message.guild?.id;
    let shouldSpeak = false;
    if (guildId && voiceManager && config.voice.enabled) {
      const connectionData = voiceManager.getConnection(guildId);
      if (connectionData) {
        // Check if the message author is in the same voice channel
        const member = message.member;
        if (member?.voice?.channelId === connectionData.channelId) {
          shouldSpeak = true;
        }
      }
    }

    try {
      // Show typing indicator
      await message.channel.sendTyping();

      // Keep typing indicator active during processing
      const typingInterval = setInterval(() => {
        message.channel.sendTyping().catch(() => {});
      }, 5000);

      // Process message with CX Agent Studio
      let responseText;
      try {
        if (config.bot.useBidiSession && bidiClient) {
          responseText = await bidiClient.sendMessage(sessionId, userMessage);
        } else {
          responseText = await cesClient.runSession(sessionId, userMessage);
        }
      } finally {
        clearInterval(typingInterval);
      }

      // Send response
      if (responseText) {
        // Send text response
        await sendLongMessage(message, responseText);

        // If user is in voice channel with bot, also speak the response
        if (shouldSpeak && ttsClient) {
          try {
            logger.info('Converting response to speech for voice channel');
            const audioBuffer = await ttsClient.synthesize(responseText);
            await voiceManager.playAudio(guildId, audioBuffer);
            logger.info('Voice response played successfully');
          } catch (ttsError) {
            logger.error('Error playing voice response:', ttsError.message);
            // Don't fail the whole response if TTS fails
          }
        }
      } else {
        await message.reply(
          "I received your message but couldn't generate a response. Please try again."
        );
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      await message.reply(
        'Sorry, I encountered an error processing your message. Please try again later.'
      );
    }
  },

  // Export helper functions for use by commands
  getSessionId,
  resetSession,
};
