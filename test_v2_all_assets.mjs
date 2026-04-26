import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
  ws.send(JSON.stringify({ active_symbols: 'full' }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.active_symbols) {
    console.log(`Total active symbols in V2 (full): ${response.active_symbols.length}`);
    
    // Check for specific submarkets
    const indices = response.active_symbols.filter(s => s.market === 'indices');
    
    console.log('\nStock Indices in V2:');
    indices.forEach(s => console.log(`- ${s.display_name} (${s.symbol})`));
    
    process.exit(0);
  }
});
