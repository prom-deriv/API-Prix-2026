# PROMO Trade

A high-performance, deployable trading web application built using the Deriv API V2.

## Features

- **Real-time Tick Streaming**: Live price updates via WebSocket
- **Interactive Charts**: Candlestick charts with Lightweight Charts (TradingView)
- **One-Click Trading**: RISE/FALL buttons for quick trades
- **Strategy Builder**: Create automated trading strategies with compound conditions
- **Dark Mode**: Modern FinTech aesthetic with dark theme
- **Mobile Responsive**: Fat-finger friendly design for mobile traders

## Tech Stack

- **Framework**: React + Vite
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Charts**: Lightweight Charts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/promo-trade.git

# Navigate to project directory
cd promo-trade

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## API Integration

This application uses the Deriv API V2 public WebSocket endpoint:

```
wss://api.derivws.com/trading/v1/options/ws/public
```

### Available Endpoints

- `ticks` - Real-time price streaming
- `active_symbols` - Get available trading symbols
- `ticks_history` - Historical tick data
- `proposal` - Get trade proposal
- `buy` - Execute trade

## Project Structure

```
promo-trade/
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components
│   │   ├── charts/       # Chart components
│   │   └── trading/      # Trading interface
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions and API
│   ├── stores/           # Zustand state stores
│   ├── types/            # TypeScript type definitions
│   └── App.tsx           # Main application
├── public/               # Static assets
└── package.json
```

## Key Components

### TradingPanel
One-click trading interface with:
- Stake amount input
- Duration selection
- RISE/FALL buttons
- Proposal display

### TickChart
Real-time candlestick chart with:
- 5-second candle grouping
- Auto-scroll to latest data
- Dark theme styling

### Strategy Builder
Create automated trading strategies with:
- Compound conditions (AND/OR)
- Multiple condition types
- Custom actions per rule
- LocalStorage persistence

## Security

- No hardcoded credentials
- Input validation on all trades
- Generic error messages to users
- Rate limit awareness (100 req/sec WebSocket)

## Performance

- React.memo for expensive components
- Batched state updates
- Limited tick history (1000 ticks)
- Lazy loading where applicable

## Deployment

### Netlify

1. Connect your GitHub repository
2. Build command: `npm run build`
3. Publish directory: `dist`

### Environment Variables

No environment variables required for public endpoint usage.

## Future Enhancements

- [ ] OAuth 2.0 authentication with PKCE
- [ ] Account dashboard with balance/portfolio
- [ ] Advanced strategy backtesting
- [ ] Mobile app (React Native)
- [ ] Social features (strategy sharing)

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Deriv API](https://developers.deriv.com/) for the trading API
- [Lightweight Charts](https://github.com/nicehash/lightweight-charts) for the charting library
- [Tailwind CSS](https://tailwindcss.com/) for the styling framework
- [Zustand](https://github.com/nicehash/zustand) for state management

---

Built for the Deriv API Grand Prix
