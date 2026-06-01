import { useState } from 'react';
import { useHotStocks } from '../hooks/useStockData';
import StockCard from './StockCard';
import type { MarketTab } from '../types';
import { MARKET_LABELS } from '../types';

interface Props {
  onSelectStock: (symbol: string) => void;
}

export default function HotStockList({ onSelectStock }: Props) {
  const [market, setMarket] = useState<MarketTab>('all');
  const { data, loading, error, refetch } = useHotStocks(market, 20);

  return (
    <div>
      {/* Market Tabs + Refresh */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {(Object.keys(MARKET_LABELS) as MarketTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMarket(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                market === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {MARKET_LABELS[tab]}
            </button>
          ))}
        </div>
        <button
          onClick={refetch}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          🔄 刷新
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-gray-200 rounded" />
                <div>
                  <div className="h-4 bg-gray-200 rounded w-16 mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-28 mb-2" />
              <div className="h-2 bg-gray-200 rounded w-full mb-2" />
              <div className="flex gap-1">
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && data?.stocks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500">暂无符合条件的股票数据</p>
        </div>
      )}

      {/* Stock Grid */}
      {!loading && !error && data && data.stocks.length > 0 && (
        <>
          <div className="text-xs text-gray-400 mb-3">
            更新于 {new Date(data.updatedAt).toLocaleTimeString('zh-CN')} · 共 {data.total} 只
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.stocks.map((stock) => (
              <StockCard
                key={stock.symbol}
                stock={stock}
                onClick={onSelectStock}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
