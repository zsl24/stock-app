import { useState, useCallback } from 'react';
import MarketOverview from './MarketOverview';
import HotStockList from './HotStockList';
import StockDetail from './StockDetail';
import Watchlist from './Watchlist';
import MarketReview from './MarketReview';
import type { DashboardView } from '../types';

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
  const [view, setView] = useState<DashboardView>('hot');
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setView('hot')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            view === 'hot'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🔥 热门推荐
        </button>
        <button
          onClick={() => setView('review')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            view === 'review'
              ? 'bg-white text-blue-600 border-b-2 border-blue-600 -mb-[2px]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📊 盘后复盘
        </button>
      </div>

      {view === 'hot' ? (
        <>
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
        </>
      ) : (
        <MarketReview />
      )}
    </div>
  );
}
