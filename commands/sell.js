
import fetch from 'node-fetch';
import balance from './balance.js';
import path from 'path';
import { COINS, COIN_DECIMALS, COIN_SYMBOLS } from '../coin_constants.js';
import {
  EMBED_COLOUR, ERROR_COLOUR, SELL_COLOUR, SUCCESS_COLOUR,
  createErrorEmbed, createSuccessEmbed, createInfoEmbed, replyWithEmbed,
  formatUSD, formatCoinAmount, readJson, writeJson, createButton, createButtonRow
} from '../utils.js';

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
  if (coinAmount <= 0) return await replyWithEmbed(interaction, createErrorEmbed('Amount must be positive.'), true);
    const coins = await getCoinData();
    const coin = coins.find(c => c.id === coinId);
  if (!coin) return await replyWithEmbed(interaction, createErrorEmbed('Coin not found.'), true);
    const holdings = balance.getHoldings(userId);
    if (!holdings[coinId] || holdings[coinId] < coinAmount) {
      return await replyWithEmbed(interaction, createErrorEmbed(`You don't have enough ${COIN_SYMBOLS[coin.id]} to sell.`), true);
    }
    const decimals = COIN_DECIMALS[coin.id] ?? 6;
    // Validate decimal places
    const coinAmountStr = coinAmount.toString();
    const dp = coinAmountStr.includes('.') ? coinAmountStr.split('.')[1].length : 0;
    if (dp > decimals) {
      return await replyWithEmbed(interaction, createErrorEmbed(`${coin.name} only supports up to ${decimals} decimal places. You entered ${dp}.`), true);
    }
    const usdValue = coinAmount * coin.current_price;
    if (usdValue < 0.01) {
      const minCoin = 0.01 / coin.current_price;
      return await replyWithEmbed(
        interaction,
        createErrorEmbed(
          `Transaction amount too small. Minimum sale is $0.01 USD.\n\n1 ${COIN_SYMBOLS[coin.id]} = $${coin.current_price} USD\n$0.01 USD = ${formatCoinAmount(minCoin, decimals)} ${COIN_SYMBOLS[coin.id]}`
        ),
        true
      );
    }
    // Confirm sell
    await replyWithEmbed(
      interaction,
      createInfoEmbed(
        'Confirm Sale',
        `Sell **${formatCoinAmount(coinAmount, decimals)} ${COIN_SYMBOLS[coin.id]}** for **${formatUSD(usdValue)}**?\n\nCurrent price: ${formatUSD(coin.current_price)} per ${COIN_SYMBOLS[coin.id]}`,
        EMBED_COLOUR
      ),
      true,
      [createButtonRow([
        createButton('Confirm', 'sell_confirm', 3),
        createButton('Cancel', 'sell_cancel', 4)
      ])]
    );
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
        let txs = readJson(TX_PATH);
        if (!Array.isArray(txs)) txs = [];
        txs.push({
          userId,
          type: 'sell',
          coin: coinId,
          amount: coinAmount,
          price: coin.current_price,
          usd: usdValue,
          timestamp: Date.now()
        });
        writeJson(TX_PATH, txs);
        await i.update({
          embeds: [createSuccessEmbed('Sale successful!')],
          components: [],
          flags: 64
        });
        await i.followUp({
          embeds: [createInfoEmbed('Sale', `${i.user} sold ${formatCoinAmount(coinAmount, decimals)} ${COIN_SYMBOLS[coin.id]} for ${formatUSD(usdValue)}!`, SELL_COLOUR)],
          flags: 0
        });
      } else {
        await i.update({
          embeds: [createErrorEmbed('Sale cancelled.')],
          components: [],
          flags: 64
        });
      }
    });
  }
};
