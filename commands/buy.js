import fetch from 'node-fetch';
import balance from './balance.js';
import fs from 'fs';
import path from 'path';

const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
];

async function getCoinData() {
  const ids = COINS.map(c => c.id).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`;
  const res = await fetch(url);
  return await res.json();
}

// Holdings are now stored in user_info.json via balance.js

export default {
  name: 'buy',
  description: 'Invest in a crypto coin with your balance',
  options: [
    {
      name: 'coin',
      type: 3, // STRING
      description: 'The coin to invest in',
      required: true,
      choices: COINS.map(c => ({ name: c.name, value: c.id }))
    },
    {
      name: 'amount',
      type: 10, // NUMBER
      description: 'Amount in USD to invest',
      required: false
    },
    {
      name: 'coin_amount',
      type: 10, // NUMBER
      description: 'Amount of coin to buy (e.g. 0.01)',
      required: false
    }
  ],
  async execute(interaction) {
    const userId = interaction.user.id;
    const coinId = interaction.options.getString('coin');
    const usdAmount = interaction.options.getNumber('amount');
    const coinAmountInput = interaction.options.getNumber('coin_amount');
    const coins = await getCoinData();
    const coin = coins.find(c => c.id === coinId);
    if (!coin) return interaction.reply({ content: 'Coin not found.', ephemeral: true });

    // If user specified coin_amount, calculate USD and ask for confirmation
    if (coinAmountInput && coinAmountInput > 0) {
      const usdCost = coinAmountInput * coin.current_price;
      // Always show conversion and ask for confirmation, check funds on confirm
      await interaction.reply({
        embeds: [{
          title: `Confirm Purchase`,
          description: `Buy **${coinAmountInput} ${coin.symbol}** for **$${usdCost.toFixed(2)} USD**?`,
          color: 0x0099ff,
          footer: { text: `Current price: $${coin.current_price} per ${coin.symbol}` }
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 3, label: 'Confirm', custom_id: 'buy_confirm' },
            { type: 2, style: 4, label: 'Cancel', custom_id: 'buy_cancel' }
          ]
        }],
        flags: 64 // ephemeral
      });
      // Wait for button interaction
      const filter = i => i.user.id === userId && (i.customId === 'buy_confirm' || i.customId === 'buy_cancel');
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
      collector.on('collect', async i => {
        // Reload balances from disk before checking
        try {
          const USER_INFO_PATH = path.resolve('./user_info.json');
          let userInfoObj = {};
          if (fs.existsSync(USER_INFO_PATH)) {
            userInfoObj = JSON.parse(fs.readFileSync(USER_INFO_PATH, 'utf8'));
          }
          const freshBalance = userInfoObj[userId]?.balance ?? 0;
          if (i.customId === 'buy_confirm') {
            if (freshBalance < usdCost) {
              await i.update({ content: `You don't have enough funds.`, embeds: [], components: [], flags: 64 });
              return;
            }
            balance.subtractBalance(userId, usdCost);
            balance.addHoldings(userId, coinId, coinAmountInput);
            // Log transaction
            const TX_PATH = path.resolve('./transactions.json');
            let txs = [];
            if (fs.existsSync(TX_PATH)) txs = JSON.parse(fs.readFileSync(TX_PATH, 'utf8'));
            txs.push({
              userId,
              type: 'buy',
              coin: coinId,
              amount: coinAmountInput,
              price: coin.current_price,
              usd: usdCost,
              timestamp: Date.now()
            });
            fs.writeFileSync(TX_PATH, JSON.stringify(txs, null, 2));
            await i.update({ content: `Purchase successful!`, embeds: [], components: [], flags: 64 });
            await i.followUp({ content: `${i.user} bought ${coinAmountInput} ${coin.symbol} for $${usdCost.toFixed(2)} USD!`, flags: 0 });
          } else {
            await i.update({ content: 'Purchase cancelled.', embeds: [], components: [], flags: 64 });
          }
        } catch (e) {
          await i.update({ content: 'Error checking funds. Please try again.', embeds: [], components: [], flags: 64 });
        }
      });
      return;
    }

    // If user specified USD amount, calculate coin amount and ask for confirmation
    if (usdAmount && usdAmount > 0) {
      const coinAmount = usdAmount / coin.current_price;
      await interaction.reply({
        embeds: [{
          title: `Confirm Purchase`,
          description: `Buy **${coinAmount.toFixed(6)} ${coin.symbol}** for **$${usdAmount.toFixed(2)} USD**?`,
          color: 0x0099ff,
          footer: { text: `Current price: $${coin.current_price} per ${coin.symbol}` }
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 3, label: 'Confirm', custom_id: 'buy_confirm_usd' },
            { type: 2, style: 4, label: 'Cancel', custom_id: 'buy_cancel_usd' }
          ]
        }],
        flags: 64 // ephemeral
      });
      // Wait for button interaction
      const filter = i => i.user.id === userId && (i.customId === 'buy_confirm_usd' || i.customId === 'buy_cancel_usd');
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
      collector.on('collect', async i => {
        // Reload balances from disk before checking
        try {
          const USER_INFO_PATH = path.resolve('./user_info.json');
          let userInfoObj = {};
          if (fs.existsSync(USER_INFO_PATH)) {
            userInfoObj = JSON.parse(fs.readFileSync(USER_INFO_PATH, 'utf8'));
          }
          const freshBalance = userInfoObj[userId]?.balance ?? 0;
          if (i.customId === 'buy_confirm_usd') {
            if (freshBalance < usdAmount) {
              await i.update({ content: `You don't have enough funds.`, embeds: [], components: [], flags: 64 });
              return;
            }
            balance.subtractBalance(userId, usdAmount);
            balance.addHoldings(userId, coinId, coinAmount);
            // Log transaction
            const TX_PATH = path.resolve('./transactions.json');
            let txs = [];
            if (fs.existsSync(TX_PATH)) txs = JSON.parse(fs.readFileSync(TX_PATH, 'utf8'));
            txs.push({
              userId,
              type: 'buy',
              coin: coinId,
              amount: coinAmount,
              price: coin.current_price,
              usd: usdAmount,
              timestamp: Date.now()
            });
            fs.writeFileSync(TX_PATH, JSON.stringify(txs, null, 2));
            await i.update({ content: `Purchase successful!`, embeds: [], components: [], flags: 64 });
            await i.followUp({ content: `${i.user} bought ${coinAmount.toFixed(6)} ${coin.symbol} for $${usdAmount.toFixed(2)} USD!`, flags: 0 });
          } else {
            await i.update({ content: 'Purchase cancelled.', embeds: [], components: [], flags: 64 });
          }
        } catch (e) {
          await i.update({ content: 'Error checking funds. Please try again.', embeds: [], components: [], flags: 64 });
        }
      });
      return;
    }

    // If neither amount is valid
    return interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
  },
  // Helper for inventory (now proxied to balance.js)
  getHoldings(userId) {
    return balance.getHoldings(userId);
  }
};
