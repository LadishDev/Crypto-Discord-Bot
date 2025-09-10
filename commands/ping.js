import { createInfoEmbed, replyWithEmbed } from '../utils.js';

export default {
  name: 'ping',
  description: 'Replies with Pong!',
  async execute(interaction) {
    await replyWithEmbed(interaction, createInfoEmbed('Pong!', '🏓'));
  },
};
