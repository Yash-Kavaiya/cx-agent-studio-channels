/**
 * Voice Manager for Discord CX Agent Studio Bot.
 * Handles voice channel connections, audio playback, and voice capture.
 * Supports Text-to-Speech and Speech-to-Text for voice interactions.
 */

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  EndBehaviorType,
} = require('@discordjs/voice');
const { ChannelType } = require('discord.js');
const { Readable } = require('stream');
const prism = require('prism-media');
const { logger } = require('./config');

// Audio players per guild
const audioPlayers = new Map();

// Active voice connections per guild
const voiceConnections = new Map();

// Auto-leave timers per guild
const autoLeaveTimers = new Map();

// Voice listeners per guild (user ID -> audio buffers)
const voiceListeners = new Map();

// Speech handlers per guild
const speechHandlers = new Map();

/**
 * Join a voice channel with optional voice listening.
 * @param {VoiceChannel|StageChannel} voiceChannel - The voice channel to join
 * @param {Object} config - Bot configuration
 * @param {Function} onSpeech - Callback when speech is detected (userId, audioBuffer)
 * @returns {Promise<VoiceConnection>} The voice connection
 */
async function joinChannel(voiceChannel, config, onSpeech = null) {
  const guildId = voiceChannel.guild.id;

  // Clear any existing auto-leave timer
  clearAutoLeaveTimer(guildId);

  // Check if already connected to this channel
  const existingConnection = voiceConnections.get(guildId);
  if (existingConnection && existingConnection.channelId === voiceChannel.id) {
    logger.debug(`Already connected to voice channel ${voiceChannel.name}`);
    // Update speech handler if provided
    if (onSpeech) {
      speechHandlers.set(guildId, onSpeech);
    }
    return existingConnection.connection;
  }

  // Destroy existing connection if connected to a different channel
  if (existingConnection) {
    existingConnection.connection.destroy();
    voiceConnections.delete(guildId);
  }

  logger.info(`Joining voice channel: ${voiceChannel.name} in guild ${voiceChannel.guild.name}`);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  // Wait for connection to be ready
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30000);
    logger.info(`Successfully joined voice channel: ${voiceChannel.name}`);

    // Create and store audio player
    const player = createAudioPlayer();
    audioPlayers.set(guildId, player);

    // Subscribe connection to player
    connection.subscribe(player);

    // Store speech handler
    if (onSpeech) {
      speechHandlers.set(guildId, onSpeech);
    }

    // Set up voice receiver for listening
    setupVoiceReceiver(connection, guildId);

    // Store connection
    voiceConnections.set(guildId, {
      connection,
      player,
      channelId: voiceChannel.id,
      channelName: voiceChannel.name,
      guildName: voiceChannel.guild.name,
      channel: voiceChannel,
    });

    // Set up connection state change handlers
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      logger.warn(`Disconnected from voice channel in ${voiceChannel.guild.name}`);
      try {
        // Try to reconnect
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
        // Connection is recovering
      } catch {
        // Connection is not recovering, destroy it
        connection.destroy();
        voiceConnections.delete(guildId);
        voiceListeners.delete(guildId);
        speechHandlers.delete(guildId);
        clearAutoLeaveTimer(guildId);
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      logger.info(`Voice connection destroyed for guild ${voiceChannel.guild.name}`);
      voiceConnections.delete(guildId);
      voiceListeners.delete(guildId);
      speechHandlers.delete(guildId);
      clearAutoLeaveTimer(guildId);
    });

    return connection;
  } catch (error) {
    logger.error(`Failed to join voice channel: ${error.message}`);
    connection.destroy();
    throw error;
  }
}

/**
 * Set up voice receiver to listen to users.
 * @param {VoiceConnection} connection - Voice connection
 * @param {string} guildId - Guild ID
 */
function setupVoiceReceiver(connection, guildId) {
  const receiver = connection.receiver;

  // Initialize listeners map for this guild
  voiceListeners.set(guildId, new Map());

  receiver.speaking.on('start', (userId) => {
    logger.debug(`User ${userId} started speaking in guild ${guildId}`);

    // Create audio stream for this user
    const audioStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000, // Stop after 1 second of silence
      },
    });

    // Decode Opus to PCM
    const decoder = new prism.opus.Decoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
    });

    const chunks = [];
    let totalLength = 0;

    audioStream.pipe(decoder);

    decoder.on('data', (chunk) => {
      chunks.push(chunk);
      totalLength += chunk.length;
    });

    decoder.on('end', async () => {
      logger.debug(`User ${userId} finished speaking, captured ${totalLength} bytes`);

      if (totalLength > 0) {
        // Combine all chunks into a single buffer
        const audioBuffer = Buffer.concat(chunks, totalLength);

        // Check minimum audio length (at least 0.5 seconds of audio)
        // 48000 samples/sec * 2 bytes/sample * 2 channels * 0.5 sec = 96000 bytes
        if (audioBuffer.length < 96000) {
          logger.debug('Audio too short, ignoring');
          return;
        }

        // Call the speech handler if registered
        const handler = speechHandlers.get(guildId);
        if (handler) {
          try {
            await handler(userId, audioBuffer, guildId);
          } catch (error) {
            logger.error(`Error in speech handler: ${error.message}`);
          }
        }
      }
    });

    decoder.on('error', (error) => {
      logger.error(`Decoder error for user ${userId}: ${error.message}`);
    });
  });
}

/**
 * Leave a voice channel.
 * @param {string} guildId - The guild ID
 * @returns {boolean} True if successfully left, false if not connected
 */
function leaveChannel(guildId) {
  clearAutoLeaveTimer(guildId);

  const connectionData = voiceConnections.get(guildId);
  if (!connectionData) {
    logger.debug(`Not connected to any voice channel in guild ${guildId}`);
    return false;
  }

  logger.info(`Leaving voice channel: ${connectionData.channelName} in ${connectionData.guildName}`);

  // Stop and clean up audio player
  if (connectionData.player) {
    connectionData.player.stop();
  }
  audioPlayers.delete(guildId);
  voiceListeners.delete(guildId);
  speechHandlers.delete(guildId);

  connectionData.connection.destroy();
  voiceConnections.delete(guildId);
  return true;
}

/**
 * Play audio in a voice channel.
 * @param {string} guildId - The guild ID
 * @param {Buffer} audioBuffer - Audio buffer (OGG Opus format)
 * @returns {Promise<void>} Resolves when audio finishes playing
 */
async function playAudio(guildId, audioBuffer) {
  const connectionData = voiceConnections.get(guildId);
  if (!connectionData) {
    logger.warn(`Cannot play audio: not connected to voice channel in guild ${guildId}`);
    return;
  }

  const { player } = connectionData;
  if (!player) {
    logger.warn(`No audio player for guild ${guildId}`);
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      // Create a readable stream from the buffer
      const stream = new Readable();
      stream.push(audioBuffer);
      stream.push(null);

      // Create audio resource
      const resource = createAudioResource(stream, {
        inputType: StreamType.OggOpus,
      });

      // Set up completion handler
      const onIdle = () => {
        player.off(AudioPlayerStatus.Idle, onIdle);
        player.off('error', onError);
        logger.debug('Audio playback completed');
        resolve();
      };

      const onError = (error) => {
        player.off(AudioPlayerStatus.Idle, onIdle);
        player.off('error', onError);
        logger.error('Audio playback error:', error.message);
        reject(error);
      };

      player.on(AudioPlayerStatus.Idle, onIdle);
      player.on('error', onError);

      // Play the audio
      player.play(resource);
      logger.debug('Started audio playback');
    } catch (error) {
      logger.error('Error creating audio resource:', error.message);
      reject(error);
    }
  });
}

/**
 * Check if audio is currently playing in a guild.
 * @param {string} guildId - The guild ID
 * @returns {boolean} True if audio is playing
 */
function isPlaying(guildId) {
  const connectionData = voiceConnections.get(guildId);
  if (!connectionData || !connectionData.player) {
    return false;
  }
  return connectionData.player.state.status === AudioPlayerStatus.Playing;
}

/**
 * Get the current voice connection for a guild.
 * @param {string} guildId - The guild ID
 * @returns {Object|null} Connection data or null
 */
function getConnection(guildId) {
  return voiceConnections.get(guildId) || null;
}

/**
 * Check if bot is connected to a voice channel in a guild.
 * @param {string} guildId - The guild ID
 * @returns {boolean} True if connected
 */
function isConnected(guildId) {
  return voiceConnections.has(guildId);
}

/**
 * Set the speech handler for a guild.
 * @param {string} guildId - Guild ID
 * @param {Function} handler - Handler function (userId, audioBuffer, guildId)
 */
function setSpeechHandler(guildId, handler) {
  speechHandlers.set(guildId, handler);
}

/**
 * Set an auto-leave timer for a guild.
 * @param {string} guildId - The guild ID
 * @param {number} delay - Delay in milliseconds
 */
function setAutoLeaveTimer(guildId, delay) {
  clearAutoLeaveTimer(guildId);

  const timer = setTimeout(() => {
    logger.info(`Auto-leaving voice channel in guild ${guildId} due to inactivity`);
    leaveChannel(guildId);
  }, delay);

  autoLeaveTimers.set(guildId, timer);
}

/**
 * Clear the auto-leave timer for a guild.
 * @param {string} guildId - The guild ID
 */
function clearAutoLeaveTimer(guildId) {
  const timer = autoLeaveTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    autoLeaveTimers.delete(guildId);
  }
}

/**
 * Check if the bot is alone in a voice channel.
 * @param {VoiceChannel|StageChannel} voiceChannel - The voice channel
 * @returns {boolean} True if bot is alone (only bot or no human members)
 */
function isBotAloneInChannel(voiceChannel) {
  const members = voiceChannel.members.filter((member) => !member.user.bot);
  return members.size === 0;
}

/**
 * Handle voice state updates for auto-join/leave functionality.
 * @param {VoiceState} oldState - Previous voice state
 * @param {VoiceState} newState - New voice state
 * @param {Object} config - Bot configuration
 * @param {Client} client - Discord client
 */
async function handleVoiceStateUpdate(oldState, newState, config, client) {
  if (!config.voice.enabled) return;

  const guildId = newState.guild.id;
  const connectionData = voiceConnections.get(guildId);

  // Ignore bot's own voice state changes
  if (newState.member?.user.id === client.user.id) return;

  // Check if the update is for the channel the bot is in
  if (connectionData) {
    const botChannel = newState.guild.channels.cache.get(connectionData.channelId);
    if (botChannel && isBotAloneInChannel(botChannel)) {
      // Bot is now alone in the channel
      if (config.voice.autoLeave) {
        logger.info(`Bot is alone in voice channel, starting auto-leave timer`);
        setAutoLeaveTimer(guildId, config.voice.autoLeaveDelay);
      }
    } else {
      // Someone joined, clear auto-leave timer
      clearAutoLeaveTimer(guildId);
    }
  }

  // Auto-join functionality
  if (config.voice.autoJoin && newState.channel && !oldState.channel) {
    // User joined a voice channel
    if (!connectionData && !newState.member?.user.bot) {
      // Bot is not in any voice channel in this guild
      const voiceChannel = newState.channel;
      if (
        voiceChannel.type === ChannelType.GuildVoice ||
        voiceChannel.type === ChannelType.GuildStageVoice
      ) {
        try {
          await joinChannel(voiceChannel, config);
        } catch (error) {
          logger.error(`Auto-join failed: ${error.message}`);
        }
      }
    }
  }
}

/**
 * Get all active voice connections.
 * @returns {Map} Map of guild IDs to connection data
 */
function getAllConnections() {
  return new Map(voiceConnections);
}

/**
 * Destroy all voice connections (for shutdown).
 */
function destroyAllConnections() {
  for (const [guildId, connectionData] of voiceConnections) {
    logger.info(`Destroying voice connection for guild ${guildId}`);
    connectionData.connection.destroy();
  }
  voiceConnections.clear();
  voiceListeners.clear();
  speechHandlers.clear();

  for (const timer of autoLeaveTimers.values()) {
    clearTimeout(timer);
  }
  autoLeaveTimers.clear();
}

module.exports = {
  joinChannel,
  leaveChannel,
  getConnection,
  isConnected,
  playAudio,
  isPlaying,
  setSpeechHandler,
  setAutoLeaveTimer,
  clearAutoLeaveTimer,
  isBotAloneInChannel,
  handleVoiceStateUpdate,
  getAllConnections,
  destroyAllConnections,
};
