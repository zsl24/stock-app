# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StockScope is a multi-market stock analysis web app that provides daily hot stock recommendations using a multi-factor scoring model. It covers A-shares (中国A股), US stocks, and HK stocks via the Sina Finance public API.

## Development Commands

```bash
# Install dependencies (run once)
npm install && cd client && npm install && cd ../server && npm install

# Development mode — starts both frontend (:5173) and backend (:3001)
npm run dev

# Start only backend
cd server && npm run dev      # tsx watch, auto-reload on changes

# Start only frontend
cd client && npm run dev      # Vite dev server, proxies /api to :3001

# Production build
cd client && npm run build    # output → client/dist/
cd server && npm run build    # TypeScript → server/dist/

# Production start (serve built frontend + API from single port :3001)
cd server && npm start        # node dist/index.js

# Type check
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

## Architecture

### Data flow

```
Sina Finance API (hq.sinajs.cn, GBK-encoded)  ←  EastMoney API (K-line history)
                    ↓
         server/src/services/stockData.ts
         (fetch, decode GBK → iconv-lite, parse, cache)
                    ↓
         server/src/services/screener.ts
         (multi-factor scoring: 10 factors → composite 0–100)
                    ↓
         server/src/routes/*.ts → Express API
         /api/market  /api/stocks/hot  /api/stocks/:symbol  /api/news/:symbol
                    ↓
         client/src/hooks/useStockData.ts (axios → API)
                    ↓
         React components (Dashboard → HotStockList → StockCard → StockDetail)
```

### Backend (`server/`)

- **Entry**: `src/index.ts` — Express server. In production, also serves `client/dist/` as static files with SPA fallback. Uses `PORT` env var for cloud deployment.
- **Data source**: `src/services/stockData.ts` — Primary data from Sina Finance API (`hq.sinajs.cn`). Response is GBK-encoded, decoded via `iconv-lite`. Requires `Referer: https://finance.sina.com.cn` header. K-line historical data from EastMoney API. All responses are cached in-memory with per-endpoint TTLs.
- **Scoring engine**: `src/services/screener.ts` — 10-factor weighted model: technical 40% (price change, volume ratio, RSI, breakout), fundamental 30% (PE, ROE, revenue growth), sentiment 30% (news volume, sentiment, analyst). Each factor scored 0–100, composite is weighted sum. Stocks filtered by change > -3% and marketCap > 1B (if data available).
- **News analysis**: `src/services/newsAnalysis.ts` — Keyword-based sentiment analysis (CN + EN dictionaries). Finnhub API integration is ready but requires `FINNHUB_API_KEY` env var.
- **Stock pools**: `src/config.ts` — Curated lists of tickers per market. A-shares use `.SS` (Shanghai) / `.SZ` (Shenzhen) suffixes. US uses bare tickers. HK uses `.HK` suffix with 5-digit codes.
- **Symbol mapping**: `toSinaSymbol()` in stockData.ts converts internal format → Sina codes (e.g., `600519.SS` → `sh600519`, `AAPL` → `gb_aapl`, `0700.HK` → `hk00700`).
- **Express version**: v5 — `*` wildcard routes not supported; use middleware-based SPA fallback instead.

### Frontend (`client/`)

- **Stack**: React 18 + TypeScript, Vite 8, Tailwind CSS 4, Recharts
- **State management**: React hooks + `localStorage` for watchlist persistence. No router library — the Dashboard component switches between list view and detail view via `selectedStock` state.
- **API layer**: `src/hooks/useStockData.ts` — Custom hooks (`useHotStocks`, `useStockDetail`, `useMarketOverview`) wrapping axios calls to `/api/*`. Vite proxy forwards `/api` to backend in dev mode.
- **Components hierarchy**: `App` → `Dashboard` → (`MarketOverview`, `Watchlist`, `HotStockList` → `StockCard`) or `StockDetail` → (`PriceChart`, `FactorBreakdown`)

### Deployment

Railway deployment via `railway.json` + `nixpacks.toml`:
- **Node version**: Must be ≥22 (enforced via `.nvmrc`, `.node-version`, `package.json#engines`, `nixpacks.toml`)
- **Build**: `cd client && npm install && npm run build && cd ../server && npm install && npm run build`
- **Start**: `cd server && npm start` (serves frontend static files + API on one port)

## Key Constraints

- **Yahoo Finance is blocked in mainland China** — data source must use Sina Finance or EastMoney APIs.
- **Sina API returns GBK encoding** — must decode with `iconv-lite` or equivalent.
- **HK stock codes** must be zero-padded to 5 digits for Sina (e.g., `0700.HK` → `hk00700`).
- **Express v5** does not support `app.get('*')` wildcards; use middleware instead.
- **Railway default Node is v18** — project requires explicit Node ≥22 configuration.
