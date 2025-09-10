// Global constants for coin info and decimal precision
export const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', decimals: 8 },
  { id: 'monero', symbol: 'XMR', name: 'Monero', decimals: 12 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', decimals: 9 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', decimals: 18 }
];

export const COIN_DECIMALS = Object.fromEntries(COINS.map(c => [c.id, c.decimals]));
