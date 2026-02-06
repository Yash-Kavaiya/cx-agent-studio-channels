/**
 * Deploy Slash Commands to Discord.
 * Run this script to register commands with Discord's API.
 *
 * Usage:
 *   npm run deploy-commands
 *
 * For guild-specific (instant) deployment:
 *   DISCORD_GUILD_ID=your_guild_id npm run deploy-commands
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { logger } = require('./config');

async function deployCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    console.error(
      'Missing required environment variables: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID'
    );
    process.exit(1);
  }

  // Load commands
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`Loaded command: ${command.data.name}`);
    } else {
      console.warn(`Command at ${filePath} is missing required properties`);
    }
  }

  // Create REST instance
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`Starting deployment of ${commands.length} command(s)...`);

    let data;

    if (guildId) {
      // Guild-specific deployment (instant)
      console.log(`Deploying to guild: ${guildId}`);
      data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(
        `Successfully deployed ${data.length} command(s) to guild ${guildId}`
      );
    } else {
      // Global deployment (takes up to 1 hour)
      console.log('Deploying globally (may take up to 1 hour to propagate)');
      data = await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log(`Successfully deployed ${data.length} command(s) globally`);
    }

    console.log('Commands deployed:');
    for (const cmd of data) {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    }
  } catch (error) {
    console.error('Error deploying commands:', error);
    process.exit(1);
  }
}

deployCommands();
