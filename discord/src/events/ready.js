/**
 * Discord Ready Event Handler.
 * Triggered when the bot successfully logs in and is ready.
 */

const { Events } = require('discord.js');
const { logger } = require('../config');

module.exports = {
  name: Events.ClientReady,
  once: true,

  /**
   * Execute when the bot is ready.
   * @param {Client} client - Discord client instance
   * @param {Object} context - Context with config and CES clients
   */
  execute(client, context) {
    const { config } = context;

    logger.info(`Bot is ready! Logged in as ${client.user.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
    logger.info(
      `Using CX Agent Studio app: projects/${config.gcp.projectId}/locations/${config.gcp.region}/apps/${config.ces.appId}`
    );

    // Set bot status
    client.user.setPresence({
      activities: [
        {
          name: 'for messages | /help',
          type: 3, // Watching
        },
      ],
      status: 'online',
    });
  },
};
