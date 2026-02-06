/**
 * Discord Bot Integration for CX Agent Studio.
 * Main entry point for the Discord bot application.
 */

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events,
} = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { loadConfig, logger } = require('./config');
const { createClient, createBidiClient } = require('./cesClient');

// Global instances
let config;
let cesClient;
let bidiClient;

/**
 * Initialize the Discord client with required intents.
 * @returns {Client} Discord client instance
 */
function createDiscordClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessageTyping,
    ],
    partials: [Partials.Channel, Partials.Message],
  });
}

/**
 * Load all command files from the commands directory.
 * @param {Client} client - Discord client instance
 */
function loadCommands(client) {
  client.commands = new Collection();

  const commandsPath = path.join(__dirname, 'commands');

  if (!fs.existsSync(commandsPath)) {
    logger.warn('Commands directory not found');
    return;
  }

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`Command at ${filePath} is missing required properties`);
    }
  }
}

/**
 * Load all event files from the events directory.
 * @param {Client} client - Discord client instance
 */
function loadEvents(client) {
  const eventsPath = path.join(__dirname, 'events');

  if (!fs.existsSync(eventsPath)) {
    logger.warn('Events directory not found');
    return;
  }

  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args) =>
        event.execute(...args, { config, cesClient, bidiClient })
      );
    } else {
      client.on(event.name, (...args) =>
        event.execute(...args, { config, cesClient, bidiClient })
      );
    }

    logger.info(`Loaded event: ${event.name}`);
  }
}

/**
 * Start HTTP health check server.
 * @param {number} port - Port to listen on
 */
function startHealthCheckServer(port) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`Health check server started on port ${port}`);
  });
}

/**
 * Main function to start the bot.
 */
async function main() {
  try {
    // Load configuration
    config = loadConfig();
    logger.setLevel(config.server.logLevel);
    logger.info('Starting Discord CX Agent Studio Bot');

    // Initialize CES clients
    cesClient = createClient(config);
    if (config.bot.useBidiSession) {
      bidiClient = createBidiClient(config);
      logger.info('Using BidiRunSession for streaming responses');
    } else {
      logger.info('Using runSession for synchronous responses');
    }

    // Start health check server
    startHealthCheckServer(config.server.healthCheckPort);

    // Create Discord client
    const client = createDiscordClient();

    // Load commands and events
    loadCommands(client);
    loadEvents(client);

    // Login to Discord
    logger.info('Logging in to Discord...');
    await client.login(config.discord.botToken);
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  if (cesClient) {
    await cesClient.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  if (cesClient) {
    await cesClient.close();
  }
  process.exit(0);
});

// Start the bot
main();
