import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
  ws.send(JSON.stringify({ active_symbols: 'brief' }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.active_symbols) {
    const indices = response.active_symbols.filter(s => s.market === 'indices' || s.market_display_name?.toLowerCase().includes('index'));
    console.log(`Total active symbols in V2: ${response.active_symbols.length}`);
    console.log('\nIndices:');
    indices.forEach(s => console.log(`- ${s.display_name} (${s.market} / ${s.submarket})`));
    process.exit(0);
  }
});
