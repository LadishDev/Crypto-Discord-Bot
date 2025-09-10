import fs from 'fs';

// utils.js - global style and utility constants

export const EMBED_COLOUR = 0x5865F2; // Discord blurple
export const SUCCESS_COLOUR = 0x57F287; // Discord green
export const ERROR_COLOUR = 0xED4245; // Discord red
export const WARNING_COLOUR = 0xFEE75C; // Discord yellow

export const SELL_COLOUR = 0xFAA61A; // Orange for sell actions
export const BUY_COLOUR = 0x57F287; // Green for buy actions

// --- Embed Helpers ---
export function createErrorEmbed(description) {
	return {
		title: 'Error',
		description,
		color: ERROR_COLOUR
	};
}

export function createSuccessEmbed(description) {
	return {
		title: 'Success',
		description,
		color: SUCCESS_COLOUR
	};
}

export function createInfoEmbed(title, description, color = EMBED_COLOUR) {
	return {
		title,
		description,
		color
	};
}

// --- Reply Helper ---
export async function replyWithEmbed(interaction, embed, isEphemeral = true, components = []) {
	return interaction.reply({
		embeds: [embed],
		components,
		flags: isEphemeral ? 64 : 0
	});
}

// --- Formatting Helpers ---
export function formatUSD(amount) {
	return `$${Number(amount).toFixed(2)} USD`;
}

export function formatCoinAmount(amount, decimals) {
	return Number(amount).toFixed(decimals);
}

// --- Math/Conversion Utilities ---
export function coinToUsd(coinAmount, price) {
	return coinAmount * price;
}

export function usdToCoin(usdAmount, price) {
	return usdAmount / price;
}

// --- File Read/Write Wrappers ---
export function readJson(path) {
	if (!fs.existsSync(path)) return {};
	return JSON.parse(fs.readFileSync(path, 'utf8'));
}

export function writeJson(path, obj) {
	fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

// --- Discord Component Builders ---
export function createButtonRow(buttons) {
	return {
		type: 1,
		components: buttons
	};
}

export function createButton(label, custom_id, style = 1, disabled = false, url = undefined) {
	const btn = {
		type: 2,
		label,
		style,
		disabled
	};
	if (style === 5 && url) {
		btn.url = url;
	} else {
		btn.custom_id = custom_id;
	}
	return btn;
}