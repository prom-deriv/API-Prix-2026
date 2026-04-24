import { WebSocket } from 'ws';

const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    ticks_history: 'cryBTCUSD',
    count: 1000,
    end: 'latest',
    style: 'ticks'
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);
  console.log(response);
  if (response.history) {
      console.log('History length:', response.history.prices.length);
  }
  ws.close();
});
