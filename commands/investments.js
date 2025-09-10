
import balance from './balance.js';
import fetch from 'node-fetch';
import { COINS, COIN_DECIMALS, COIN_SYMBOLS } from '../coin_constants.js';
import {
  EMBED_COLOUR, ERROR_COLOUR, createInfoEmbed, replyWithEmbed, formatUSD, formatCoinAmount, createButton, createButtonRow
} from '../utils.js';

async function getCoinData() {
  const ids = COINS.map(c => c.id).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1h,24h,7d`;
  const res = await fetch(url);
  return await res.json();
}

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
      await replyWithEmbed(interaction, createInfoEmbed('No Investments', 'Your investments are empty.', EMBED_COLOUR), true);
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
        await replyWithEmbed(interaction, createInfoEmbed('No Investments', `No investments in ${coinQuery.toUpperCase()}`, ERROR_COLOUR), true);
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
        const decimals = COIN_DECIMALS[coin.id] ?? 6;
        investmentFields.push({
          name: `${coin.name} (${COIN_SYMBOLS[coin.id]})`,
          value: `Amount: ${formatCoinAmount(amount, decimals)}\nCurrent Value: ${formatUSD(value)} ${upDown}\n1h: ${coin.price_change_percentage_1h_in_currency?.toFixed(2) ?? 'N/A'}% | 24h: ${coin.price_change_percentage_24h?.toFixed(2) ?? 'N/A'}% | 7d: ${coin.price_change_percentage_7d_in_currency?.toFixed(2) ?? 'N/A'}%`,
          inline: false
        });
      }
    }
    if (coinQuery && !hasInvestment) {
      const coinName = filteredCoins[0]?.name || coinQuery.toUpperCase();
      await replyWithEmbed(interaction, createInfoEmbed('No Investments', `No investments in ${coinName}`, ERROR_COLOUR), true);
      return;
    }

    // Pagination: 2 coins per page
    const pageSize = 2;
    const pages = [];
    for (let i = 0; i < investmentFields.length; i += pageSize) {
      const embed = createInfoEmbed(
        `${username}'s Investments`,
        `**Total Value: ${formatUSD(total)}**`,
        EMBED_COLOUR
      );
      embed.fields = investmentFields.slice(i, i + pageSize);
      pages.push(embed);
    }

    if (pages.length === 0) {
      await replyWithEmbed(interaction, createInfoEmbed('No Investments', 'Your investments are empty.', EMBED_COLOUR), true);
      return;
    }

    let currentPage = 0;
    async function sendPage(pageIdx, interactionOrComponent) {
      const components = pages.length > 1 ? [
        createButtonRow([
          createButton('Previous', 'prev', 2, pageIdx === 0),
          createButton('Next', 'next', 2, pageIdx === pages.length - 1)
        ])
      ] : [];
      await replyWithEmbed(interactionOrComponent, pages[pageIdx], false, components);
    }

    await sendPage(currentPage, interaction);

    if (pages.length > 1) {
      const msg = await interaction.fetchReply();
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
        await sendPage(currentPage, i);
      });

      collector.on('end', async () => {
        try {
          await msg.edit({ components: [] });
        } catch {}
      });
    }
  }
};
