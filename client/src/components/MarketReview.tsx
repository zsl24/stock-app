import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { MarketReviewData } from '../types';
import { formatPercent } from '../utils/format';

const findingIcons: Record<string, string> = {
  bullish: '🐂',
  bearish: '🐻',
  neutral: '📊',
  warning: '⚠️',
};

const trendColors: Record<string, string> = {
  strong_up: 'text-green-600 bg-green-50',
  up: 'text-green-500 bg-green-50',
  sideways: 'text-gray-500 bg-gray-50',
  down: 'text-red-500 bg-red-50',
  strong_down: 'text-red-600 bg-red-50',
};

export default function MarketReview() {
  const [data, setData] = useState<MarketReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/review/us');
        if (!cancelled && res.data.success) {
          setData(res.data.data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-40 mb-3" />
            <div className="h-40 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">{error || '暂无复盘数据'}</p>
      </div>
    );
  }

  // Prepare 5-day trend chart data
  const trendChartData = data.indices[0]?.fiveDayData.map((d, i) => ({
    date: d.date?.slice(5) || d.date,
    纳斯达克: data.indices[0]?.fiveDayData[i]?.close,
    道琼斯: data.indices[1]?.fiveDayData[i]?.close,
    标普500: data.indices[2]?.fiveDayData[i]?.close,
  })) || [];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Date Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">📊 美股盘后复盘</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {data.date} · {data.marketStatus === 'closed' ? '🔴 已收盘' : '🟢 交易中'}
          </p>
        </div>
      </div>

      {/* 1. Market Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {data.indices.map(idx => (
          <div key={idx.symbol} className="card">
            <div className="text-xs text-gray-400 mb-1">{idx.name}</div>
            <div className="text-lg font-bold text-gray-900">
              {idx.price.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={idx.changePercent >= 0 ? 'badge-up' : 'badge-down'}>
                {formatPercent(idx.changePercent)}
              </span>
            </div>
            <div className={`text-xs mt-1.5 px-1.5 py-0.5 rounded ${trendColors[idx.trendSignal]}`}>
              {idx.trendLabel}
            </div>
          </div>
        ))}

        {/* Breadth Card */}
        <div className="card">
          <div className="text-xs text-gray-400 mb-1">市场宽度</div>
          <div className="text-lg font-bold text-gray-900">
            {data.breadth.advanceRatio.toFixed(0)}%
          </div>
          <div className="flex gap-2 mt-1 text-xs">
            <span className="text-green-600">{data.breadth.advanceCount}↑</span>
            <span className="text-red-500">{data.breadth.declineCount}↓</span>
          </div>
        </div>

        {/* Volume Card */}
        <div className="card">
          <div className="text-xs text-gray-400 mb-1">成交量比</div>
          <div className={`text-lg font-bold ${data.breadth.volumeRatio > 1 ? 'text-red-500' : 'text-gray-500'}`}>
            {data.breadth.volumeRatio.toFixed(2)}x
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {data.breadth.volumeRatio > 1.2 ? '放量' : data.breadth.volumeRatio < 0.8 ? '缩量' : '正常'}
          </div>
        </div>
      </div>

      {/* 2. Five-Day Trend Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">📈 5日指数趋势</h3>
        {trendChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="纳斯达克" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="道琼斯" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="标普500" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
            暂无5日趋势数据
          </div>
        )}
        {/* Index 5D returns */}
        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
          {data.indices.map(idx => (
            <div key={idx.symbol} className="text-xs">
              <span className="text-gray-400">{idx.name} 5日: </span>
              <span className={idx.fiveDayReturn >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                {formatPercent(idx.fiveDayReturn)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Sector Performance */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">🏭 板块表现</h3>
        <div className="space-y-2">
          {data.sectors.map(sec => (
            <div key={sec.name}>
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => setExpandedSector(expandedSector === sec.name ? null : sec.name)}
              >
                {/* Sector rank bar */}
                <span className="text-xs text-gray-400 w-6 text-right">
                  {data.sectors.indexOf(sec) + 1}
                </span>
                <span className="text-sm font-medium text-gray-700 w-20">{sec.nameZh}</span>
                {/* Mini bar chart */}
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                  <div
                    className={`absolute inset-y-0 left-1/2 rounded-full transition-all ${
                      sec.avgChangePercent >= 0 ? 'bg-green-400' : 'bg-red-400'
                    }`}
                    style={{
                      width: `${Math.min(Math.abs(sec.avgChangePercent) * 8, 48)}%`,
                      ...(sec.avgChangePercent >= 0
                        ? { left: '50%' }
                        : { left: `${50 - Math.min(Math.abs(sec.avgChangePercent) * 8, 48)}%` }),
                    }}
                  />
                </div>
                <span className={`text-sm font-semibold w-16 text-right ${
                  sec.avgChangePercent >= 0 ? 'text-green-600' : 'text-red-500'
                }`}>
                  {formatPercent(sec.avgChangePercent)}
                </span>
                <span className="text-xs text-gray-400 w-20 text-right">
                  {sec.advanceCount}↑/{sec.declineCount}↓
                </span>
                <span className="text-xs text-gray-300">{expandedSector === sec.name ? '▲' : '▶'}</span>
              </div>
              {/* Expanded: Top 3 stocks in sector */}
              {expandedSector === sec.name && sec.topGainers.length > 0 && (
                <div className="ml-10 mb-2 bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-gray-400 mb-1">板块领涨</div>
                  {sec.topGainers.map(s => (
                    <div key={s.symbol} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-gray-600">{s.symbol} <span className="text-gray-400">{s.name}</span></span>
                      <span className="text-green-600 font-semibold">{formatPercent(s.changePercent)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🚀 今日涨幅 Top 5</h3>
          <div className="space-y-2">
            {data.topGainers.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-800">{s.symbol}</span>
                  <span className="text-xs text-gray-400 ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded">{s.sector}</span>
                </div>
                <span className="text-green-600 font-semibold">{formatPercent(s.changePercent)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📉 今日跌幅 Top 5</h3>
          {data.topLosers.length > 0 ? (
            <div className="space-y-2">
              {data.topLosers.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{s.symbol}</span>
                    <span className="text-xs text-gray-400 ml-1.5 px-1.5 py-0.5 bg-gray-100 rounded">{s.sector}</span>
                  </div>
                  <span className="text-red-500 font-semibold">{formatPercent(s.changePercent)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">今日无显著下跌股票</p>
          )}
        </div>
      </div>

      {/* 5. Key Findings */}
      {data.findings.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">💡 关键发现</h3>
          <div className="space-y-2">
            {data.findings.map((f, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-2.5 rounded-lg ${
                  f.type === 'bullish' ? 'bg-green-50' :
                  f.type === 'bearish' ? 'bg-red-50' :
                  f.type === 'warning' ? 'bg-amber-50' :
                  'bg-gray-50'
                }`}
              >
                <span className="text-lg">{findingIcons[f.type]}</span>
                <p className="text-sm text-gray-700">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
