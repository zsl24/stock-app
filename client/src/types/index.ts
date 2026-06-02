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

// Dashboard view tabs
export type DashboardView = 'hot' | 'review';

// Market review types
export interface IndexTrend {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  fiveDayReturn: number;
  fiveDayData: { date: string; close: number }[];
  trendSignal: 'strong_up' | 'up' | 'sideways' | 'down' | 'strong_down';
  trendLabel: string;
}

export interface MarketBreadth {
  advanceCount: number;
  declineCount: number;
  unchangedCount: number;
  advanceRatio: number;
  totalVolume: number;
  avgVolume5Day: number;
  volumeRatio: number;
}

export interface SectorPerformance {
  name: string;
  nameZh: string;
  avgChangePercent: number;
  avgVolumeRatio: number;
  advanceCount: number;
  declineCount: number;
  topGainers: { symbol: string; name: string; changePercent: number }[];
  fiveDayTrend: number;
}

export interface KeyFinding {
  type: 'bullish' | 'bearish' | 'neutral' | 'warning';
  text: string;
}

export interface MarketReviewData {
  date: string;
  marketStatus: string;
  indices: IndexTrend[];
  breadth: MarketBreadth;
  sectors: SectorPerformance[];
  topGainers: { symbol: string; name: string; changePercent: number; sector: string }[];
  topLosers: { symbol: string; name: string; changePercent: number; sector: string }[];
  findings: KeyFinding[];
  updatedAt: number;
}

// Full daily report types (v2)
export interface RiskDimension {
  dimension: string;
  dimensionZh: string;
  ruleScore: number;
  aiAdjustment: number;
  finalScore: number;
  riskLevel: string;
  riskLevelZh: string;
  reasons: string[];
}

export interface RiskSummary {
  date: string;
  dimensions: RiskDimension[];
  overallScore: number;
  overallLevel: string;
  overallLevelZh: string;
  dataTime: string;
  source: string;
}

export interface MacroIndicator {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  available: boolean;
  error?: string;
  dataTime: string;
  source: string;
}

export interface DailyReport {
  reportDate: string;
  title: string;
  sections: { title: string; content: string }[];
  reportText: string;
  marketSummary: string;
  riskSummary: string;
  actionSummary: string;
  opportunitySummary: string;
  dataQualityNotes: string[];
}

export interface MarketDataRow {
  trade_date: string;
  symbol: string;
  name?: string;
  close?: number;
  change_pct?: number;
  volume?: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  below_ma20?: number;
  below_ma50?: number;
  below_ma200?: number;
  volume_vs_avg?: number;
  trend_3d?: string;
}

export interface GenerateReportResponse {
  reportDate: string;
  riskScores: RiskSummary;
  macroData: MacroIndicator[];
  dailyReport: DailyReport;
  symbolsAnalyzed: number;
  dataMissing: string[];
}

export interface LatestReportResponse {
  report: {
    report_date: string;
    title: string;
    report_text: string;
    market_summary: string;
    risk_summary: string;
    action_summary: string;
    opportunity_summary: string;
    data_quality_notes: string;
  } | null;
  riskScores: Array<{
    risk_dimension: string;
    rule_score: number;
    final_score: number;
    risk_level: string;
    reasons: string;
  }>;
  marketData: MarketDataRow[];
  hasData: boolean;
}
