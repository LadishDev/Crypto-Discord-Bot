import fetch from 'node-fetch';
import balance from './balance.js';
import fs from 'fs';
import path from 'path';
import { COINS, COIN_DECIMALS, COIN_SYMBOLS } from '../coin_constants.js';
import { EMBED_COLOUR, ERROR_COLOUR, SELL_COLOUR, SUCCESS_COLOUR } from '../utils.js';

async function getCoinData() {
  const ids = COINS.map(c => c.id).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`;
  const res = await fetch(url);
  return await res.json();
}

export default {
  name: 'sell',
  description: 'Sell a crypto coin for USD',
  options: [
    {
      name: 'coin',
      type: 3, // STRING
      description: 'The coin to sell',
      required: true,
  choices: COINS.map(c => ({ name: c.name, value: c.id }))
    },
    {
      name: 'amount',
      type: 10, // NUMBER
      description: 'Amount of coin to sell (e.g. 0.01)',
      required: true
    }
  ],
  async execute(interaction) {
    const userId = interaction.user.id;
    const coinId = interaction.options.getString('coin');
    const coinAmount = interaction.options.getNumber('amount');
    if (coinAmount <= 0) return interaction.reply({
      embeds: [{
        title: 'Error',
        description: 'Amount must be positive.',
        color: ERROR_COLOUR
      }],
      ephemeral: true
    });
    const coins = await getCoinData();
    const coin = coins.find(c => c.id === coinId);
    if (!coin) return interaction.reply({
      embeds: [{
        title: 'Error',
        description: 'Coin not found.',
        color: ERROR_COLOUR
      }],
      ephemeral: true
    });
    const holdings = balance.getHoldings(userId);
    if (!holdings[coinId] || holdings[coinId] < coinAmount) {
      return interaction.reply({
        embeds: [{
          title: 'Error',
          description: `You don't have enough ${COIN_SYMBOLS[coin.id]} to sell.`,
          color: ERROR_COLOUR
        }],
        ephemeral: true
      });
    }
    const decimals = COIN_DECIMALS[coin.id] ?? 6;
    // Validate decimal places
    const coinAmountStr = coinAmount.toString();
    const dp = coinAmountStr.includes('.') ? coinAmountStr.split('.')[1].length : 0;
    if (dp > decimals) {
      return interaction.reply({
        embeds: [{
          title: 'Error',
          description: `${coin.name} only supports up to ${decimals} decimal places. You entered ${dp}.`,
          color: ERROR_COLOUR
        }],
        ephemeral: true
      });
    }
    const usdValue = coinAmount * coin.current_price;
    // Confirm sell
    await interaction.reply({
      embeds: [{
        title: `Confirm Sale`,
  description: `Sell **${coinAmount.toFixed(decimals)} ${COIN_SYMBOLS[coin.id]}** for **$${usdValue.toFixed(2)} USD**?`,
        color: EMBED_COLOUR,
  footer: { text: `Current price: $${coin.current_price} per ${COIN_SYMBOLS[coin.id]}` }
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 3, label: 'Confirm', custom_id: 'sell_confirm' },
          { type: 2, style: 4, label: 'Cancel', custom_id: 'sell_cancel' }
        ]
      }],
      flags: 64 // ephemeral
    });
    // Wait for button interaction
    const filter = i => i.user.id === userId && (i.customId === 'sell_confirm' || i.customId === 'sell_cancel');
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
    collector.on('collect', async i => {
      if (i.customId === 'sell_confirm') {
        // Update holdings and balance
        balance.addBalance(userId, usdValue);
        balance.addHoldings(userId, coinId, -coinAmount);
        // Log transaction
        const TX_PATH = path.resolve('./transactions.json');
        let txs = [];
        if (fs.existsSync(TX_PATH)) txs = JSON.parse(fs.readFileSync(TX_PATH, 'utf8'));
        txs.push({
          userId,
          type: 'sell',
          coin: coinId,
          amount: coinAmount,
          price: coin.current_price,
          usd: usdValue,
          timestamp: Date.now()
        });
        fs.writeFileSync(TX_PATH, JSON.stringify(txs, null, 2));
        await i.update({
          embeds: [{
            title: 'Success',
            description: 'Sale successful!',
            color: SUCCESS_COLOUR
          }],
          components: [],
          flags: 64
        });
        await i.followUp({
          embeds: [{
            title: 'Sale',
            description: `${i.user} sold ${coinAmount} ${COIN_SYMBOLS[coin.id]} for $${usdValue.toFixed(2)} USD!`,
            color: SELL_COLOUR
          }],
          flags: 0
        });
      } else {
        await i.update({
          embeds: [{
            title: 'Cancelled',
            description: 'Sale cancelled.',
            color: ERROR_COLOUR
          }],
          components: [],
          flags: 64
        });
      }
    });
  }
};
