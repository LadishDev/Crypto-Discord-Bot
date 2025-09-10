import fetch from 'node-fetch';
import balance from './balance.js';
import path from 'path';
import { COINS, COIN_DECIMALS, COIN_SYMBOLS } from '../coin_constants.js';
import {
  EMBED_COLOUR, SUCCESS_COLOUR, ERROR_COLOUR, BUY_COLOUR, WARNING_COLOUR,
  createErrorEmbed, createSuccessEmbed, createInfoEmbed, replyWithEmbed,
  formatUSD, formatCoinAmount, readJson, writeJson, createButton, createButtonRow
} from '../utils.js';

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
    if (!coin) return await replyWithEmbed(interaction, createErrorEmbed('Coin not found.'));

    // If user specified coin_amount, calculate USD and ask for confirmation
    if (coinAmountInput && coinAmountInput > 0) {
      const decimals = COIN_DECIMALS[coin.id] ?? 6;
      const coinAmountStr = coinAmountInput.toString();
      const dp = coinAmountStr.includes('.') ? coinAmountStr.split('.')[1].length : 0;
      if (dp > decimals) {
        return await replyWithEmbed(interaction, createErrorEmbed(`${coin.name} only supports up to ${decimals} decimal places. You entered ${dp}.`));
      }
      const usdCost = coinAmountInput * coin.current_price;
      if (usdCost < 0.01) {
        const minCoin = 0.01 / coin.current_price;
        return await replyWithEmbed(
          interaction,
          createErrorEmbed(
            `Transaction amount too small. Minimum purchase is $0.01 USD.\n\n1 ${COIN_SYMBOLS[coin.id]} = $${coin.current_price} USD\n$0.01 USD = ${formatCoinAmount(minCoin, decimals)} ${COIN_SYMBOLS[coin.id]}`
          )
        );
      }
      await replyWithEmbed(
        interaction,
        createInfoEmbed(
          'Confirm Purchase',
          `Buy **${formatCoinAmount(coinAmountInput, decimals)} ${COIN_SYMBOLS[coin.id]}** for **${formatUSD(usdCost)}**?`,
          WARNING_COLOUR
        ),
        true,
        [createButtonRow([
          createButton('Confirm', 'buy_confirm', 3),
          createButton('Cancel', 'buy_cancel', 4)
        ])]
      );
      const filter = i => i.user.id === userId && (i.customId === 'buy_confirm' || i.customId === 'buy_cancel');
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
      collector.on('collect', async i => {
        try {
          const USER_INFO_PATH = path.resolve('./user_info.json');
          const userInfoObj = readJson(USER_INFO_PATH);
          const freshBalance = userInfoObj[userId]?.balance ?? 0;
          if (i.customId === 'buy_confirm') {
            if (freshBalance < usdCost) {
              await i.update({
                embeds: [createErrorEmbed(`You don't have enough funds.`)],
                components: [],
                flags: 64
              });
              return;
            }
            const balanceResult = balance.subtractBalance(userId, usdCost);
            if (balanceResult === false) {
              await i.update({
                embeds: [createErrorEmbed(`Failed to subtract balance. Please try again.`)],
                components: [],
                flags: 64
              });
              return;
            }
            balance.addHoldings(userId, coinId, coinAmountInput);
            const TX_PATH = path.resolve('./transactions.json');
            let txs = readJson(TX_PATH);
            if (!Array.isArray(txs)) txs = [];
            txs.push({
              userId,
              type: 'buy',
              coin: coinId,
              amount: coinAmountInput,
              price: coin.current_price,
              usd: usdCost,
              timestamp: Date.now()
            });
            writeJson(TX_PATH, txs);
            await i.update({
              embeds: [createSuccessEmbed('Purchase successful!')],
              components: [],
              flags: 64
            });
            await i.followUp({
              embeds: [createInfoEmbed('Purchase', `${i.user} bought ${formatCoinAmount(coinAmountInput, decimals)} ${COIN_SYMBOLS[coin.id]} for ${formatUSD(usdCost)}!`, BUY_COLOUR)],
              flags: 0
            });
          } else {
            await i.update({
              embeds: [createErrorEmbed('Purchase cancelled.')],
              components: [],
              flags: 64
            });
          }
        } catch (e) {
          await i.update({
            embeds: [createErrorEmbed('Error checking funds. Please try again')],
            components: [],
            flags: 64
          });
        }
      });
      return;
    }

    // If user specified USD amount, calculate coin amount and ask for confirmation
    if (usdAmount && usdAmount > 0) {
      const coinAmount = usdAmount / coin.current_price;
      const decimals = COIN_DECIMALS[coin.id] ?? 6;
      if (usdAmount < 0.01) {
        const minUsd = 0.01;
        return await replyWithEmbed(
          interaction,
          createErrorEmbed(
            `Transaction amount too small. Minimum purchase is $0.01 USD.`
          )
        );
      }
      await replyWithEmbed(
        interaction,
        createInfoEmbed(
          'Confirm Purchase',
          `Buy **${formatCoinAmount(coinAmount, decimals)} ${COIN_SYMBOLS[coin.id]}** for **${formatUSD(usdAmount)}**?`,
          WARNING_COLOUR
        ),
        true,
        [createButtonRow([
          createButton('Confirm', 'buy_confirm_usd', 3),
          createButton('Cancel', 'buy_cancel_usd', 4)
        ])]
      );
      const filter = i => i.user.id === userId && (i.customId === 'buy_confirm_usd' || i.customId === 'buy_cancel_usd');
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
      collector.on('collect', async i => {
        try {
          const USER_INFO_PATH = path.resolve('./user_info.json');
          const userInfoObj = readJson(USER_INFO_PATH);
          const freshBalance = userInfoObj[userId]?.balance ?? 0;
          if (i.customId === 'buy_confirm_usd') {
            if (freshBalance < usdAmount) {
              await i.update({
                embeds: [createErrorEmbed(`You don't have enough funds.`)],
                components: [],
                flags: 64
              });
              return;
            }
            balance.subtractBalance(userId, usdAmount);
            balance.addHoldings(userId, coinId, coinAmount);
            const TX_PATH = path.resolve('./transactions.json');
            let txs = readJson(TX_PATH);
            if (!Array.isArray(txs)) txs = [];
            txs.push({
              userId,
              type: 'buy',
              coin: coinId,
              amount: coinAmount,
              price: coin.current_price,
              usd: usdAmount,
              timestamp: Date.now()
            });
            writeJson(TX_PATH, txs);
            await i.update({
              embeds: [createSuccessEmbed('Purchase successful!')],
              components: [],
              flags: 64
            });
            await i.followUp({
              embeds: [createInfoEmbed('Purchase', `${i.user} bought ${formatCoinAmount(coinAmount, decimals)} ${COIN_SYMBOLS[coin.id]} for ${formatUSD(usdAmount)}!`, BUY_COLOUR)],
              flags: 0
            });
          } else {
            await i.update({
              embeds: [createSuccessEmbed('Purchase cancelled.')],
              components: [],
              flags: 64
            });
          }
        } catch (e) {
          await i.update({
            embeds: [createErrorEmbed('Error checking funds. Please try again.')],
            components: [],
            flags: 64
          });
        }
      });
      return;
    }

    // If neither amount is valid
    return await replyWithEmbed(interaction, createErrorEmbed('Amount must be positive.'));
  },
};
