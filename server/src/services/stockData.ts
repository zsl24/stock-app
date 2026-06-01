import axios from 'axios';
import iconv from 'iconv-lite';

// Sina Finance API — free, stable, covers A-shares, US stocks, HK stocks
// Requires Referer header to be set to https://finance.sina.com.cn
// Each request can include multiple symbols separated by comma

const SINA_BASE = 'http://hq.sinajs.cn/list=';

// Stock symbol to Sina API code mapping
function toSinaSymbol(symbol: string): { code: string; market: string } {
  if (symbol.endsWith('.SS')) return { code: 'sh' + symbol.replace('.SS', ''), market: 'cn' };
  if (symbol.endsWith('.SZ')) return { code: 'sz' + symbol.replace('.SZ', ''), market: 'cn' };
  if (symbol.endsWith('.HK')) return { code: 'hk' + symbol.replace('.HK', '').padStart(5, '0'), market: 'hk' };
  // US stock
  return { code: 'gb_' + symbol.toLowerCase(), market: 'us' };
}

// Cache helper
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class StockDataService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private axios = axios.create({
    headers: { Referer: 'https://finance.sina.com.cn' },
    responseType: 'arraybuffer',
    timeout: 10000,
  });

  // Fetch from Sina with GBK decoding
  private async fetchSina(url: string): Promise<string> {
    const resp = await this.axios.get(url);
    return iconv.decode(Buffer.from(resp.data), 'gbk');
  }

  private getCached<T>(key: string, ttl: number): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < ttl) return entry.data as T;
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Parse Sina A-share response
  // Format: name,open,prevClose,price,high,low,volume(shares),turnover,date,time,...
  private parseAShare(symbol: string, raw: string): StockQuote | null {
    const parts = raw.split(',');
    if (parts.length < 32) return null;

    const price = parseFloat(parts[3]) || 0;
    const open = parseFloat(parts[1]) || 0;
    const prevClose = parseFloat(parts[2]) || 0;
    const high = parseFloat(parts[4]) || 0;
    const low = parseFloat(parts[5]) || 0;
    const volume = parseFloat(parts[8]) || 0; // 手
    const turnover = parseFloat(parts[9]) || 0;
    const name = parts[0];

    return {
      symbol,
      shortName: name,
      marketState: 'REGULAR',
      regularMarketPrice: price,
      regularMarketChange: price - prevClose,
      regularMarketChangePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      regularMarketPreviousClose: prevClose,
      regularMarketOpen: open,
      regularMarketDayHigh: high,
      regularMarketDayLow: low,
      regularMarketVolume: volume * 100, // 手 → 股
      averageDailyVolume3Month: volume * 100 * 0.7,
      bid: parseFloat(parts[6]) || 0,
      ask: parseFloat(parts[7]) || 0,
      marketCap: 0, // Sina A-share doesn't include this in basic quote
      trailingPE: 0,
      forwardPE: 0,
      priceToBook: 0,
      returnOnEquity: undefined,
      revenueGrowth: undefined,
      fiftyTwoWeekHigh: high,  // Need separate request for 52w data
      fiftyTwoWeekLow: low,
      fiftyDayAverage: price,
      twoHundredDayAverage: price,
      currency: 'CNY',
      exchangeName: symbol.endsWith('.SS') ? '上海证券交易所' : '深圳证券交易所',
      quoteType: 'EQUITY',
    };
  }

  // Parse Sina US stock response
  // Format: name,price,changePct,time,changeAmt,open,high,low,52wHigh,52wLow,volume,avgVol,marketCap,PE,...
  private parseUS(symbol: string, raw: string): StockQuote | null {
    const parts = raw.split(',');
    if (parts.length < 13) return null;

    const price = parseFloat(parts[1]) || 0;
    const changePercent = parseFloat(parts[2]) || 0;
    const change = parseFloat(parts[4]) || 0;
    const open = parseFloat(parts[5]) || 0;
    const high = parseFloat(parts[6]) || 0;
    const low = parseFloat(parts[7]) || 0;
    const high52w = parseFloat(parts[8]) || 0;
    const low52w = parseFloat(parts[9]) || 0;
    const volume = parseFloat(parts[10]) || 0;
    const avgVol = parseFloat(parts[11]) || 0;
    const marketCap = parseFloat(parts[12]) || 0;
    const pe = parseFloat(parts[13]) || 0;
    const name = parts[0];

    return {
      symbol,
      shortName: name,
      marketState: 'REGULAR',
      regularMarketPrice: price,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      regularMarketPreviousClose: price - change,
      regularMarketOpen: open,
      regularMarketDayHigh: high,
      regularMarketDayLow: low,
      regularMarketVolume: volume,
      averageDailyVolume3Month: avgVol,
      bid: low,
      ask: high,
      marketCap,
      trailingPE: pe,
      forwardPE: pe,
      priceToBook: 0,
      returnOnEquity: undefined,
      revenueGrowth: undefined,
      fiftyTwoWeekHigh: high52w,
      fiftyTwoWeekLow: low52w,
      fiftyDayAverage: price,
      twoHundredDayAverage: price,
      currency: 'USD',
      exchangeName: 'NASDAQ/NYSE',
      quoteType: 'EQUITY',
    };
  }

  // Parse Sina HK stock response
  // Format: engName,chnName,open,prevClose,high,low,price,change,changePct,bid,ask,turnover,volume,...,52wHigh,52wLow,date,time
  private parseHK(symbol: string, raw: string): StockQuote | null {
    const parts = raw.split(',');
    if (parts.length < 17) return null;

    const price = parseFloat(parts[6]) || 0;
    const open = parseFloat(parts[2]) || 0;
    const prevClose = parseFloat(parts[3]) || 0;
    const high = parseFloat(parts[4]) || 0;
    const low = parseFloat(parts[5]) || 0;
    const change = parseFloat(parts[7]) || 0;
    const changePercent = parseFloat(parts[8]) || 0;
    const bid = parseFloat(parts[9]) || 0;
    const ask = parseFloat(parts[10]) || 0;
    const volume = parseFloat(parts[12]) || 0;
    const high52w = parseFloat(parts[15]) || 0;
    const low52w = parseFloat(parts[16]) || 0;
    const name = parts[1] || parts[0];

    return {
      symbol,
      shortName: name,
      marketState: 'REGULAR',
      regularMarketPrice: price,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      regularMarketPreviousClose: prevClose,
      regularMarketOpen: open,
      regularMarketDayHigh: high,
      regularMarketDayLow: low,
      regularMarketVolume: volume,
      averageDailyVolume3Month: volume * 0.7,
      bid,
      ask,
      marketCap: 0, // Not in Sina basic HK quote
      trailingPE: 0,
      forwardPE: 0,
      priceToBook: 0,
      returnOnEquity: undefined,
      revenueGrowth: undefined,
      fiftyTwoWeekHigh: high52w,
      fiftyTwoWeekLow: low52w,
      fiftyDayAverage: price,
      twoHundredDayAverage: price,
      currency: 'HKD',
      exchangeName: '香港交易所',
      quoteType: 'EQUITY',
    };
  }

  // Parse Sina response and extract stock data
  private parseResponse(symbol: string, text: string): StockQuote | null {
    // Extract the string between quotes
    const match = text.match(/"([^"]*)"/);
    if (!match) return null;
    const data = match[1];
    if (!data || data.length < 5) return null;

    const { market } = toSinaSymbol(symbol);
    switch (market) {
      case 'cn': return this.parseAShare(symbol, data);
      case 'us': return this.parseUS(symbol, data);
      case 'hk': return this.parseHK(symbol, data);
      default: return null;
    }
  }

  // Fetch multiple quotes in one request (Sina supports comma-separated symbols)
  async getQuotes(tickers: string[]): Promise<StockQuote[]> {
    const cacheKey = `quotes:${tickers.sort().join(',')}`;
    const cached = this.getCached<StockQuote[]>(cacheKey, 60_000);
    if (cached) return cached;

    try {
      const sinaCodes = tickers.map(t => toSinaSymbol(t).code);
      const url = SINA_BASE + sinaCodes.join(',');
      const text = await this.fetchSina(url);
      const quotes: StockQuote[] = [];
      for (let i = 0; i < tickers.length; i++) {
        // Split by var hq_str_ prefix
        const symbol = tickers[i];
        const prefix = `hq_str_${sinaCodes[i]}=`;
        const startIdx = text.indexOf(prefix);
        if (startIdx < 0) continue;

        // Find the end (next var or end of text)
        const endIdx = text.indexOf('var hq_str_', startIdx + prefix.length);
        const segment = endIdx > 0 ? text.substring(startIdx, endIdx) : text.substring(startIdx);

        const quote = this.parseResponse(symbol, segment);
        if (quote) quotes.push(quote);
      }

      this.setCache(cacheKey, quotes);
      return quotes;
    } catch (err: any) {
      console.error('Failed to fetch quotes:', err.message);
      return [];
    }
  }

  // Fetch single quote
  async getQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `quote:${symbol}`;
    const cached = this.getCached<StockQuote>(cacheKey, 60_000);
    if (cached) return cached;

    try {
      const { code } = toSinaSymbol(symbol);
      const url = SINA_BASE + code;
      const text = await this.fetchSina(url);
      const quote = this.parseResponse(symbol, text);
      if (quote) this.setCache(cacheKey, quote);
      return quote;
    } catch (err: any) {
      console.error(`Failed to fetch quote for ${symbol}:`, err.message);
      return null;
    }
  }

  // Historical data via EastMoney K-line (more reliable for history)
  async getHistorical(
    ticker: string,
    interval: '1d' | '1wk' | '1mo' = '1d',
    period: '1mo' | '3mo' | '6mo' | '1y' | '5y' = '3mo'
  ): Promise<HistoricalDataPoint[]> {
    const cacheKey = `hist:${ticker}:${interval}:${period}`;
    const cached = this.getCached<HistoricalDataPoint[]>(cacheKey, 5 * 60_000);
    if (cached) return cached;

    try {
      // Convert to EastMoney secid for K-line data
      const secid = this.toEastMoneySecid(ticker);
      if (!secid) return [];

      const kltMap: Record<string, string> = { '1d': '101', '1wk': '102', '1mo': '103' };
      const klt = kltMap[interval] || '101';

      const now = new Date();
      const start = new Date(now);
      switch (period) {
        case '1mo': start.setMonth(start.getMonth() - 1); break;
        case '3mo': start.setMonth(start.getMonth() - 3); break;
        case '6mo': start.setMonth(start.getMonth() - 6); break;
        case '1y': start.setFullYear(start.getFullYear() - 1); break;
        case '5y': start.setFullYear(start.getFullYear() - 5); break;
      }

      const beg = start.toISOString().slice(0, 10).replace(/-/g, '');
      const limit = period === '5y' ? 1500 : period === '1y' ? 300 : 120;

      const resp = await axios.get(
        'https://push2his.eastmoney.com/api/qt/stock/kline/get',
        {
          params: {
            secid,
            fields1: 'f1,f2,f3,f4,f5,f6',
            fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
            klt,
            fqt: '1', // 前复权
            beg,
            end: '20500101',
            lmt: limit,
          },
          timeout: 10000,
        }
      );

      const klines = resp.data?.data?.klines ?? [];
      const data: HistoricalDataPoint[] = klines.map((line: string) => {
        const parts = line.split(',');
        return {
          date: parts[0] ?? '',
          open: parseFloat(parts[1]) || 0,
          close: parseFloat(parts[2]) || 0,
          high: parseFloat(parts[3]) || 0,
          low: parseFloat(parts[4]) || 0,
          volume: parseFloat(parts[5]) || 0,
        };
      });

      this.setCache(cacheKey, data);
      return data;
    } catch (err: any) {
      console.error(`Failed to fetch historical for ${ticker}:`, err.message);
      return [];
    }
  }

  // Convert symbol to EastMoney secid for K-line data
  private toEastMoneySecid(symbol: string): string | null {
    if (symbol.endsWith('.SS')) return '1.' + symbol.replace('.SS', '');
    if (symbol.endsWith('.SZ')) return '0.' + symbol.replace('.SZ', '');
    if (symbol.endsWith('.HK')) return '116.' + symbol.replace('.HK', '');
    // US stock — try NASDAQ first
    if (/^[A-Z]+$/.test(symbol)) return '105.' + symbol;
    return null;
  }

  // Market overview via Sina indices
  async getMarketOverview(): Promise<MarketOverview> {
    const cacheKey = 'market_overview';
    const cached = this.getCached<MarketOverview>(cacheKey, 5 * 60_000);
    if (cached) return cached;

    try {
      // Sina index codes
      const indexCodes = [
        { code: 's_sh000001', name: '上证指数', region: 'CN' },
        { code: 's_sz399001', name: '深证成指', region: 'CN' },
        { code: 's_sz399006', name: '创业板指', region: 'CN' },
        { code: 'int_nasdaq', name: '纳斯达克综合', region: 'US' },
        { code: 'int_dji', name: '道琼斯工业', region: 'US' },
        { code: 'rt_hkHSI', name: '恒生指数', region: 'HK' },
      ];

      const url = SINA_BASE + indexCodes.map(i => i.code).join(',');
      const text = await this.fetchSina(url);

      const indices: IndexData[] = [];
      for (const ic of indexCodes) {
        const prefix = `hq_str_${ic.code}=`;
        const startIdx = text.indexOf(prefix);
        if (startIdx < 0) continue;
        const endIdx = text.indexOf('var hq_str_', startIdx + prefix.length);
        const segment = endIdx > 0 ? text.substring(startIdx, endIdx) : text.substring(startIdx);
        const match = segment.match(/"([^"]*)"/);
        if (!match) continue;

        const parts = match[1].split(',');
        // Sina index format varies:
        // s_sh/s_sz: name,price,change,changePct,...
        // rt_hkHSI: HSI,name,...,price,change,changePct,...  (price at idx 6)
        const isHK = ic.code === 'rt_hkHSI';
        const priceIdx = isHK ? 6 : 1;
        const changeIdx = isHK ? 7 : 2;
        const pctIdx = isHK ? 8 : 3;
        const price = parseFloat(parts[priceIdx]) || 0;
        const change = parseFloat(parts[changeIdx]) || 0;
        const changePercent = parseFloat(parts[pctIdx]) || 0;

        indices.push({
          symbol: ic.code,
          name: ic.name,
          region: ic.region,
          price,
          change,
          changePercent,
        });
      }

      const overview: MarketOverview = { indices, updatedAt: Date.now() };
      this.setCache(cacheKey, overview);
      return overview;
    } catch (err: any) {
      console.error('Failed to fetch market overview:', err.message);
      return { indices: [], updatedAt: Date.now() };
    }
  }
}

// Type definitions
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

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketOverview {
  indices: IndexData[];
  updatedAt: number;
}

export interface IndexData {
  symbol: string;
  name: string;
  region: string;
  price: number;
  change: number;
  changePercent: number;
}

export const stockDataService = new StockDataService();
