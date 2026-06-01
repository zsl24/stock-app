import { FINNHUB_API_KEY } from '../config.js';
import axios from 'axios';

export interface EarningsEvent {
  symbol: string;
  companyName?: string;
  earningsDate: string;       // YYYY-MM-DD
  earningsTime?: string;      // 'bmo' (before market open) | 'amc' (after market close)
  importanceLevel: string;    // 'high' | 'normal'
  expectedEps?: number;
  expectedRevenue?: number;
  actualEps?: number;
  actualRevenue?: number;
  guidanceSummary?: string;
  afterHoursChangePct?: number;
  interpretation?: string;
  source: string;
  dataTime: string;
  available: boolean;
  error?: string;
}

export interface EarningsResult {
  events: EarningsEvent[];
  available: boolean;
  error?: string;
  source: string;
  dataTime: string;
}

// Try Finnhub API for earnings calendar
async function fetchFinnhubEarnings(symbols: string[], fromDate: string, toDate: string): Promise<EarningsEvent[]> {
  if (!FINNHUB_API_KEY) return [];

  const events: EarningsEvent[] = [];
  const now = new Date().toISOString();

  for (const symbol of symbols) {
    try {
      const resp = await axios.get('https://finnhub.io/api/v1/calendar/earnings', {
        params: { symbol, from: fromDate, to: toDate, token: FINNHUB_API_KEY },
        timeout: 10000,
      });

      const data = resp.data;
      if (!data?.earningsCalendar?.length) continue;

      for (const item of data.earningsCalendar) {
        events.push({
          symbol: item.symbol || symbol,
          companyName: undefined,
          earningsDate: item.date || '',
          earningsTime: item.hour === 'bmo' ? 'bmo' : item.hour === 'amc' ? 'amc' : undefined,
          importanceLevel: ['NVDA', 'AVGO', 'MSFT', 'AAPL', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD', 'INTC', 'QCOM'].includes(symbol) ? 'high' : 'normal',
          expectedEps: item.epsEstimate,
          expectedRevenue: item.revenueEstimate,
          source: 'Finnhub',
          dataTime: now,
          available: true,
        });
      }
    } catch (err: any) {
      console.warn(`[Earnings] Finnhub fetch failed for ${symbol}: ${err.message}`);
    }
  }

  return events;
}

export async function getEarningsCalendar(
  watchlistSymbols: string[],
  fromDate: string,
  toDate: string
): Promise<EarningsResult> {
  const now = new Date().toISOString();

  // Try Finnhub first
  if (FINNHUB_API_KEY) {
    const events = await fetchFinnhubEarnings(watchlistSymbols, fromDate, toDate);
    if (events.length > 0) {
      return {
        events,
        available: true,
        source: 'Finnhub',
        dataTime: now,
      };
    }
  }

  // No data source available
  return {
    events: [],
    available: false,
    error: '财报数据缺失，请配置 FINNHUB_API_KEY 环境变量以获取财报日历。也可手动导入 earnings_calendar.csv。',
    source: 'none',
    dataTime: now,
  };
}

// Manual import placeholder — future enhancement
export function importEarningsFromCSV(_csvPath: string): void {
  // TODO: Implement CSV import for manual earnings data entry
  throw new Error('CSV import not yet implemented. Please configure FINNHUB_API_KEY instead.');
}
