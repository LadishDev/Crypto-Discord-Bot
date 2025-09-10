

import fs from 'fs';
import path from 'path';
import { formatUSD, createInfoEmbed, replyWithEmbed } from '../utils.js';
const USER_INFO_PATH = path.resolve('./user_info.json');

function readUserInfo() {
  if (!fs.existsSync(USER_INFO_PATH)) return {};
  return JSON.parse(fs.readFileSync(USER_INFO_PATH, 'utf8'));
}
function writeUserInfo(obj) {
  fs.writeFileSync(USER_INFO_PATH, JSON.stringify(obj, null, 2));
}

export default {
  name: 'balance',
  description: 'Check your balance',
  async execute(interaction) {
    const userId = interaction.user.id;
    let userInfoObj = readUserInfo();
    if (!userInfoObj[userId]) {
      userInfoObj[userId] = { balance: 1000, holdings: {} };
      writeUserInfo(userInfoObj);
    }
    const bal = Number(userInfoObj[userId].balance);
    await replyWithEmbed(
      interaction,
      createInfoEmbed('Your Balance', `${formatUSD(bal)}`),
      false
    );
  },
  // Helper for other commands
  getBalance(userId) {
    const userInfoObj = readUserInfo();
    return userInfoObj[userId]?.balance ?? 0;
  },
  addBalance(userId, amount) {
    const userInfoObj = readUserInfo();
    if (!userInfoObj[userId]) userInfoObj[userId] = { balance: 1000, holdings: {} };
    userInfoObj[userId].balance += amount;
    writeUserInfo(userInfoObj);
  },
  subtractBalance(userId, amount) {
    const userInfoObj = readUserInfo();
    if (!userInfoObj[userId]) userInfoObj[userId] = { balance: 1000, holdings: {} };
    userInfoObj[userId].balance -= amount;
    writeUserInfo(userInfoObj);
  },
  getHoldings(userId) {
    const userInfoObj = readUserInfo();
    return userInfoObj[userId]?.holdings ?? {};
  },
  addHoldings(userId, coinId, amount) {
    const userInfoObj = readUserInfo();
    if (!userInfoObj[userId]) userInfoObj[userId] = { balance: 1000, holdings: {} };
    userInfoObj[userId].holdings[coinId] = (userInfoObj[userId].holdings[coinId] || 0) + amount;
    writeUserInfo(userInfoObj);
  }
};
