import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type {
  ApiResponse,
  HotStocksResponse,
  StockDetailResponse,
  MarketOverview,
  MarketTab,
} from '../types';

const api = axios.create({ baseURL: '/api' });

// Fetch hot stocks
export function useHotStocks(market: MarketTab = 'all', topN: number = 20) {
  const [data, setData] = useState<HotStocksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApiResponse<HotStocksResponse>>('/stocks/hot', {
        params: { market, topN },
      });
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError(res.data.error || 'Failed to fetch hot stocks');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [market, topN]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// Fetch stock detail
export function useStockDetail(symbol: string | null) {
  const [quote, setQuote] = useState<StockDetailResponse['quote'] | null>(null);
  const [historical, setHistorical] = useState<StockDetailResponse['historical']>([]);
  const [news, setNews] = useState<StockDetailResponse['news']>([]);
  const [scoring, setScoring] = useState<StockDetailResponse['scoring']>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<ApiResponse<StockDetailResponse>>(`/stocks/${symbol}`);
        if (!cancelled && res.data.success) {
          const d = res.data.data;
          setQuote(d.quote);
          setHistorical(d.historical);
          setNews(d.news);
          setScoring(d.scoring);
        } else if (!cancelled) {
          setError(res.data.error || 'Failed to fetch stock detail');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [symbol]);

  return { quote, historical, news, scoring, loading, error };
}

// Fetch market overview
export function useMarketOverview() {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await api.get<ApiResponse<MarketOverview>>('/market');
        if (!cancelled && res.data.success) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch market overview:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
