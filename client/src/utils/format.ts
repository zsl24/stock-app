// Format large numbers with abbreviations
export function formatNumber(n: number): string {
  if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(2) + 'T';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(2);
}

// Format percentage
export function formatPercent(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

// Format currency
export function formatCurrency(price: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$',
    CNY: '¥',
    HKD: 'HK$',
  };
  const symbol = symbols[currency] ?? currency + ' ';
  if (price >= 1000) {
    return symbol + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return symbol + price.toFixed(2);
}

// Format market cap to human readable
export function formatMarketCap(cap: number): string {
  if (cap >= 1_000_000_000_000) return '¥' + (cap / 1_000_000_000_000).toFixed(2) + '万亿';
  if (cap >= 100_000_000) return (cap / 100_000_000).toFixed(0) + '亿';
  return formatNumber(cap);
}

// Get score color class
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-500';
}

// Get score background color
export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

// Get market badge color
export function getMarketBadge(market: string): { color: string; label: string } {
  switch (market) {
    case 'cn': return { color: 'bg-red-100 text-red-700', label: 'A股' };
    case 'us': return { color: 'bg-blue-100 text-blue-700', label: '美股' };
    case 'hk': return { color: 'bg-purple-100 text-purple-700', label: '港股' };
    default: return { color: 'bg-gray-100 text-gray-600', label: market };
  }
}

// Get compact stock display symbol (remove .SS/.SZ/.HK)
export function compactSymbol(symbol: string): string {
  return symbol.replace(/\.(SS|SZ|HK)$/, '');
}

// Format time ago
export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
