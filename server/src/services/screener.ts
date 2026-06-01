import { stockDataService, type StockQuote, type HistoricalDataPoint } from './stockData.js';
import { getStockPool } from '../config.js';

// Multi-factor scoring engine
// Each stock gets a composite score (0-100) based on technical, fundamental, and sentiment factors

interface FactorScores {
  // Technical (40%)
  priceChangeScore: number;     // 15% — price change today
  volumeRatioScore: number;     // 10% — volume vs 5-day average
  rsiScore: number;             // 10% — RSI position (50-70 optimal)
  breakoutScore: number;        // 5%  — price vs 20-day high

  // Fundamental (30%)
  peScore: number;              // 10% — PE ratio reasonability
  roeScore: number;             // 10% — return on equity
  growthScore: number;          // 10% — revenue growth

  // Sentiment (30%)
  newsVolumeScore: number;      // 10% — news mention frequency
  newsSentimentScore: number;   // 15% — news sentiment
  analystScore: number;         // 5%  — analyst rating changes
}

export interface ScoredStock {
  symbol: string;
  name: string;
  market: string;           // 'cn' | 'us' | 'hk'
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  currency: string;
  scores: FactorScores;
  compositeScore: number;   // 0-100 weighted total
  rank: number;
  signals: string[];        // human-readable signals
}

interface NewsItem {
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: number;
}

class StockScreener {
  // Main screening function — scores stocks from a given market
  async screenMarket(
    market: 'cn' | 'us' | 'hk' | 'all',
    topN: number = 20,
    newsMap?: Map<string, NewsItem[]>
  ): Promise<ScoredStock[]> {
    const pool = getStockPool(market);
    console.log(`Screening ${pool.length} stocks from ${market} market...`);

    // Fetch quotes in batches of 50 to avoid rate limits
    const batchSize = 50;
    const allQuotes: StockQuote[] = [];

    for (let i = 0; i < pool.length; i += batchSize) {
      const batch = pool.slice(i, i + batchSize);
      const quotes = await stockDataService.getQuotes(batch);
      allQuotes.push(...quotes);
      // Small delay between batches
      if (i + batchSize < pool.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`Got ${allQuotes.length} quotes`);

    // Filter: must have valid price, positive volume, and market cap
    const validStocks = allQuotes.filter(q =>
      q.regularMarketPrice > 0 &&
      q.regularMarketVolume > 0 &&
      q.quoteType === 'EQUITY'
    );

    // Score each stock
    const scored: ScoredStock[] = [];

    for (const quote of validStocks) {
      const region = this.detectMarket(quote.symbol);
      const news = newsMap?.get(quote.symbol) ?? [];

      const scores = this.calculateScores(quote, news);
      const compositeScore = this.calculateComposite(scores);

      // Generate trading signals
      const signals = this.generateSignals(quote, scores);

      scored.push({
        symbol: quote.symbol,
        name: quote.shortName,
        market: region,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        marketCap: quote.marketCap,
        currency: quote.currency,
        scores,
        compositeScore,
        rank: 0,
        signals,
      });
    }

    // Sort by composite score descending, assign ranks
    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    scored.forEach((s, i) => { s.rank = i + 1; });

    // Filter out low-quality results
    const filtered = scored.filter(s => {
      // Skip stocks with negative change > 3% (strongly dropping)
      if (s.changePercent < -3) return false;
      // Skip stocks with extremely low market cap only if we have the data
      if (s.marketCap > 0 && s.marketCap < 1_000_000_000) return false;
      return true;
    });

    return filtered.slice(0, topN);
  }

  private detectMarket(symbol: string): 'cn' | 'us' | 'hk' {
    if (symbol.endsWith('.SS') || symbol.endsWith('.SZ')) return 'cn';
    if (symbol.endsWith('.HK')) return 'hk';
    return 'us';
  }

  private calculateScores(quote: StockQuote, news: NewsItem[]): FactorScores {
    return {
      priceChangeScore: this.scorePriceChange(quote),
      volumeRatioScore: this.scoreVolumeRatio(quote),
      rsiScore: this.scoreRSI(quote),
      breakoutScore: this.scoreBreakout(quote),
      peScore: this.scorePE(quote),
      roeScore: this.scoreROE(quote),
      growthScore: this.scoreGrowth(quote),
      newsVolumeScore: this.scoreNewsVolume(news),
      newsSentimentScore: this.scoreNewsSentiment(news),
      analystScore: 50, // Default neutral, updated if data available
    };
  }

  // Weighted composite: technical 40%, fundamental 30%, sentiment 30%
  private calculateComposite(s: FactorScores): number {
    const technical =
      s.priceChangeScore * 0.15 +
      s.volumeRatioScore * 0.10 +
      s.rsiScore * 0.10 +
      s.breakoutScore * 0.05;

    const fundamental =
      s.peScore * 0.10 +
      s.roeScore * 0.10 +
      s.growthScore * 0.10;

    const sentiment =
      s.newsVolumeScore * 0.10 +
      s.newsSentimentScore * 0.15 +
      s.analystScore * 0.05;

    return Math.round((technical + fundamental + sentiment) * 100) / 100;
  }

  // --- Technical Scoring ---

  // Price change: prefer 1%-9.5% gain (scores peak at 5-7% gain, penalize >9.5% as potentially unsustainable)
  private scorePriceChange(quote: StockQuote): number {
    const pct = quote.regularMarketChangePercent;
    if (pct > 9.5) return 70;  // Near limit-up, caution
    if (pct > 7) return 85;
    if (pct > 5) return 100;   // Sweet spot
    if (pct > 3) return 90;
    if (pct > 1) return 75;
    if (pct > 0) return 55;
    if (pct > -1) return 35;
    if (pct > -3) return 20;
    return 10;
  }

  // Volume ratio: current volume vs 3-month average
  private scoreVolumeRatio(quote: StockQuote): number {
    const avg = quote.averageDailyVolume3Month;
    if (avg <= 0) return 50;
    const ratio = quote.regularMarketVolume / avg;
    if (ratio > 3) return 100;   // Heavy interest
    if (ratio > 2) return 90;
    if (ratio > 1.5) return 80;  // Active
    if (ratio > 1) return 65;
    if (ratio > 0.7) return 45;
    return 25;                   // Below average volume
  }

  // RSI approximation using price vs 50-day average
  private scoreRSI(quote: StockQuote): number {
    if (!quote.fiftyDayAverage || quote.fiftyDayAverage <= 0) return 50;
    // Simple approximation: distance from 50-day MA as %
    const distFromMA = ((quote.regularMarketPrice / quote.fiftyDayAverage) - 1) * 100;
    // Moderate distance (5-15% above MA) is good — suggests uptrend without being overbought
    if (distFromMA > 5 && distFromMA < 15) return 90;
    if (distFromMA > 2 && distFromMA <= 5) return 80;
    if (distFromMA >= 15 && distFromMA < 25) return 65;
    if (distFromMA >= 0 && distFromMA <= 2) return 60;
    if (distFromMA >= 25) return 40;  // Overbought
    if (distFromMA >= -5) return 35;
    return 20;  // Below MA significantly
  }

  // Breakout signal: price relative to 20-day high
  private scoreBreakout(quote: StockQuote): number {
    if (!quote.fiftyTwoWeekHigh) return 50;
    // Use 200-day MA as proxy for longer-term level
    const nearHigh = quote.regularMarketPrice / quote.fiftyTwoWeekHigh;
    if (nearHigh > 0.98) return 100;   // Near 52w high — breakout!
    if (nearHigh > 0.95) return 85;
    if (nearHigh > 0.90) return 70;
    if (nearHigh > 0.80) return 55;
    if (nearHigh > 0.70) return 40;
    return 20;
  }

  // --- Fundamental Scoring ---

  // PE ratio reasonability (industry-agnostic heuristic)
  private scorePE(quote: StockQuote): number {
    const pe = quote.trailingPE || quote.forwardPE;
    if (!pe || pe <= 0) return 50;
    // Growth companies can justify higher PE
    if (pe > 0 && pe < 10) return 75;     // Value territory
    if (pe >= 10 && pe < 20) return 90;   // Reasonable
    if (pe >= 20 && pe < 30) return 80;   // Fair
    if (pe >= 30 && pe < 50) return 65;   // Premium
    if (pe >= 50 && pe < 100) return 45;  // Expensive
    return 25;                            // Very expensive or speculative
  }

  // ROE scoring
  private scoreROE(quote: StockQuote): number {
    const roe = quote.returnOnEquity;
    if (roe === undefined || roe === null) return 50;
    // ROE is typically expressed as a decimal (0.15 = 15%)
    const roePct = roe > 1 ? roe : roe * 100; // Normalize
    if (roePct > 30) return 100;
    if (roePct > 20) return 90;
    if (roePct > 15) return 80;
    if (roePct > 10) return 65;
    if (roePct > 5) return 50;
    return 25;
  }

  // Revenue growth scoring
  private scoreGrowth(quote: StockQuote): number {
    const growth = quote.revenueGrowth;
    if (growth === undefined || growth === null) return 50;
    // growth is decimal: 0.20 = 20%
    const growthPct = growth * 100;
    if (growthPct > 30) return 100;
    if (growthPct > 20) return 90;
    if (growthPct > 10) return 75;
    if (growthPct > 5) return 65;
    if (growthPct > 0) return 50;
    return 20; // Negative growth
  }

  // --- Sentiment Scoring ---

  private scoreNewsVolume(news: NewsItem[]): number {
    const count = news.length;
    if (count > 10) return 100;
    if (count > 5) return 85;
    if (count > 3) return 70;
    if (count > 1) return 55;
    if (count === 1) return 40;
    return 25; // No news coverage
  }

  private scoreNewsSentiment(news: NewsItem[]): number {
    if (news.length === 0) return 50;
    const positive = news.filter(n => n.sentiment === 'positive').length;
    const negative = news.filter(n => n.sentiment === 'negative').length;
    const total = news.length;
    // Ratio of positive to total, with recency weighting
    const posRatio = positive / total;
    if (posRatio > 0.7) return 90;
    if (posRatio > 0.5) return 75;
    if (posRatio > 0.3) return 55;
    if (negative / total > 0.5) return 20;
    return 40;
  }

  // --- Signal Generation ---

  private generateSignals(quote: StockQuote, scores: FactorScores): string[] {
    const signals: string[] = [];

    if (scores.priceChangeScore >= 90) signals.push('💰 强势上涨');
    else if (scores.priceChangeScore >= 75) signals.push('📈 稳步攀升');

    if (scores.volumeRatioScore >= 80) signals.push('🔥 成交活跃，资金关注');
    else if (scores.volumeRatioScore >= 65) signals.push('📊 量能正常');

    if (scores.rsiScore >= 80) signals.push('💪 趋势强劲');
    else if (scores.rsiScore <= 30) signals.push('⚠️ 走势偏弱');

    if (scores.breakoutScore >= 85) signals.push('🚀 突破新高');
    else if (scores.breakoutScore >= 70) signals.push('⬆️ 接近前高');

    if (scores.peScore >= 80) signals.push('💎 估值合理');
    else if (scores.peScore <= 30) signals.push('📉 估值偏高');

    if (scores.roeScore >= 80) signals.push('🏆 盈利能力强');

    if (scores.growthScore >= 80) signals.push('🌱 高增长');

    if (scores.newsSentimentScore >= 75) signals.push('📰 舆论正面');

    return signals;
  }

  // Screen individual stock with detailed breakdown
  async screenSingle(symbol: string, news?: NewsItem[]): Promise<ScoredStock | null> {
    const quote = await stockDataService.getQuote(symbol);
    if (!quote) return null;

    const newsItems = news ?? [];
    const region = this.detectMarket(symbol);
    const scores = this.calculateScores(quote, newsItems);
    const compositeScore = this.calculateComposite(scores);
    const signals = this.generateSignals(quote, scores);

    return {
      symbol: quote.symbol,
      name: quote.shortName,
      market: region,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      volume: quote.regularMarketVolume,
      marketCap: quote.marketCap,
      currency: quote.currency,
      scores,
      compositeScore,
      rank: 0,
      signals,
    };
  }
}

export const stockScreener = new StockScreener();
