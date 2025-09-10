import balance from './balance.js';
import fetch from 'node-fetch';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';



async function getCoinData() {
  const ids = COINS.map(c => c.id).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1h,24h,7d`;
  const res = await fetch(url);
  return await res.json();
}

const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
];

export default {
  name: 'investments',
  description: 'Check your crypto investments',
  options: [
    {
      name: 'coin',
      type: 3, // STRING
      description: 'Show only a specific coin (symbol or name)',
      required: false,
      choices: COINS.map(c => ({ name: c.name, value: c.id }))
    }
  ],
  async execute(interaction) {
    const userId = interaction.user.id;
    const holdings = balance.getHoldings(userId);
    if (!Object.keys(holdings).length) {
      await interaction.reply('Your investments are empty.');
      return;
    }
    const coins = await getCoinData();
    const username = interaction.user.globalName || interaction.user.username || 'User';
    const coinQuery = interaction.options?.getString?.('coin')?.toLowerCase?.();

    // If a coin is queried, filter to that coin only
    let filteredCoins = coins;
    if (coinQuery) {
      filteredCoins = coins.filter(coin =>
        coin.id.toLowerCase() === coinQuery ||
        coin.symbol.toLowerCase() === coinQuery ||
        coin.name.toLowerCase() === coinQuery
      );
      if (filteredCoins.length === 0) {
        await interaction.reply(`No investments in ${coinQuery.toUpperCase()}`);
        return;
      }
    }

    let total = 0;
    const investmentFields = [];
    let hasInvestment = false;
    for (const coin of filteredCoins) {
      const amount = holdings[coin.id] || 0;
      if (amount > 0) {
        hasInvestment = true;
        const value = amount * coin.current_price;
        total += value;
        const upDown = coin.price_change_percentage_24h > 0 ? '📈' : '📉';
        investmentFields.push({
          name: `${coin.name} (${coin.symbol.toUpperCase()})`,
          value: `Amount: ${amount.toFixed(6)}\nCurrent Value: $${value.toFixed(2)} USD ${upDown}\n1h: ${coin.price_change_percentage_1h_in_currency?.toFixed(2) ?? 'N/A'}% | 24h: ${coin.price_change_percentage_24h?.toFixed(2) ?? 'N/A'}% | 7d: ${coin.price_change_percentage_7d_in_currency?.toFixed(2) ?? 'N/A'}%`,
          inline: false
        });
      }
    }
    if (coinQuery && !hasInvestment) {
      const coinName = filteredCoins[0]?.name || coinQuery.toUpperCase();
      await interaction.reply(`No investments in ${coinName}`);
      return;
    }

    // Pagination: 2 coins per page
    const pageSize = 2;
    const pages = [];
    for (let i = 0; i < investmentFields.length; i += pageSize) {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`${username}'s Investments`)
        .setDescription(`**Total Value: $${total.toFixed(2)} USD**`)
        .setTimestamp();
      embed.addFields(investmentFields.slice(i, i + pageSize));
      pages.push(embed);
    }

    if (pages.length === 0) {
      await interaction.reply('Your investments are empty.');
      return;
    }

    let currentPage = 0;
    const getRow = (page) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === pages.length - 1)
      );
    };

    // Remove deprecated fetchReply, use the returned message from reply
    const replyMsg = await interaction.reply({
      embeds: [pages[0]],
      components: pages.length > 1 ? [getRow(0)] : []
    });

    if (pages.length > 1) {
      // If replyMsg is not a message, fetch it
      let msg = replyMsg;
      if (!msg || typeof msg.edit !== 'function') {
        msg = await interaction.fetchReply();
      }
      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.customId === 'prev' && currentPage > 0) {
          currentPage--;
        } else if (i.customId === 'next' && currentPage < pages.length - 1) {
          currentPage++;
        }
        await i.update({
          embeds: [pages[currentPage]],
          components: [getRow(currentPage)]
        });
      });

      collector.on('end', async () => {
        try {
          await msg.edit({ components: [] });
        } catch {}
      });
    }
  }
};
