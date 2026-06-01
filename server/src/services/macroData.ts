import axios from 'axios';
import iconv from 'iconv-lite';

// Macro indicator data using Sina Finance API
// Some macro symbols may not be available via Sina — we handle each case

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

// Sina codes that have been tested and work for macro data
const SINA_MACRO_CODES: Record<string, { code: string; name: string }> = {
  VIX: { code: 'gb_vix', name: '恐慌指数 VIX' },
  DXY: { code: 'gb_dxy', name: '美元指数' },
  GOLD: { code: 'hf_GC', name: '黄金期货' },
  SILVER: { code: 'hf_SI', name: '白银期货' },
  US10Y: { code: 'gb_tnx', name: '10年期美债收益率' },
};

async function fetchSinaQuote(sinaCode: string): Promise<string | null> {
  try {
    const resp = await axios.get(`http://hq.sinajs.cn/list=${sinaCode}`, {
      headers: { Referer: 'https://finance.sina.com.cn' },
      responseType: 'arraybuffer',
      timeout: 8000,
    });
    return iconv.decode(Buffer.from(resp.data), 'gbk');
  } catch {
    return null;
  }
}

function parseIndexValue(text: string): { price: number | null; changePct: number | null } {
  const match = text.match(/"([^"]*)"/);
  if (!match || !match[1]) return { price: null, changePct: null };

  const parts = match[1].split(',');
  if (parts.length < 2) return { price: null, changePct: null };

  // Sina global index format: name,price,changePct,...
  // Sina futures format may differ
  const price = parseFloat(parts[1]);
  const changePct = parseFloat(parts[2]);

  return {
    price: isNaN(price) ? null : price,
    changePct: isNaN(changePct) ? null : changePct,
  };
}

export async function fetchMacroData(): Promise<MacroIndicator[]> {
  const results: MacroIndicator[] = [];
  const now = new Date().toISOString();
  const codes = Object.entries(SINA_MACRO_CODES);

  // Fetch all macro codes in one request
  const allCodes = codes.map(([, v]) => v.code).join(',');
  const text = await fetchSinaQuote(allCodes);

  for (const [key, info] of codes) {
    if (!text) {
      results.push({
        symbol: key,
        name: info.name,
        price: null,
        changePct: null,
        available: false,
        error: 'API 无响应',
        dataTime: now,
        source: 'Sina Finance',
      });
      continue;
    }

    // Find this indicator's segment in the response
    const prefix = `hq_str_${info.code}=`;
    const startIdx = text.indexOf(prefix);
    if (startIdx < 0) {
      results.push({
        symbol: key,
        name: info.name,
        price: null,
        changePct: null,
        available: false,
        error: '数据不可用（新浪不支持此标的）',
        dataTime: now,
        source: 'Sina Finance',
      });
      continue;
    }

    const endIdx = text.indexOf('var hq_str_', startIdx + prefix.length);
    const segment = endIdx > 0 ? text.substring(startIdx, endIdx) : text.substring(startIdx);

    const { price, changePct } = parseIndexValue(segment);

    results.push({
      symbol: key,
      name: info.name,
      price,
      changePct,
      available: price !== null,
      error: price === null ? '解析失败' : undefined,
      dataTime: now,
      source: 'Sina Finance',
    });
  }

  return results;
}

// Get a summary map for easy lookup
export async function getMacroSnapshot(): Promise<Map<string, MacroIndicator>> {
  const indicators = await fetchMacroData();
  const map = new Map<string, MacroIndicator>();
  for (const ind of indicators) {
    map.set(ind.symbol, ind);
  }
  return map;
}
