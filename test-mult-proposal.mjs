import WebSocket from 'ws';
const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
ws.on('open', () => {
  ws.send(JSON.stringify({
    proposal: 1,
    amount: 10,
    basis: "stake",
    contract_type: "MULTUP",
    currency: "USD",
    multiplier: 100,
    symbol: "cryBTCUSD"
  }));
});
ws.on('message', (data) => {
  const res = JSON.parse(data);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
});
