import { useStockDetail } from '../hooks/useStockData';
import PriceChart from './PriceChart';
import FactorBreakdown from './FactorBreakdown';
import {
  formatCurrency,
  formatPercent,
  formatMarketCap,
  compactSymbol,
  getMarketBadge,
  timeAgo,
} from '../utils/format';
import type { NewsItem } from '../types';

interface Props {
  symbol: string;
  onBack: () => void;
  onWatchlistToggle: (symbol: string) => void;
  isWatched: boolean;
}

function NewsCard({ item }: { item: NewsItem }) {
  const sentimentColors: Record<string, string> = {
    positive: 'border-l-green-400',
    negative: 'border-l-red-400',
    neutral: 'border-l-gray-300',
  };

  const sentimentBadges: Record<string, string> = {
    positive: 'badge-up',
    negative: 'badge-down',
    neutral: 'badge-neutral',
  };

  const sentimentLabels: Record<string, string> = {
    positive: '😊 正面',
    negative: '😟 负面',
    neutral: '😐 中性',
  };

  return (
    <div className={`border-l-4 ${sentimentColors[item.sentiment]} bg-white p-3 rounded-r-lg shadow-sm mb-2`}>
      <div className="flex items-start justify-between gap-2">
        <a
          href={item.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-800 hover:text-blue-600 line-clamp-2 flex-1"
        >
          {item.title}
        </a>
        <span className={sentimentBadges[item.sentiment]}>
          {sentimentLabels[item.sentiment]}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
        {item.source && <span>{item.source}</span>}
        <span>{timeAgo(item.timestamp)}</span>
      </div>
    </div>
  );
}

export default function StockDetail({ symbol, onBack, onWatchlistToggle, isWatched }: Props) {
  const { quote, historical, news, scoring, loading, error } = useStockDetail(symbol);
  const badge = scoring ? getMarketBadge(scoring.market) : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-10 bg-gray-200 rounded w-48 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-64" />
        </div>
        <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-gray-500 mb-4">{error || '股票未找到'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          返回列表
        </button>
      </div>
    );
  }

  const isPositive = quote.regularMarketChangePercent >= 0;

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        ← 返回热门列表
      </button>

      {/* Stock Header */}
      <div className="card">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-900">
                {compactSymbol(quote.symbol)}
              </h2>
              {badge && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>
                  {badge.label}
                </span>
              )}
              <button
                onClick={() => onWatchlistToggle(symbol)}
                className={`text-lg transition-colors ${isWatched ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                title={isWatched ? '取消自选' : '添加自选'}
              >
                {isWatched ? '⭐' : '☆'}
              </button>
            </div>
            <p className="text-sm text-gray-400">{quote.shortName}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(quote.regularMarketPrice, quote.currency)}
            </div>
            <div className={`text-lg font-semibold mt-1 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
              {formatPercent(quote.regularMarketChangePercent)}
              <span className="text-sm ml-1">
                ({isPositive ? '+' : ''}{formatCurrency(quote.regularMarketChange, quote.currency)})
              </span>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
          <MetricItem label="开盘价" value={formatCurrency(quote.regularMarketOpen, quote.currency)} />
          <MetricItem label="最高价" value={formatCurrency(quote.regularMarketDayHigh, quote.currency)} />
          <MetricItem label="最低价" value={formatCurrency(quote.regularMarketDayLow, quote.currency)} />
          <MetricItem label="昨收" value={formatCurrency(quote.regularMarketPreviousClose, quote.currency)} />
          <MetricItem label="成交量" value={formatMarketCap(quote.regularMarketVolume)} />
          <MetricItem label="市值" value={formatMarketCap(quote.marketCap)} />
          <MetricItem label="52周最高" value={formatCurrency(quote.fiftyTwoWeekHigh, quote.currency)} />
          <MetricItem label="52周最低" value={formatCurrency(quote.fiftyTwoWeekLow, quote.currency)} />
        </div>
      </div>

      {/* Price Chart */}
      <PriceChart data={historical} loading={false} />

      {/* Factor Breakdown + Fundamentals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {scoring && (
          <FactorBreakdown scores={scoring.scores} compositeScore={scoring.compositeScore} />
        )}

        {/* Fundamentals Card */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 基本面</h3>
          <div className="space-y-2">
            <FundRow label="市盈率 (PE)" value={quote.trailingPE ? quote.trailingPE.toFixed(2) : '-'} />
            <FundRow label="远期PE" value={quote.forwardPE ? quote.forwardPE.toFixed(2) : '-'} />
            <FundRow label="市净率 (PB)" value={quote.priceToBook ? quote.priceToBook.toFixed(2) : '-'} />
            <FundRow label="ROE" value={quote.returnOnEquity != null ? (quote.returnOnEquity * 100).toFixed(1) + '%' : '-'} />
            <FundRow label="营收增长" value={quote.revenueGrowth != null ? (quote.revenueGrowth * 100).toFixed(1) + '%' : '-'} />
            <FundRow label="50日均价" value={formatCurrency(quote.fiftyDayAverage, quote.currency)} />
            <FundRow label="200日均价" value={formatCurrency(quote.twoHundredDayAverage, quote.currency)} />
          </div>
        </div>
      </div>

      {/* Signals */}
      {scoring && scoring.signals.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🎯 投资信号</h3>
          <div className="flex flex-wrap gap-2">
            {scoring.signals.map((signal, i) => (
              <span
                key={i}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* News */}
      {news.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📰 相关新闻</h3>
          <div className="max-h-[400px] overflow-y-auto">
            {news.map((item, i) => (
              <NewsCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-gray-700">{value}</div>
    </div>
  );
}

function FundRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
