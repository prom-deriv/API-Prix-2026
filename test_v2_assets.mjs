import WebSocket from 'ws';

// Connect to Deriv API V2
const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

ws.on('open', () => {
  // Try sending active_symbols to v2
  ws.send(JSON.stringify({ active_symbols: 'brief' }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  if (response.active_symbols) {
    console.log(`Total active symbols in V2: ${response.active_symbols.length}`);
    
    // Group by market / submarket
    const markets = new Set();
    const submarkets = new Set();
    
    response.active_symbols.forEach(symbol => {
      markets.add(symbol.market_display_name || symbol.market);
      submarkets.add(symbol.submarket_display_name || symbol.submarket);
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

// timeout
setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 5000);
