import fetch from 'node-fetch';

const COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' }, // Popular pick
];

async function getCoinData() {
  const ids = COINS.map(c => c.id).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=1h,24h,7d`;
  const res = await fetch(url);
  return await res.json();
}

function getSparklineUrl(coin) {
  // Use QuickChart for sparkline images, URL-encoded
  const data = coin.sparkline_in_7d.price.slice(-48).map(p => p.toFixed(2));
  const chartConfig = `{type:'sparkline',data:{datasets:[{data:[${data}] }]}}`;
  return `https://quickchart.io/chart?c=${encodeURIComponent(chartConfig)}`;
}

export default {
  name: 'shop',
  description: 'View available crypto coins, prices, and graphs',
  options: [
    {
      name: 'query',
      type: 3, // STRING
      description: 'Enter a coin symbol or name (e.g. XMR or Monero)',
      required: false,
    },
  ],
  async execute(interaction) {
    const query = interaction.options?.getString?.('query') || interaction.options?.query || null;
    let coins = await getCoinData();
    if (query) {
      // Filter coins by symbol or name (case-insensitive, partial match)
      const s = query.trim().toLowerCase();
      coins = coins.filter(c =>
        c.symbol.toLowerCase() === s ||
        c.name.toLowerCase() === s ||
        c.symbol.toLowerCase().includes(s) ||
        c.name.toLowerCase().includes(s)
      );
      if (coins.length === 0) {
        await interaction.reply({ content: `No coins found for "${query}".`, ephemeral: true });
        return;
      }
    }
    const pageSize = 1; // One coin per page
    let page = 0;
    const totalPages = coins.length;

    function getPageEmbed(pageIdx) {
      const coin = coins[pageIdx];
      const upDown = coin.price_change_percentage_24h > 0 ? '📈' : '📉';
      // Reduce to 24 points for a shorter URL (one per ~7 hours)
      const allPoints = coin.sparkline_in_7d.price;
      const step = Math.floor(allPoints.length / 24);
      const points = allPoints.filter((_, i) => i % step === 0).slice(0, 24);
      // Helper to format Y values (e.g., 112k, 1.2M)
      function formatY(val) {
        if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B';
        if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
        if (val >= 1e3) return (val / 1e3).toFixed(1) + 'k';
        return val.toFixed(0);
      }

      const chartConfig = {
        type: 'line',
        data: {
          labels: points.map((_, i) => `${24 - i * 1}h`),
          datasets: [{
            label: '',
            data: points,
            borderColor: 'rgb(255,255,255)',
            fill: false,
            pointRadius: 0
          }]
        },
        options: {
              scales: {
                x: {
                  display: true,
                  title: { display: true, text: 'Hours Ago', color: '#fff' },
                  ticks: { maxTicksLimit: 6, color: '#fff' }
                },
                y: {
                  display: true,
                  title: { display: true, text: 'USD', color: '#fff' },
                  ticks: {
                    maxTicksLimit: 5,
                    color: '#fff',
                    callback: formatY
                  }
                }
              },
              plugins: {
                legend: { display: false },
                title: { display: false },
              },
              elements: { line: { borderColor: '#fff' } },
              backgroundColor: 'black',
            },
          };
          const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
          return {
            embeds: [{
              title: `Crypto Shop (Page ${pageIdx + 1}/${totalPages})`,
              color: 0x0099ff,
              fields: [
                {
                  name: `${coin.name} (${coin.symbol.toUpperCase()})`,
                  value:
                    `Price: $${coin.current_price} USD ${upDown}\n` +
                    `1h: ${coin.price_change_percentage_1h_in_currency?.toFixed(2) ?? 'N/A'}% | 24h: ${coin.price_change_percentage_24h?.toFixed(2) ?? 'N/A'}% | 7d: ${coin.price_change_percentage_7d_in_currency?.toFixed(2) ?? 'N/A'}%`,
                  inline: false
                }
              ],
              image: { url: chartUrl }
            }]
          };
        }

    // Send first page and add navigation buttons
    await interaction.reply({
      ...getPageEmbed(page),
      components: totalPages > 1 ? [{
        type: 1,
        components: [
          {
            type: 2,
            label: 'Prev',
            style: 1,
            custom_id: 'shop_prev',
            disabled: page === 0
          },
          {
            type: 2,
            label: 'Next',
            style: 1,
            custom_id: 'shop_next',
            disabled: page === totalPages - 1
          }
        ]
      }] : []
    });

    if (totalPages > 1) {
      const filter = i => i.user.id === interaction.user.id && (i.customId === 'shop_prev' || i.customId === 'shop_next');
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });
      collector.on('collect', async i => {
        if (i.customId === 'shop_prev' && page > 0) page--;
        if (i.customId === 'shop_next' && page < totalPages - 1) page++;
        await i.update({
          ...getPageEmbed(page),
          components: [{
            type: 1,
            components: [
              {
                type: 2,
                label: 'Prev',
                style: 1,
                custom_id: 'shop_prev',
                disabled: page === 0
              },
              {
                type: 2,
                label: 'Next',
                style: 1,
                custom_id: 'shop_next',
                disabled: page === totalPages - 1
              }
            ]
          }]
        });
      });
    }
  },
};
