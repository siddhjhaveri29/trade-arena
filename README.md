# TradeArena

A TradingView-style paper trading simulator with live Indian and US market data, trade journaling, and group leaderboards.

## Features

- **Live Trading Terminal** — 3-column layout with watchlist, interactive TradingView charts, and order panel
- **Indian & US Markets** — NSE stocks via Yahoo Finance, US stocks via Alpaca Markets
- **Order Engine** — Market and limit orders, long/short positions, auto-fills every 3 seconds
- **Trade Journal** — Emotion tracking, setup tags, calendar heatmap, win rate stats
- **Groups & Leaderboards** — Create competitions with friends via invite codes, ranked by return %
- **Portfolio Analytics** — Equity curve, realized P&L, win rate, per-trade stats

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- An [Alpaca Markets](https://alpaca.markets) account for US data (free paper trading account)

---

## Setup

### 1. Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql)
3. From **Project Settings → API**, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 2. Alpaca Markets (US market data)

1. Sign up at [alpaca.markets](https://alpaca.markets) — free paper trading account
2. Generate API keys from the dashboard
3. Use the **paper trading** base URL: `https://paper-api.alpaca.markets`

> **Note:** Without Alpaca keys, the server falls back to simulated US prices for development.

### 3. Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Alpaca (optional — mock prices used if missing)
ALPACA_KEY_ID=your-alpaca-key-id
ALPACA_SECRET_KEY=your-alpaca-secret-key
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Server
PORT=3001
CLIENT_URL=http://localhost:5173
```

Create a `.env` file in the `client/` directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WS_URL=ws://localhost:3001
```

### 4. Install & Run

```bash
# Install all dependencies (root + client + server workspaces)
npm install

# Start both client and server in development mode
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

---

## Project Structure

```
Trade Arena/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── Chart/       # TradingView embed
│   │   │   ├── Groups/      # Leaderboard, GroupCard
│   │   │   ├── Journal/     # JournalForm, JournalList, JournalStats
│   │   │   ├── OrderPanel/  # OrderForm, OrderBook
│   │   │   ├── Positions/   # PositionsTable
│   │   │   ├── Watchlist/   # Watchlist
│   │   │   └── shared/      # Navbar, Toast, MarketStatus
│   │   ├── context/         # AuthContext, PriceContext, ToastContext
│   │   ├── hooks/           # usePortfolio, useOrders, usePrices
│   │   ├── pages/           # Terminal, Journal, Groups, Profile
│   │   └── lib/             # supabase.js client
├── server/                  # Express + WebSocket backend
│   ├── middleware/auth.js   # Supabase JWT verification
│   ├── routes/              # REST API routes
│   └── services/
│       ├── priceCache.js    # In-memory price store, WebSocket broadcast
│       ├── growwService.js  # Indian market data via yahoo-finance2
│       ├── alpacaService.js # US market data via Alpaca API
│       ├── orderEngine.js   # Limit order auto-fill engine
│       └── snapshotService.js # Equity curve snapshots
└── supabase/schema.sql      # Complete database schema with RLS
```

---

## Market Data

| Market | Source | Symbols |
|--------|--------|---------|
| Indian stocks | Yahoo Finance (`yahoo-finance2`) | RELIANCE.NS, TCS.NS, INFY.NS, etc. |
| NSE Indices | Yahoo Finance | ^NSEI (Nifty 50), ^NSEBANK (Bank Nifty) |
| Commodities | Yahoo Finance | GC=F (Gold), CL=F (Crude Oil) |
| US stocks | Alpaca Markets (IEX feed) | AAPL, TSLA, MSFT, NVDA, etc. |
| US ETFs | Alpaca Markets | SPY, QQQ, GLD, USO |

Prices update every 3 seconds via WebSocket. A polling fallback activates if the WebSocket disconnects.

---

## Development Notes

- **Order fills:** Market orders fill at the next price tick (~3s). Limit orders fill when price crosses the limit.
- **Short selling:** Shorting is supported — short P&L = (avg_price - cover_price) × qty.
- **Mock prices:** If Alpaca keys are missing, US prices are simulated for development.
- **Charts:** TradingView free embed (no API key required). Symbol changes trigger iframe re-mount.
