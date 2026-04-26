# PROMO Trade - API-Prix-2026

A high-performance, deployable trading web application built using the Deriv API V2.

## Features

- **Real-time Tick Streaming**: Live price updates via WebSocket
- **Interactive Charts**: Candlestick charts with Lightweight Charts (TradingView)
- **One-Click Trading**: RISE/FALL buttons for quick trades
- **Real Accounts & Trading**: Support for Real Demo and Real Account trading directly from Deriv API V2
- **Ghost Trading (AI Bots)**: Trade alongside Bubu and Dudu, our automated trading mascots with unique strategies
- **AI Trading Assistant**: Integrated AI to help answer trading questions and guide decisions
- **Advanced Trade Management**: Set Stop Loss and Take Profit levels for your positions
- **Smart Alerts & Watchlist**: Custom price alerts and personalized asset watchlists
- **Social Trading**: Follow and interact with other traders' activities
- **Gamified Trading**: Engaging mini-games powered by live market data:
  - **Mochi Moto**: A racing game where the track slope reacts to real-time asset prices
  - **Surf the Waves**: A surfing game where players perform tricks and catch waves based on market volatility
- **Strategy Builder**: Create automated trading strategies with compound conditions
- **Deriv Digital Gift Card**: Purchase digital gift cards for friends and family using real Deriv account balance
- **Deriv Rewards Points**: Earn and track your rewards points directly in the application
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
git clone https://github.com/prom-deriv/API-Prix-2026.git

# Navigate to project directory
cd API-Prix-2026

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

### Ghost Trading Engine
Automated trading system featuring:
- **Bubu Mascot**: Aggressive/Trend-following AI personality
- **Dudu Mascot**: Conservative/Mean-reverting AI personality
- Performance tracking and live strategy execution

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

### Vercel

1. Connect your GitHub repository
2. Build command: `npm run build`
3. Output directory: `dist`

### Environment Variables

No environment variables required for public endpoint usage.

## Authentication

When users first visit the application, they are presented with a **Login Pop-up Board** to log in with their Deriv Account.

The application connects directly to the user's real or demo Deriv accounts using the secure OAuth V2 (PKCE) flow. Users can seamlessly switch between their real and demo accounts at any time via the Account Switcher menu in the app.

## Future Enhancements

- [ ] Account dashboard with balance/portfolio
- [ ] Advanced strategy backtesting
- [ ] Mobile app (React Native)

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Deriv API](https://developers.deriv.com/) for the trading API
- [Lightweight Charts](https://github.com/nicehash/lightweight-charts) for the charting library
- [Tailwind CSS](https://tailwindcss.com/) for the styling framework
- [Zustand](https://github.com/nicehash/zustand) for state management

---

Built for the Deriv API Grand Prix