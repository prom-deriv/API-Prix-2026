import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
  ws.send(JSON.stringify({ active_symbols: 'full' }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.active_symbols) {
    const indices = response.active_symbols.filter(s => s.market === 'indices');
    if (indices.length > 0) {
      console.log('Sample index symbol keys:', Object.keys(indices[0]));
      console.log('Sample index symbol details:', indices[0]);
    }
    process.exit(0);
  }
});
