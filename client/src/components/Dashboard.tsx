import { useState, useCallback } from 'react';
import MarketOverview from './MarketOverview';
import HotStockList from './HotStockList';
import StockDetail from './StockDetail';
import Watchlist from './Watchlist';

const WATCHLIST_KEY = 'stock_app_watchlist';

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(symbols: string[]): void {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols));
}

export default function Dashboard() {
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist);

  const handleSelectStock = useCallback((symbol: string) => {
    setSelectedStock(symbol);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedStock(null);
  }, []);

  const handleWatchlistToggle = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      saveWatchlist(next);
      return next;
    });
  }, []);

  const handleRemoveWatch = useCallback((symbol: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((s) => s !== symbol);
      saveWatchlist(next);
      return next;
    });
  }, []);

  // If a stock is selected, show detail view
  if (selectedStock) {
    return (
      <div className="max-w-5xl mx-auto">
        <StockDetail
          symbol={selectedStock}
          onBack={handleBack}
          onWatchlistToggle={handleWatchlistToggle}
          isWatched={watchlist.includes(selectedStock)}
        />
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Watchlist */}
      <Watchlist
        watchedSymbols={watchlist}
        onSelect={handleSelectStock}
        onRemove={handleRemoveWatch}
      />

      {/* Market Overview */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">🌐 全球市场概览</h2>
        <MarketOverview />
      </div>

      {/* Hot Stock Recommendations */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">🔥 今日热门推荐</h2>
        <HotStockList onSelectStock={handleSelectStock} />
      </div>
    </div>
  );
}
