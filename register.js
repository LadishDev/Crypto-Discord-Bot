import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'url';
import fetch from 'node-fetch';
import 'dotenv/config';

/**
 * This file is meant to be run from the command line, and is not used by the
 * application server.  It's allowed to use node.js primitives, and only needs
 * to be run once.
 */

const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  throw new Error('The DISCORD_TOKEN environment variable is required.');
}
if (!applicationId) {
  throw new Error(
    'The DISCORD_APPLICATION_ID environment variable is required.'
  );
}



// Remove all global commands to prevent duplicates
async function deleteGlobalCommands() {
  const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    method: 'GET',
  });
  if (response.ok) {
    const commands = await response.json();
    for (const cmd of commands) {
      const delUrl = `${url}/${cmd.id}`;
      await fetch(delUrl, {
        headers: {
          Authorization: `Bot ${token}`,
        },
        method: 'DELETE',
      });
      console.log(`Deleted global command: ${cmd.name}`);
    }
  } else {
    console.error('Failed to fetch global commands for deletion');
  }
}

// Register all commands for a specific guild for instant visibility.
if (!guildId) {
  throw new Error('The GUILD_ID environment variable is required.');
}

async function registerGuildCommands() {
  const url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
  await registerCommands(url);
}

async function registerCommands(url) {
  // Dynamically load all commands from the commands folder
  const commands = [];
  const commandsPath = path.resolve('./commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const fileUrl = pathToFileURL(path.join(commandsPath, file));
    const command = await import(fileUrl);
    // Include options if present
    const { name, description, options } = command.default;
    const cmd = { name, description };
    if (options) cmd.options = options;
    commands.push(cmd);
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    method: 'PUT',
    body: JSON.stringify(commands),
  });

  if (response.ok) {
    console.log('Registered all commands');
  } else {
    console.error('Error registering commands');
    const text = await response.text();
    console.error(text);
  }
  return response;
}

await deleteGlobalCommands();
await registerGuildCommands();
