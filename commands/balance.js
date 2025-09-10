
import fs from 'fs';
import path from 'path';
const USER_INFO_PATH = path.resolve('./user_info.json');
let userInfoObj = {};
try {
  if (fs.existsSync(USER_INFO_PATH)) {
    userInfoObj = JSON.parse(fs.readFileSync(USER_INFO_PATH, 'utf8'));
  }
} catch (e) {
  userInfoObj = {};
}
function saveUserInfo() {
  fs.writeFileSync(USER_INFO_PATH, JSON.stringify(userInfoObj, null, 2));
}

export default {
  name: 'balance',
  description: 'Check your balance',
  async execute(interaction) {
    const userId = interaction.user.id;
    if (!userInfoObj[userId]) {
      userInfoObj[userId] = { balance: 1000, holdings: {} };
      saveUserInfo();
    }
    await interaction.reply(`Your balance: $${Number(userInfoObj[userId].balance).toFixed(2)} USD`);
  },
  // Helper for other commands
  getBalance(userId) {
    return userInfoObj[userId]?.balance ?? 0;
  },
  addBalance(userId, amount) {
    if (!userInfoObj[userId]) userInfoObj[userId] = { balance: 1000, holdings: {} };
    userInfoObj[userId].balance += amount;
    saveUserInfo();
  },
  subtractBalance(userId, amount) {
    if (!userInfoObj[userId]) userInfoObj[userId] = { balance: 1000, holdings: {} };
    userInfoObj[userId].balance -= amount;
    saveUserInfo();
  },
  getHoldings(userId) {
    return userInfoObj[userId]?.holdings ?? {};
  },
  addHoldings(userId, coinId, amount) {
    if (!userInfoObj[userId]) userInfoObj[userId] = { balance: 1000, holdings: {} };
    userInfoObj[userId].holdings[coinId] = (userInfoObj[userId].holdings[coinId] || 0) + amount;
    saveUserInfo();
  }
};
