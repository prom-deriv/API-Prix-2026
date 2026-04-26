import WebSocket from 'ws';

// Connect to Deriv WebSocket API
const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

ws.on('open', () => {
  ws.send(JSON.stringify({ active_symbols: 'brief', product_type: 'basic' }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.active_symbols) {
    console.log(`Total active symbols: ${response.active_symbols.length}`);
    
    // Group by market / submarket
    const markets = new Set();
    const submarkets = new Set();
    
    response.active_symbols.forEach(symbol => {
      markets.add(symbol.market_display_name);
      submarkets.add(symbol.submarket_display_name);
    });
    
    console.log('\nMarkets:');
    Array.from(markets).forEach(m => console.log(`- ${m}`));
    
    console.log('\nSubmarkets:');
    Array.from(submarkets).forEach(sm => console.log(`- ${sm}`));
    
    process.exit(0);
  } else if (response.error) {
    console.error('Error:', response.error.message);
    process.exit(1);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket Error:', err);
  process.exit(1);
});
