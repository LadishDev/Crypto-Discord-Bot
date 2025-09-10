

import path from 'path';
import { COIN_DECIMALS, COIN_SYMBOLS } from '../coin_constants.js';
import {
  createInfoEmbed, replyWithEmbed, formatUSD, formatCoinAmount, readJson, createButton, createButtonRow
} from '../utils.js';

const TRANSACTIONS_PATH = path.resolve('./transactions.json');
function getTransactions(userId) {
  const all = readJson(TRANSACTIONS_PATH);
  if (!Array.isArray(all)) return [];
  return all.filter(tx => tx.userId === userId);
}

export default {
  name: 'transactions',
  description: 'List your recent crypto transactions',
  async execute(interaction) {
    const userId = interaction.user.id;
    const txs = getTransactions(userId).sort((a, b) => b.timestamp - a.timestamp);
    if (!txs.length) {
      await replyWithEmbed(interaction, createInfoEmbed('No Transactions', 'You have no transactions.'), true);
      return;
    }
    const pageSize = 5;
    let page = 0;
    const totalPages = Math.ceil(txs.length / pageSize);


    function getPageEmbed(pageIdx) {
      const start = pageIdx * pageSize;
      const end = start + pageSize;
      const pageTxs = txs.slice(start, end);
      return {
        embed: createInfoEmbed(
          `Your Transactions (Page ${pageIdx + 1}/${totalPages})`,
          '',
        ),
        fields: pageTxs.map(tx => {
          const decimals = COIN_DECIMALS[tx.coin] ?? 6;
          return {
            name: `${tx.type === 'buy' ? '🟢 Bought' : '🔴 Sold'} ${formatCoinAmount(tx.amount, decimals)} ${COIN_SYMBOLS[tx.coin] ?? tx.coin.toUpperCase()} @ ${formatUSD(tx.price)}`,
            value: `USD: ${formatUSD(tx.usd)}\nTime: ${new Date(tx.timestamp).toLocaleString()}`
          };
        })
      };
    }


    // Helper to send the embed with navigation buttons
    async function sendPage(pageIdx, interactionOrComponent) {
      const { embed, fields } = getPageEmbed(pageIdx);
      embed.fields = fields;
      const components = totalPages > 1 ? [
        createButtonRow([
          createButton('Prev', 'tx_prev', 1, pageIdx === 0),
          createButton('Next', 'tx_next', 1, pageIdx === totalPages - 1)
        ])
      ] : [];
      await replyWithEmbed(interactionOrComponent, embed, false, components);
    }

    await sendPage(page, interaction);

    if (totalPages > 1) {
      const filter = i => i.user.id === interaction.user.id && (i.customId === 'tx_prev' || i.customId === 'tx_next');
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
      collector.on('collect', async i => {
        if (i.customId === 'tx_prev' && page > 0) page--;
        if (i.customId === 'tx_next' && page < totalPages - 1) page++;
        await sendPage(page, i);
      });
    }
  }
};
