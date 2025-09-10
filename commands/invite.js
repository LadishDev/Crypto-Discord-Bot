export default {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
  async execute(interaction) {
    await interaction.reply('Invite me to your server with this link: <your-bot-invite-link>');
  },
};
