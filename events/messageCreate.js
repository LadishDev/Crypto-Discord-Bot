import { readJson, writeJson } from '../utils.js';
import path from 'path';

const USER_INFO_PATH = path.resolve('./user_info.json');
const COOLDOWN_SECONDS = 60; // 1 minute cooldown per user
const REWARD_AMOUNT = 1; // USD per message

// In-memory cooldown tracker
const cooldowns = new Map();

export default {
  name: 'messageCreate',
  async execute(message) {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;
    const userId = message.author.id;
    const now = Date.now();
    if (cooldowns.has(userId) && now - cooldowns.get(userId) < COOLDOWN_SECONDS * 1000) return;
    cooldowns.set(userId, now);

    // Read and update user_info.json
    let userInfo = readJson(USER_INFO_PATH);
    if (!userInfo[userId]) userInfo[userId] = { balance: 1000, holdings: {} };
    userInfo[userId].balance += REWARD_AMOUNT;
    writeJson(USER_INFO_PATH, userInfo);
  }
};
