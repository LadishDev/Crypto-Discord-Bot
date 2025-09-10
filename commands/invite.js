
const CLIENT_ID = process.env.DISCORD_APPLICATION_ID;
const PERMISSIONS = process.env.DISCORD_INVITE_PERMISSIONS;
const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot+applications.commands&permissions=${PERMISSIONS}`;

export default {
  name: 'invite',
  description: 'Get an invite link to add the bot to your server',
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Invite Me to Your Server!')
      .setDescription('Click the button below to add this bot to your server.')
      .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite Bot')
        .setStyle(ButtonStyle.Link)
        .setURL(INVITE_URL)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
