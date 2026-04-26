import WebSocket from 'ws';

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
  ws.send(JSON.stringify({ active_symbols: 'brief' }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.active_symbols) {
    console.log(`Total active symbols in V2: ${response.active_symbols.length}`);
    if (response.active_symbols.length > 0) {
      console.log('Sample symbol keys:', Object.keys(response.active_symbols[0]));
      console.log('Sample symbol details:', response.active_symbols[0]);
    }
    process.exit(0);
  }
});
