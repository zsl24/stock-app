import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { HistoricalDataPoint } from '../types';

interface Props {
  data: HistoricalDataPoint[];
  loading: boolean;
}

export default function PriceChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="card">
        <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="h-[300px] flex items-center justify-center text-gray-400">
          暂无历史数据
        </div>
      </div>
    );
  }

  // Transform data for display
  const chartData = data.map((d) => ({
    date: d.date?.slice(5) || d.date, // MM-DD
    price: d.close,
    volume: d.volume / 1_000_000, // volume in millions
  }));

  // Determine price color
  const startPrice = chartData[0]?.price ?? 0;
  const endPrice = chartData[chartData.length - 1]?.price ?? 0;
  const priceUp = endPrice >= startPrice;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name === 'price' ? '收盘价: $' : '成交量: '}
            {entry.name === 'price'
              ? entry.value.toFixed(2)
              : entry.value.toFixed(1) + 'M'}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">📈 价格走势</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            domain={['auto', 'auto']}
          />
          <YAxis
            yAxisId="volume"
            orientation="left"
            tick={{ fontSize: 11, fill: '#d1d5db' }}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke={priceUp ? '#22c55e' : '#ef4444'}
            strokeWidth={2}
            dot={false}
            name="收盘价"
          />
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="#e5e7eb"
            opacity={0.5}
            name="成交量(M)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
