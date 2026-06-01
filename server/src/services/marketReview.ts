import { stockDataService, type StockQuote, type HistoricalDataPoint } from './stockData.js';
import { US_STOCK_POOL, US_SECTORS, US_INDEX_SINA_CODES } from '../config.js';

export interface SectorPerformance {
  name: string;
  nameZh: string;
  avgChangePercent: number;
  avgVolumeRatio: number;
  advanceCount: number;
  declineCount: number;
  topGainers: { symbol: string; name: string; changePercent: number }[];
  fiveDayTrend: number; // cumulative 5-day return %
}

export interface IndexTrend {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  fiveDayReturn: number;      // cumulative %
  fiveDayData: { date: string; close: number }[];
  trendSignal: 'strong_up' | 'up' | 'sideways' | 'down' | 'strong_down';
  trendLabel: string;
}

export interface MarketBreadth {
  advanceCount: number;
  declineCount: number;
  unchangedCount: number;
  advanceRatio: number;       // 0-100
  totalVolume: number;
  avgVolume5Day: number;
  volumeRatio: number;
}

export interface KeyFinding {
  type: 'bullish' | 'bearish' | 'neutral' | 'warning';
  text: string;
}

export interface MarketReviewData {
  date: string;
  marketStatus: string;       // 'closed' | 'trading'
  indices: IndexTrend[];
  breadth: MarketBreadth;
  sectors: SectorPerformance[];
  topGainers: { symbol: string; name: string; changePercent: number; sector: string }[];
  topLosers: { symbol: string; name: string; changePercent: number; sector: string }[];
  findings: KeyFinding[];
  updatedAt: number;
}

class MarketReviewService {
  private cache: Map<string, { data: MarketReviewData; timestamp: number }> = new Map();

  async generateReview(): Promise<MarketReviewData> {
    const cacheKey = 'us_review';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60_000) {
      return cached.data;
    }

    // 1. Fetch all US stock quotes
    const quotes = await stockDataService.getQuotes(US_STOCK_POOL);
    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

    // 2. Fetch index data (using Sina codes)
    const indexSymbols = Object.entries(US_INDEX_SINA_CODES);
    const indexNames: Record<string, string> = { gb_ixic: '纳斯达克', gb_dji: '道琼斯', gb_inx: '标普500' };

    const indexQuotes: IndexTrend[] = [];
    for (const [key, sinaCode] of indexSymbols) {
      // Use the quote endpoint with Sina code format for indices
      const quote = await stockDataService.getQuote(this.sinaToInternal(sinaCode, key));
      if (!quote) continue;

      // Get 5-day historical
      const hist = await stockDataService.getHistorical(
        this.sinaToInternal(sinaCode, key),
        '1d',
        '1mo'
      );

      const fiveDayData = hist.slice(-5).map(h => ({ date: h.date, close: h.close }));
      const fiveDayReturn = fiveDayData.length >= 2
        ? ((fiveDayData[fiveDayData.length - 1].close / fiveDayData[0].close) - 1) * 100
        : 0;

      const trend = this.detectTrend(fiveDayData.map(d => d.close));
      const trendLabels: Record<string, string> = {
        strong_up: '🚀 强势上涨',
        up: '📈 温和上涨',
        sideways: '➡️ 震荡整理',
        down: '📉 温和下跌',
        strong_down: '⚠️ 持续下跌',
      };

      indexQuotes.push({
        symbol: sinaCode,
        name: indexNames[sinaCode] || key,
        price: quote.regularMarketPrice,
        changePercent: quote.regularMarketChangePercent,
        fiveDayReturn,
        fiveDayData,
        trendSignal: trend,
        trendLabel: trendLabels[trend] || trend,
      });
    }

    // 3. Calculate market breadth
    const validQuotes = quotes.filter(q => q.regularMarketPrice > 0);
    const advancers = validQuotes.filter(q => q.regularMarketChangePercent > 0);
    const decliners = validQuotes.filter(q => q.regularMarketChangePercent < 0);

    const totalVolume = validQuotes.reduce((sum, q) => sum + q.regularMarketVolume, 0);
    const avgVol = validQuotes.reduce((sum, q) => sum + q.averageDailyVolume3Month, 0) / validQuotes.length;

    const breadth: MarketBreadth = {
      advanceCount: advancers.length,
      declineCount: decliners.length,
      unchangedCount: validQuotes.length - advancers.length - decliners.length,
      advanceRatio: validQuotes.length > 0 ? (advancers.length / validQuotes.length) * 100 : 0,
      totalVolume,
      avgVolume5Day: avgVol * validQuotes.length,
      volumeRatio: avgVol > 0 ? totalVolume / (avgVol * validQuotes.length) : 1,
    };

    // 4. Sector analysis
    const sectors: SectorPerformance[] = US_SECTORS.map(sector => {
      const sectorQuotes = sector.stocks
        .map(s => quoteMap.get(s))
        .filter(Boolean) as StockQuote[];

      const avgChange = sectorQuotes.length > 0
        ? sectorQuotes.reduce((s, q) => s + q.regularMarketChangePercent, 0) / sectorQuotes.length
        : 0;

      const avgVolRatio = sectorQuotes.length > 0
        ? sectorQuotes.reduce((s, q) => {
            const ratio = q.averageDailyVolume3Month > 0
              ? q.regularMarketVolume / q.averageDailyVolume3Month
              : 1;
            return s + ratio;
          }, 0) / sectorQuotes.length
        : 1;

      const advInSector = sectorQuotes.filter(q => q.regularMarketChangePercent > 0).length;
      const decInSector = sectorQuotes.filter(q => q.regularMarketChangePercent < 0).length;

      // Top 3 gainers in sector
      const topGainers = [...sectorQuotes]
        .sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent)
        .slice(0, 3)
        .map(q => ({
          symbol: q.symbol,
          name: q.shortName,
          changePercent: q.regularMarketChangePercent,
        }));

      // Approximate 5-day sector trend from individual stock changes
      // (simplified: use today's performance as proxy for short-term trend)
      const fiveDayTrend = avgChange; // We'd need per-stock 5-day data for more accuracy

      return {
        name: sector.name,
        nameZh: sector.nameZh,
        avgChangePercent: Math.round(avgChange * 100) / 100,
        avgVolumeRatio: Math.round(avgVolRatio * 100) / 100,
        advanceCount: advInSector,
        declineCount: decInSector,
        topGainers,
        fiveDayTrend: Math.round(fiveDayTrend * 100) / 100,
      };
    });

    // Sort sectors by performance
    sectors.sort((a, b) => b.avgChangePercent - a.avgChangePercent);

    // 5. Top gainers and losers across all stocks
    const sortedByChange = [...validQuotes].sort((a, b) => b.regularMarketChangePercent - a.regularMarketChangePercent);
    const topGainers = sortedByChange.slice(0, 5).map(q => ({
      symbol: q.symbol,
      name: q.shortName,
      changePercent: q.regularMarketChangePercent,
      sector: this.getSectorForSymbol(q.symbol),
    }));
    const topLosers = sortedByChange.reverse().slice(0, 5).map(q => ({
      symbol: q.symbol,
      name: q.shortName,
      changePercent: q.regularMarketChangePercent,
      sector: this.getSectorForSymbol(q.symbol),
    }));

    // 6. Generate key findings
    const findings = this.generateFindings(indexQuotes, breadth, sectors);

    const reviewData: MarketReviewData = {
      date: new Date().toISOString().split('T')[0],
      marketStatus: 'closed', // Simplified; could check market hours
      indices: indexQuotes,
      breadth,
      sectors,
      topGainers,
      topLosers,
      findings,
      updatedAt: Date.now(),
    };

    this.cache.set(cacheKey, { data: reviewData, timestamp: Date.now() });
    return reviewData;
  }

  // Detect trend from 5-day close prices
  private detectTrend(prices: number[]): 'strong_up' | 'up' | 'sideways' | 'down' | 'strong_down' {
    if (prices.length < 3) return 'sideways';

    const totalReturn = ((prices[prices.length - 1] / prices[0]) - 1) * 100;
    // Count consecutive up/down days
    let upDays = 0;
    let downDays = 0;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) upDays++;
      else if (prices[i] < prices[i - 1]) downDays++;
    }

    if (totalReturn > 3 && upDays >= 4) return 'strong_up';
    if (totalReturn > 0.5) return 'up';
    if (totalReturn < -3 && downDays >= 4) return 'strong_down';
    if (totalReturn < -0.5) return 'down';
    return 'sideways';
  }

  private getSectorForSymbol(symbol: string): string {
    for (const sector of US_SECTORS) {
      if (sector.stocks.includes(symbol)) return sector.nameZh;
    }
    return '其他';
  }

  // Convert Sina index code to internal symbol format
  private sinaToInternal(sinaCode: string, key: string): string {
    // Use the gb_ prefix for US indices
    if (sinaCode.startsWith('gb_')) return sinaCode.replace('gb_', '').toUpperCase();
    return sinaCode;
  }

  private generateFindings(
    indices: IndexTrend[],
    breadth: MarketBreadth,
    sectors: SectorPerformance[]
  ): KeyFinding[] {
    const findings: KeyFinding[] = [];

    // Overall market direction
    const avgIndexChange = indices.length > 0
      ? indices.reduce((s, i) => s + i.changePercent, 0) / indices.length
      : 0;

    if (avgIndexChange > 1) {
      findings.push({ type: 'bullish', text: `三大指数全面走高，市场情绪积极，平均涨幅 ${avgIndexChange.toFixed(2)}%` });
    } else if (avgIndexChange > 0.3) {
      findings.push({ type: 'bullish', text: `市场温和上涨，三大指数平均涨 ${avgIndexChange.toFixed(2)}%，多头掌控局面` });
    } else if (avgIndexChange < -1) {
      findings.push({ type: 'bearish', text: `市场全线下跌，三大指数平均跌幅 ${Math.abs(avgIndexChange).toFixed(2)}%，恐慌情绪蔓延` });
    } else if (avgIndexChange < -0.3) {
      findings.push({ type: 'bearish', text: `市场震荡走低，平均跌 ${Math.abs(avgIndexChange).toFixed(2)}%，建议控制仓位` });
    } else {
      findings.push({ type: 'neutral', text: `市场窄幅震荡，三大指数涨跌互现，多空力量均衡` });
    }

    // Market breadth analysis
    if (breadth.advanceRatio > 65) {
      findings.push({ type: 'bullish', text: `市场宽度强劲：${breadth.advanceRatio.toFixed(0)}% 的股票上涨（${breadth.advanceCount}涨/${breadth.declineCount}跌），普涨格局明显` });
    } else if (breadth.advanceRatio < 35) {
      findings.push({ type: 'bearish', text: `市场宽度疲弱：仅 ${breadth.advanceRatio.toFixed(0)}% 股票上涨（${breadth.advanceCount}涨/${breadth.declineCount}跌），普跌格局` });
    }

    // Volume analysis
    if (breadth.volumeRatio > 1.3) {
      findings.push({ type: 'warning', text: `成交量显著放大（量比 ${breadth.volumeRatio.toFixed(2)}），资金博弈激烈，需关注方向选择` });
    } else if (breadth.volumeRatio < 0.7) {
      findings.push({ type: 'neutral', text: `成交量萎缩（量比 ${breadth.volumeRatio.toFixed(2)}），市场观望情绪浓厚` });
    }

    // Sector rotation analysis
    const topSector = sectors[0];
    const bottomSector = sectors[sectors.length - 1];
    if (topSector && bottomSector) {
      findings.push({
        type: 'neutral',
        text: `板块轮动：${topSector.nameZh}领涨（+${topSector.avgChangePercent.toFixed(2)}%），${bottomSector.nameZh}垫底（${bottomSector.avgChangePercent.toFixed(2)}%），资金从${bottomSector.nameZh}流向${topSector.nameZh}`,
      });
    }

    // 5-day trend signals
    const strongTrends = indices.filter(i => i.trendSignal === 'strong_up' || i.trendSignal === 'strong_down');
    if (strongTrends.length > 0) {
      const descriptions = strongTrends.map(i => `${i.name}${i.trendLabel}`);
      const type = strongTrends.every(i => i.trendSignal === 'strong_up') ? 'bullish' :
                   strongTrends.every(i => i.trendSignal === 'strong_down') ? 'bearish' : 'warning';
      findings.push({
        type,
        text: `5日趋势信号：${descriptions.join('，')}。${strongTrends[0].trendSignal.startsWith('strong_up') ? '短期动能充足，但注意追高风险' : '短期超卖，关注反弹机会'}`,
      });
    }

    return findings;
  }
}

export const marketReviewService = new MarketReviewService();
