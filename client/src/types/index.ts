// Stock quote from backend
export interface StockQuote {
  symbol: string;
  shortName: string;
  marketState: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  averageDailyVolume3Month: number;
  bid: number;
  ask: number;
  marketCap: number;
  trailingPE: number;
  forwardPE: number;
  priceToBook: number;
  returnOnEquity?: number;
  revenueGrowth?: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  fiftyDayAverage: number;
  twoHundredDayAverage: number;
  currency: string;
  exchangeName: string;
  quoteType: string;
}

// Historical data point
export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Factor scores
export interface FactorScores {
  priceChangeScore: number;
  volumeRatioScore: number;
  rsiScore: number;
  breakoutScore: number;
  peScore: number;
  roeScore: number;
  growthScore: number;
  newsVolumeScore: number;
  newsSentimentScore: number;
  analystScore: number;
}

// Scored stock from screener
export interface ScoredStock {
  symbol: string;
  name: string;
  market: 'cn' | 'us' | 'hk';
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  currency: string;
  scores: FactorScores;
  compositeScore: number;
  rank: number;
  signals: string[];
}

// Market index data
export interface IndexData {
  symbol: string;
  name: string;
  region: string;
  price: number;
  change: number;
  changePercent: number;
}

// Market overview
export interface MarketOverview {
  indices: IndexData[];
  updatedAt: number;
}

// News item
export interface NewsItem {
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: number;
  source?: string;
  url?: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Hot stocks response
export interface HotStocksResponse {
  stocks: ScoredStock[];
  total: number;
  market: string;
  updatedAt: number;
}

// Stock detail response
export interface StockDetailResponse {
  quote: StockQuote;
  historical: HistoricalDataPoint[];
  news: NewsItem[];
  scoring: ScoredStock | null;
}

// Market tabs
export type MarketTab = 'all' | 'cn' | 'us' | 'hk';

export const MARKET_LABELS: Record<MarketTab, string> = {
  all: '🌍 全球',
  cn: '🇨🇳 A股',
  us: '🇺🇸 美股',
  hk: '🇭🇰 港股',
};
