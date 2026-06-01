import { useMarketOverview } from '../hooks/useStockData';
import { formatCurrency, formatPercent } from '../utils/format';

export default function MarketOverview() {
  const { data, loading } = useMarketOverview();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-24 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          ))
        : data?.indices.map((idx) => (
            <div key={idx.symbol} className="card">
              <div className="text-xs text-gray-400 mb-1">{idx.name}</div>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(idx.price, 'USD')}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className={idx.changePercent >= 0 ? 'badge-up' : 'badge-down'}>
                  {formatPercent(idx.changePercent)}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">{idx.region}</div>
            </div>
          ))}
    </div>
  );
}
