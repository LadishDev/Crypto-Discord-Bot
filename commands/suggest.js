
import { SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const GUILD_ID = process.env.GUILD_ID;
const SUGGESTION_CHANNEL_ID = process.env.SUGGESTION_CHANNEL_ID;

// In-memory cooldown to prevent spam (per user, 5 minutes)
const cooldowns = new Map();

// Blocked words/phrases (expand as needed)
const blockedWords = [
    'troll', 'spam', 'badword', 'idiot', 'stupid', 'kill', 'hate', 'racist', 'nazi', 'sex', 'nsfw', 'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'fag', 'retard', 'dumb', 'kys', 'suicide', 'die', 'asshole', 'dox', 'doxx', 'discord.gg/'
];

function isSpamOrTroll(suggestion) {
    // Too short
    if (suggestion.length < 10) return 'Please provide a more detailed suggestion (at least 10 characters).';
    // Too long
    if (suggestion.length > 500) return 'Suggestion is too long (max 500 characters).';
    // Blocked words
    const lower = suggestion.toLowerCase();
    if (blockedWords.some(word => lower.includes(word))) return 'Your suggestion contains inappropriate or banned content.';
    // Repeated characters (e.g. aaaaaaaa)
    if (/(.)\1{7,}/.test(suggestion)) return 'No spam or repeated characters.';
    // Repeated words (e.g. "hi hi hi hi hi")
    if (/\b(\w+)\b(?:\s+\1\b){4,}/i.test(suggestion)) return 'No spam or repeated words.';
    // Looks like a URL
    if (/https?:\/\//.test(suggestion)) return 'No links allowed.';
    // Only emojis or gibberish
    if (/^([\p{Emoji}\s]+)$/u.test(suggestion)) return 'No emoji/gibberish suggestions.';
    // All caps
    if (suggestion === suggestion.toUpperCase() && suggestion.length > 15) return 'No all-caps spam.';
    return null;
}

export default {
    name: 'suggest',
    description: 'Submit a suggestion for the server!',
    options: [
        {
            name: 'suggestion',
            type: 3, // STRING
            description: 'Your suggestion (Min 10 characters, Max 500 characters)',
            required: true
        }
    ],
    async execute(interaction) {
        if (interaction.guildId !== GUILD_ID) {
            return interaction.reply({ content: 'This command can only be used in the main server.', flags: 64 });
        }
        const suggestion = interaction.options.getString('suggestion').trim();
        // Spam/troll filter
        const filterMsg = isSpamOrTroll(suggestion);
            if (filterMsg) {
                return interaction.reply({ content: filterMsg, flags: 64 });
            }
        // Cooldown check (5 minutes)
        const userId = interaction.user.id;
        const now = Date.now();
            if (cooldowns.has(userId) && now - cooldowns.get(userId) < 5 * 60 * 1000) {
                return interaction.reply({ content: 'You can only submit a suggestion every 5 minutes.', flags: 64 });
            }
        cooldowns.set(userId, now);
        // Post suggestion to the suggestion channel
        let channel;
        try {
            channel = await interaction.client.channels.fetch(SUGGESTION_CHANNEL_ID);
        } catch {
            channel = null;
        }
            if (!channel) {
                return interaction.reply({ content: 'Suggestion channel not found.', flags: 64 });
            }
            const msg = await channel.send({
                embeds: [{
                    title: 'New Suggestion',
                    description: suggestion,
                    color: 0x00FF99,
                    footer: { text: `From: ${interaction.user.tag}` },
                    timestamp: new Date()
                }]
            });
            // Add up and down arrow reactions
            try {
                await msg.react('⬆️');
                await msg.react('⬇️');
            } catch {}
            await interaction.reply({ content: 'Thank you for your suggestion!', flags: 64 });
    }
};