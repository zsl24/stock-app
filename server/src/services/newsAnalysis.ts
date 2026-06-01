import axios from 'axios';
import { FINNHUB_API_KEY } from '../config.js';

interface NewsItem {
  title: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: number;
  source?: string;
  url?: string;
}

interface FinnhubNewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  category: string;
}

// Positive/negative keyword dictionaries for sentiment analysis
const POSITIVE_KEYWORDS = [
  'beat', 'surge', 'rise', 'gain', 'growth', 'upgrade', 'buy', 'outperform',
  'profit', 'record', 'breakthrough', 'bullish', 'strong', 'positive',
  'dividend', 'buyback', 'expansion', 'partnership', 'launch', 'approval',
  '上涨', '涨停', '利好', '增长', '突破', '创新高', '盈利', '分红',
  '回购', '扩张', '合作', '获批', '超预期',
];

const NEGATIVE_KEYWORDS = [
  'drop', 'fall', 'decline', 'loss', 'downgrade', 'sell', 'underperform',
  'investigation', 'lawsuit', 'layoff', 'cut', 'warning', 'risk', 'bearish',
  'weak', 'negative', 'debt', 'bankruptcy', 'recall', 'fine', 'penalty',
  '下跌', '跌停', '利空', '亏损', '下降', '调查', '诉讼', '裁员',
  '警告', '风险', '债务', '违约', '罚款',
];

class NewsAnalysisService {
  private cache: Map<string, { data: NewsItem[]; timestamp: number }> = new Map();
  private cacheTTL = 10 * 60_000; // 10 minutes

  // Analyze sentiment of text
  analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const lower = text.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;

    for (const kw of POSITIVE_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) positiveScore++;
    }

    for (const kw of NEGATIVE_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) negativeScore++;
    }

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  // Fetch news for a specific stock symbol
  async getNewsForSymbol(symbol: string): Promise<NewsItem[]> {
    const cacheKey = `news:${symbol}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Try Finnhub first if API key is available
    if (FINNHUB_API_KEY) {
      try {
        const news = await this.fetchFinnhubNews(symbol);
        if (news.length > 0) {
          this.cache.set(cacheKey, { data: news, timestamp: Date.now() });
          return news;
        }
      } catch (err) {
        console.warn(`Finnhub news fetch failed for ${symbol}:`, err);
      }
    }

    // Fallback: generate minimal news from stock data
    const fallbackNews = this.generateFallbackNews(symbol);
    this.cache.set(cacheKey, { data: fallbackNews, timestamp: Date.now() });
    return fallbackNews;
  }

  // Fetch news from Finnhub API
  private async fetchFinnhubNews(symbol: string): Promise<NewsItem[]> {
    const cleanSymbol = symbol.replace(/\.(SS|SZ|HK)$/, '');
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const response = await axios.get<FinnhubNewsItem[]>('https://finnhub.io/api/v1/company-news', {
      params: {
        symbol: cleanSymbol,
        from: weekAgo.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
        token: FINNHUB_API_KEY,
      },
      timeout: 10000,
    });

    return (response.data ?? []).slice(0, 20).map((item: FinnhubNewsItem) => ({
      title: item.headline,
      sentiment: this.analyzeSentiment(item.headline + ' ' + (item.summary ?? '')),
      timestamp: item.datetime * 1000,
      source: item.source,
      url: item.url,
    }));
  }

  // Fallback: generate pseudo-news from company fundamentals
  private generateFallbackNews(symbol: string): NewsItem[] {
    // Return empty — we don't want to fabricate news
    // The scoring model handles empty news gracefully with neutral scores
    return [];
  }

  // Batch fetch news for multiple symbols
  async getNewsForSymbols(symbols: string[]): Promise<Map<string, NewsItem[]>> {
    const newsMap = new Map<string, NewsItem[]>();

    // Process in parallel with limit
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (symbol) => {
          const news = await this.getNewsForSymbol(symbol);
          return { symbol, news };
        })
      );

      for (const { symbol, news } of results) {
        newsMap.set(symbol, news);
      }

      // Rate limit delay
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return newsMap;
  }

  // Get market-level news (general market news)
  async getMarketNews(): Promise<NewsItem[]> {
    const cacheKey = 'market_news';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    if (FINNHUB_API_KEY) {
      try {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const response = await axios.get<FinnhubNewsItem[]>('https://finnhub.io/api/v1/news', {
          params: {
            category: 'general',
            token: FINNHUB_API_KEY,
          },
          timeout: 10000,
        });

        const news = (response.data ?? []).slice(0, 20).map((item: FinnhubNewsItem) => ({
          title: item.headline,
          sentiment: this.analyzeSentiment(item.headline + ' ' + (item.summary ?? '')),
          timestamp: item.datetime * 1000,
          source: item.source,
          url: item.url,
        }));

        this.cache.set(cacheKey, { data: news, timestamp: Date.now() });
        return news;
      } catch (err) {
        console.warn('Finnhub market news fetch failed:', err);
      }
    }

    return [];
  }
}

export const newsAnalysisService = new NewsAnalysisService();
export type { NewsItem };
