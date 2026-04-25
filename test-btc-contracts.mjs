import WebSocket from 'ws';
const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
ws.on('open', () => {
  ws.send(JSON.stringify({ contracts_for: 'cryBTCUSD' }));
});
ws.on('message', (data) => {
  const res = JSON.parse(data);
  if (res.contracts_for) {
      console.log('Available contract types for cryBTCUSD:', [...new Set(res.contracts_for.available.map(c => c.contract_type))]);
      console.log('Sample CALL contract for cryBTCUSD:', res.contracts_for.available.find(c => c.contract_type === 'CALL'));
  } else {
      console.log('Error:', res.error);
  }
  process.exit(0);
});
