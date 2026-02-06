/**
 * Configuration management for Discord CX Agent Studio Bot.
 * Loads configuration from environment variables with validation.
 */

require('dotenv').config();

/**
 * Validates required environment variables and returns configuration object.
 * @returns {Object} Configuration object
 * @throws {Error} If required configuration is missing
 */
function loadConfig() {
  const requiredVars = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'GCP_PROJECT_ID',
    'CES_APP_ID',
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return {
    // Discord settings
    discord: {
      botToken: process.env.DISCORD_BOT_TOKEN,
      clientId: process.env.DISCORD_CLIENT_ID,
      guildId: process.env.DISCORD_GUILD_ID || null, // Optional: for guild-specific commands
    },

    // Google Cloud settings
    gcp: {
      projectId: process.env.GCP_PROJECT_ID,
      region: process.env.GCP_REGION || 'us',
    },

    // CX Agent Studio settings
    ces: {
      appId: process.env.CES_APP_ID,
      deploymentId: process.env.CES_DEPLOYMENT_ID || null,
    },

    // Bot behavior settings
    bot: {
      respondToMentionsOnly: process.env.RESPOND_TO_MENTIONS_ONLY === 'true',
      useBidiSession: process.env.USE_BIDI_SESSION === 'true',
    },

    // Server settings
    server: {
      healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '8080', 10),
      logLevel: process.env.LOG_LEVEL || 'info',
    },
  };
}

/**
 * Get the full CX Agent Studio app resource name.
 * @param {Object} config - Configuration object
 * @returns {string} App resource name
 */
function getAppResourceName(config) {
  return `projects/${config.gcp.projectId}/locations/${config.gcp.region}/apps/${config.ces.appId}`;
}

/**
 * Get the full session resource name.
 * @param {Object} config - Configuration object
 * @param {string} sessionId - Session ID
 * @returns {string} Session resource name
 */
function getSessionName(config, sessionId) {
  return `${getAppResourceName(config)}/sessions/${sessionId}`;
}

/**
 * Generate a valid session ID from Discord channel/thread info.
 * Session ID must match: [a-zA-Z0-9][a-zA-Z0-9-_]{4,62}
 * @param {string} channelId - Discord channel ID
 * @param {string|null} threadId - Thread ID (optional)
 * @returns {string} Valid session ID
 */
function generateSessionId(channelId, threadId = null) {
  const threadPart = threadId || 'main';
  let sessionId = `discord-${channelId}-${threadPart}`;

  // Ensure first character is alphanumeric
  if (!/^[a-zA-Z0-9]/.test(sessionId)) {
    sessionId = 'd' + sessionId;
  }

  // Remove invalid characters
  sessionId = sessionId.replace(/[^a-zA-Z0-9\-_]/g, '-');

  // Ensure minimum length of 5
  if (sessionId.length < 5) {
    sessionId = sessionId + '-sess';
  }

  // Max 63 characters
  return sessionId.substring(0, 63);
}

/**
 * Simple logger with level support.
 */
const logger = {
  levels: { debug: 0, info: 1, warn: 2, error: 3 },
  currentLevel: 'info',

  setLevel(level) {
    this.currentLevel = level;
  },

  _log(level, ...args) {
    if (this.levels[level] >= this.levels[this.currentLevel]) {
      const timestamp = new Date().toISOString();
      console[level === 'debug' ? 'log' : level](
        `[${timestamp}] [${level.toUpperCase()}]`,
        ...args
      );
    }
  },

  debug(...args) {
    this._log('debug', ...args);
  },
  info(...args) {
    this._log('info', ...args);
  },
  warn(...args) {
    this._log('warn', ...args);
  },
  error(...args) {
    this._log('error', ...args);
  },
};

module.exports = {
  loadConfig,
  getAppResourceName,
  getSessionName,
  generateSessionId,
  logger,
};
