import { WebSocket } from 'ws';

const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

ws.on('open', () => {
  ws.send(JSON.stringify({
    ticks_history: 'cryBTCUSD',
    end: 'latest',
    count: 1000,
    style: 'ticks'
  }));
});

ws.on('message', (data) => {
  console.log(JSON.parse(data));
  ws.close();
});
