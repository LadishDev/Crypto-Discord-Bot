import balance from './balance.js';
import fetch from 'node-fetch';

const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
];

async function getCoinData() {
  const ids = COINS.map(c => c.id).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1h,24h,7d`;
  const res = await fetch(url);
  return await res.json();
}

export default {
  name: 'inventory',
  description: 'Check your crypto investments',
  async execute(interaction) {
    const userId = interaction.user.id;
  const holdings = balance.getHoldings(userId);
    if (!Object.keys(holdings).length) {
      await interaction.reply('Your inventory is empty.');
      return;
    }
    const coins = await getCoinData();
    let msg = '**Your Investments:**\n';
    for (const coin of coins) {
      const amount = holdings[coin.id] || 0;
      if (amount > 0) {
        const value = amount * coin.current_price;
        const upDown = coin.price_change_percentage_24h > 0 ? '📈' : '📉';
        msg += `\n__${coin.name} (${coin.symbol.toUpperCase()})__\n`;
        msg += `Amount: ${amount.toFixed(6)}\n`;
        msg += `Current Value: $${value.toFixed(2)} USD ${upDown}\n`;
        msg += `1h: ${coin.price_change_percentage_1h_in_currency?.toFixed(2) ?? 'N/A'}% | 24h: ${coin.price_change_percentage_24h?.toFixed(2) ?? 'N/A'}% | 7d: ${coin.price_change_percentage_7d_in_currency?.toFixed(2) ?? 'N/A'}%\n`;
      }
    }
  await interaction.reply({ content: msg });
  }
};
