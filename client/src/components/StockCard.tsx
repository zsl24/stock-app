import type { ScoredStock } from '../types';
import {
  formatCurrency,
  formatPercent,
  formatMarketCap,
  getScoreColor,
  compactSymbol,
  getMarketBadge,
} from '../utils/format';

interface Props {
  stock: ScoredStock;
  onClick: (symbol: string) => void;
}

export default function StockCard({ stock, onClick }: Props) {
  const badge = getMarketBadge(stock.market);
  const isPositive = stock.changePercent >= 0;

  return (
    <div
      className="card cursor-pointer hover:scale-[1.02] transition-transform"
      onClick={() => onClick(stock.symbol)}
    >
      {/* Header: Rank + Symbol + Name + Market Badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-300 tabular-nums w-8">
            #{stock.rank}
          </span>
          <div>
            <div className="font-semibold text-gray-900 text-sm">
              {compactSymbol(stock.symbol)}
            </div>
            <div className="text-xs text-gray-400 truncate max-w-[120px]">
              {stock.name}
            </div>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {/* Price + Change */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <span className="text-xl font-bold text-gray-900">
            {formatCurrency(stock.price, stock.currency)}
          </span>
        </div>
        <div className="text-right">
          <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
            {formatPercent(stock.changePercent)}
          </span>
          <div className="text-xs text-gray-400">{formatMarketCap(stock.marketCap)}</div>
        </div>
      </div>

      {/* Composite Score Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>综合得分</span>
          <span className={`font-bold ${getScoreColor(stock.compositeScore)}`}>
            {stock.compositeScore.toFixed(0)}/100
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="score-bar h-2 rounded-full transition-all"
            style={{ width: `${stock.compositeScore}%` }}
          />
        </div>
      </div>

      {/* Key Signals (up to 2) */}
      <div className="flex flex-wrap gap-1">
        {stock.signals.slice(0, 2).map((s, i) => (
          <span key={i} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded">
            {s}
          </span>
        ))}
        {stock.signals.length > 2 && (
          <span className="text-[10px] text-gray-400">+{stock.signals.length - 2}</span>
        )}
      </div>
    </div>
  );
}
