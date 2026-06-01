// Server configuration
// Stock market configuration — ticker pools for each market

export const SERVER_PORT = 3001;

// Finnhub API key — sign up for free at https://finnhub.io/
export const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

// Cache durations in milliseconds
export const CACHE_TTL = {
  MARKET_OVERVIEW: 5 * 60 * 1000,   // 5 minutes
  HOT_STOCKS: 5 * 60 * 1000,         // 5 minutes
  STOCK_DETAIL: 2 * 60 * 1000,       // 2 minutes
  NEWS: 10 * 60 * 1000,              // 10 minutes
};

// Major indices for market overview
export const MARKET_INDICES: Record<string, { symbol: string; name: string; region: string }> = {
  sp500: { symbol: '^GSPC', name: 'S&P 500', region: 'US' },
  nasdaq: { symbol: '^IXIC', name: 'NASDAQ', region: 'US' },
  dow: { symbol: '^DJI', name: 'Dow Jones', region: 'US' },
  shanghai: { symbol: '000001.SS', name: '上证指数', region: 'CN' },
  shenzhen: { symbol: '399001.SZ', name: '深证成指', region: 'CN' },
  hangSeng: { symbol: '^HSI', name: '恒生指数', region: 'HK' },
};

// Stock pools for multi-factor screening
// A-share: representative large/mid-cap stocks from Shanghai & Shenzhen
export const A_SHARE_POOL = [
  // Shanghai (SH) — Blue chips + tech
  '600519.SS', // 贵州茅台
  '600036.SS', // 招商银行
  '601318.SS', // 中国平安
  '600276.SS', // 恒瑞医药
  '600900.SS', // 长江电力
  '601012.SS', // 隆基绿能
  '600887.SS', // 伊利股份
  '600809.SS', // 山西汾酒
  '601899.SS', // 紫金矿业
  '600585.SS', // 海螺水泥
  '601888.SS', // 中国中免
  '600030.SS', // 中信证券
  '601166.SS', // 兴业银行
  '600050.SS', // 中国联通
  '601857.SS', // 中国石油
  '600104.SS', // 上汽集团
  '600690.SS', // 海尔智家
  '601668.SS', // 中国建筑
  '600028.SS', // 中国石化
  '601088.SS', // 中国神华
  // Shenzhen (SZ) — Tech + Consumer
  '000858.SZ', // 五粮液
  '000333.SZ', // 美的集团
  '000651.SZ', // 格力电器
  '002415.SZ', // 海康威视
  '000725.SZ', // 京东方A
  '002594.SZ', // 比亚迪
  '000568.SZ', // 泸州老窖
  '002475.SZ', // 立讯精密
  '300750.SZ', // 宁德时代
  '300059.SZ', // 东方财富
  '000001.SZ', // 平安银行
  '002714.SZ', // 牧原股份
  '000063.SZ', // 中兴通讯
  '002230.SZ', // 科大讯飞
  '300124.SZ', // 汇川技术
  '000625.SZ', // 长安汽车
  '002142.SZ', // 宁波银行
  '300274.SZ', // 阳光电源
  '000002.SZ', // 万科A
  '002352.SZ', // 顺丰控股
];

// US stock pool — tech leaders + blue chips
export const US_STOCK_POOL = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'UNH', 'HD',
  'BAC', 'DIS', 'NFLX', 'ADBE', 'CRM', 'AMD', 'INTC',
  'PYPL', 'NKE', 'COST', 'ABNB', 'UBER', 'SNOW', 'PLTR',
  'MU', 'AVGO', 'ORCL', 'CSCO', 'QCOM', 'TXN', 'AMAT',
  'BA', 'CAT', 'GE', 'MMM', 'IBM', 'CVX', 'XOM',
  'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'DHR', 'SPGI',
];

// HK stock pool — major H-shares + local blue chips
export const HK_STOCK_POOL = [
  '0700.HK', // 腾讯
  '9988.HK', // 阿里巴巴
  '3690.HK', // 美团
  '9618.HK', // 京东
  '9999.HK', // 网易
  '1810.HK', // 小米
  '2318.HK', // 平安保险
  '0939.HK', // 建设银行
  '1398.HK', // 工商银行
  '3988.HK', // 中国银行
  '0005.HK', // 汇丰
  '0388.HK', // 港交所
  '0941.HK', // 中国移动
  '0883.HK', // 中海油
  '2269.HK', // 药明生物
  '1024.HK', // 快手
  '2015.HK', // 理想汽车
  '9868.HK', // 小鹏汽车
  '2020.HK', // 安踏
  '2331.HK', // 李宁
];

// US Stock Sector Classification (GICS-based)
// Used by market review for sector analysis
export interface SectorInfo {
  name: string;
  nameZh: string;
  stocks: string[];
}

export const US_SECTORS: SectorInfo[] = [
  {
    name: 'Technology',
    nameZh: '科技',
    stocks: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'ADBE', 'CRM', 'AMD', 'INTC', 'ORCL', 'CSCO', 'QCOM', 'TXN', 'AMAT', 'AVGO', 'MU', 'SNOW', 'PLTR'],
  },
  {
    name: 'Communication',
    nameZh: '通讯',
    stocks: ['META', 'NFLX', 'DIS'],
  },
  {
    name: 'Financial',
    nameZh: '金融',
    stocks: ['JPM', 'BAC', 'V', 'MA', 'SPGI', 'PYPL'],
  },
  {
    name: 'Healthcare',
    nameZh: '医疗健康',
    stocks: ['JNJ', 'UNH', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'DHR'],
  },
  {
    name: 'Consumer',
    nameZh: '消费',
    stocks: ['WMT', 'PG', 'HD', 'NKE', 'COST'],
  },
  {
    name: 'Industrial',
    nameZh: '工业制造',
    stocks: ['BA', 'CAT', 'GE', 'MMM', 'IBM'],
  },
  {
    name: 'Energy',
    nameZh: '能源',
    stocks: ['CVX', 'XOM'],
  },
  {
    name: 'Tech-Mobility',
    nameZh: '科技出行',
    stocks: ['TSLA', 'AMZN', 'UBER', 'ABNB'],
  },
];

// US indices for market review (Sina codes)
export const US_INDEX_SINA_CODES = {
  nasdaq: 'gb_ixic',   // 纳斯达克综合
  dji: 'gb_dji',        // 道琼斯工业
  spx: 'gb_inx',        // 标普500
};

// Get pool by market code
export function getStockPool(market: string): string[] {
  switch (market) {
    case 'cn': return A_SHARE_POOL;
    case 'us': return US_STOCK_POOL;
    case 'hk': return HK_STOCK_POOL;
    case 'all': return [...A_SHARE_POOL, ...US_STOCK_POOL, ...HK_STOCK_POOL];
    default: return US_STOCK_POOL;
  }
}
