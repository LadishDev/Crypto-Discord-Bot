
const CLIENT_ID = process.env.DISCORD_APPLICATION_ID;
const PERMISSIONS = process.env.DISCORD_INVITE_PERMISSIONS;
const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=${PERMISSIONS}`;

export default {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
  async execute(interaction) {
    // Use utility helpers for embed and button
    const { createInfoEmbed, replyWithEmbed, createButton, createButtonRow } = await import('../utils.js');
    const embed = createInfoEmbed('Invite Me to Your Server!', 'Click the button below to add this bot to your server.', 0x5865F2);
    const row = createButtonRow([
      createButton('Invite Bot', undefined, 5, false, INVITE_URL)
    ]);
    await replyWithEmbed(interaction, embed, false, [row]);
  },
};
