import fetch from 'node-fetch';
import balance from './balance.js';
import fs from 'fs';
import path from 'path';
import { COINS, COIN_DECIMALS, COIN_SYMBOLS } from '../coin_constants.js';
import { EMBED_COLOUR, SUCCESS_COLOUR, ERROR_COLOUR, BUY_COLOUR } from '../utils.js';

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
    if (!coin) return interaction.reply({
      embeds: [{
        title: 'Error',
        description: 'Coin not found.',
        color: ERROR_COLOUR
      }],
      flags: 64
    });

    // If user specified coin_amount, calculate USD and ask for confirmation
    if (coinAmountInput && coinAmountInput > 0) {
      const decimals = COIN_DECIMALS[coin.id] ?? 6;
      // Validate decimal places
      const coinAmountStr = coinAmountInput.toString();
      const dp = coinAmountStr.includes('.') ? coinAmountStr.split('.')[1].length : 0;
      if (dp > decimals) {
        return interaction.reply({
          embeds: [{
            title: 'Error',
            description: `${coin.name} only supports up to ${decimals} decimal places. You entered ${dp}.`,
            color: ERROR_COLOUR
          }],
          flags: 64
        });
      }
      const usdCost = coinAmountInput * coin.current_price;
      if (usdCost < 0.01) {
        const coinPerUsd = 1 / coin.current_price;
        const minCoin = 0.01 / coin.current_price;
        return interaction.reply({
          embeds: [{
            title: 'Error',
            description: `Transaction amount too small. Minimum purchase is $0.01 USD.\n\n1 ${COIN_SYMBOLS[coin.id]} = $${coin.current_price} USD\n$0.01 USD = ${minCoin.toFixed(decimals)} ${COIN_SYMBOLS[coin.id]}`,
            color: ERROR_COLOUR
          }],
          flags: 64
        });
      }
      // Always show conversion and ask for confirmation, check funds on confirm
      await interaction.reply({
        embeds: [{
          title: `Confirm Purchase`,
          description: `Buy **${coinAmountInput.toFixed(decimals)} ${COIN_SYMBOLS[coin.id]}** for **$${usdCost.toFixed(2)} USD**?`,
          color: EMBED_COLOUR,
          footer: { text: `Current price: $${coin.current_price} per ${COIN_SYMBOLS[coin.id]}` }
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
              await i.update({
                embeds: [{
                  title: 'Error',
                  description: `You don't have enough funds.`,
                  color: ERROR_COLOUR
                }],
                components: [],
                flags: 64
              });
              return;
            }
            // Subtract balance first, only add holdings if successful
            const balanceResult = balance.subtractBalance(userId, usdCost);
            if (balanceResult === false) {
              await i.update({
                embeds: [{
                  title: 'Error',
                  description: `Failed to subtract balance. Please try again.`,
                  color: ERROR_COLOUR
                }],
                components: [],
                flags: 64
              });
              return;
            }
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
            await i.update({
              embeds: [{
                title: 'Success',
                description: 'Purchase successful!',
                color: SUCCESS_COLOUR
              }],
              components: [],
              flags: 64
            });
            await i.followUp({
              embeds: [{
                title: 'Purchase',
                description: `${i.user} bought ${coinAmountInput.toFixed(decimals)} ${COIN_SYMBOLS[coin.id]} for $${usdCost.toFixed(2)} USD!`,
                color: BUY_COLOUR
              }],
              flags: 0
            });
          } else {
            await i.update({
              embeds: [{
                title: 'Cancelled',
                description: 'Purchase cancelled.',
                color: ERROR_COLOUR
              }],
              components: [],
              flags: 64
            });
          }
        } catch (e) {
          await i.update({
            embeds: [{
              title: 'Error',
              description: `Error checking funds. Please try again`,
              color: ERROR_COLOUR
            }],
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
      // Validate decimal places
      const coinAmountStr = coinAmount.toString();
      const dp = coinAmountStr.includes('.') ? coinAmountStr.split('.')[1].length : 0;
      if (dp > decimals) {
        return interaction.reply({
          embeds: [{
            title: 'Error',
            description: `${coin.name} only supports up to ${decimals} decimal places for coin amount.`,
            color: ERROR_COLOUR
          }],
          ephemeral: true
        });
      }
      await interaction.reply({
        embeds: [{
          title: `Confirm Purchase`,
          description: `Buy **${coinAmount.toFixed(decimals)} ${COIN_SYMBOLS[coin.id]}** for **$${usdAmount.toFixed(2)} USD**?`,
          color: WARNING_COLOUR,
          footer: { text: `Current price: $${coin.current_price} per ${COIN_SYMBOLS[coin.id]}` }
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
              await i.update({
                embeds: [{
                  title: 'Error',
                  description: `You don't have enough funds.`,
                  color: ERROR_COLOUR
                }],
                components: [],
                flags: 64
              });
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
            await i.update({
              embeds: [{
                title: 'Success',
                description: 'Purchase successful!',
                color: SUCCESS_COLOUR
              }],
              components: [],
              flags: 64
            });
            await i.followUp({
              embeds: [{
                title: 'Purchase',
                description: `${i.user} bought ${coinAmount.toFixed(decimals)} ${COIN_SYMBOLS[coin.id]} for $${usdAmount.toFixed(2)} USD!`,
                color: BUY_COLOUR
              }],
              flags: 0
            });
          } else {
            await i.update({
              embeds: [{
                title: 'Cancelled',
                description: 'Purchase cancelled.',
                color: SUCCESS_COLOUR
              }],
              components: [],
              flags: 64
            });
          }
        } catch (e) {
          await i.update({
            embeds: [{
              title: 'Error',
              description: 'Error checking funds. Please try again.',
              color: ERROR_COLOUR
            }],
            components: [],
            flags: 64
          });
        }
      });
      return;
    }

    // If neither amount is valid
    return interaction.reply({
      embeds: [{
        title: 'Error',
        description: 'Amount must be positive.',
        color: ERROR_COLOUR
      }],
      ephemeral: true
    });
  },
  // Helper for inventory (now proxied to balance.js)
  getHoldings(userId) {
    return balance.getHoldings(userId);
  }
};
