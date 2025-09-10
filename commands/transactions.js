
import fs from 'fs';
import path from 'path';
const TRANSACTIONS_PATH = path.resolve('./transactions.json');
function getTransactions(userId) {
  if (!fs.existsSync(TRANSACTIONS_PATH)) return [];
  const all = JSON.parse(fs.readFileSync(TRANSACTIONS_PATH, 'utf8'));
  return all.filter(tx => tx.userId === userId);
}

export default {
  name: 'transactions',
  description: 'List your recent crypto transactions',
  async execute(interaction) {
    const userId = interaction.user.id;
    const txs = getTransactions(userId).sort((a, b) => b.timestamp - a.timestamp);
    if (!txs.length) {
      await interaction.reply('You have no transactions.');
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
        embeds: [{
          title: `Your Transactions (Page ${pageIdx + 1}/${totalPages})`,
          color: 0x0099ff,
          fields: pageTxs.map(tx => ({
            name: `${tx.type === 'buy' ? '🟢 Bought' : '🔴 Sold'} ${tx.amount} ${tx.coin.toUpperCase()} @ $${tx.price.toFixed(2)}`,
            value: `USD: $${tx.usd.toFixed(2)}\nTime: ${new Date(tx.timestamp).toLocaleString()}`
          }))
        }],
        components: totalPages > 1 ? [{
          type: 1,
          components: [
            {
              type: 2,
              label: 'Prev',
              style: 1,
              custom_id: 'tx_prev',
              disabled: pageIdx === 0
            },
            {
              type: 2,
              label: 'Next',
              style: 1,
              custom_id: 'tx_next',
              disabled: pageIdx === totalPages - 1
            }
          ]
        }] : []
      };
    }

    await interaction.reply(getPageEmbed(page));

    if (totalPages > 1) {
      const filter = i => i.user.id === interaction.user.id && (i.customId === 'tx_prev' || i.customId === 'tx_next');
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
      collector.on('collect', async i => {
        if (i.customId === 'tx_prev' && page > 0) page--;
        if (i.customId === 'tx_next' && page < totalPages - 1) page++;
        await i.update(getPageEmbed(page));
      });
    }
  }
};
