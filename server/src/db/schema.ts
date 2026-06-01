import { getDb } from './connection.js';

export function initSchema(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS us_daily_market_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trade_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT,
      theme TEXT,
      asset_type TEXT DEFAULT 'stock',
      close REAL,
      prev_close REAL,
      change_pct REAL,
      volume REAL,
      ma20 REAL,
      ma50 REAL,
      ma200 REAL,
      high_20d REAL,
      low_20d REAL,
      below_ma20 INTEGER DEFAULT 0,
      below_ma50 INTEGER DEFAULT 0,
      below_ma200 INTEGER DEFAULT 0,
      volume_vs_avg REAL,
      trend_3d TEXT,
      source TEXT,
      data_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS us_risk_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      risk_dimension TEXT NOT NULL,
      rule_score REAL DEFAULT 0,
      ai_adjustment REAL DEFAULT 0,
      final_score REAL DEFAULT 0,
      risk_level TEXT,
      reasons TEXT,
      source TEXT,
      data_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS us_earnings_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      company_name TEXT,
      earnings_date TEXT,
      earnings_time TEXT,
      importance_level TEXT DEFAULT 'normal',
      expected_eps REAL,
      expected_revenue REAL,
      source TEXT,
      data_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS us_earnings_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      symbol TEXT,
      company_name TEXT,
      period TEXT,
      actual_eps REAL,
      expected_eps REAL,
      actual_revenue REAL,
      expected_revenue REAL,
      guidance_summary TEXT,
      after_hours_change_pct REAL,
      interpretation TEXT,
      source TEXT,
      data_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS us_news_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      event_time TEXT,
      symbol TEXT,
      theme TEXT,
      title TEXT,
      summary TEXT,
      url TEXT,
      importance_level TEXT DEFAULT 'normal',
      impact_type TEXT,
      source TEXT,
      data_time TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS us_daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT UNIQUE NOT NULL,
      title TEXT,
      report_text TEXT,
      market_summary TEXT,
      risk_summary TEXT,
      action_summary TEXT,
      opportunity_summary TEXT,
      data_quality_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_market_data_date ON us_daily_market_data(trade_date);
    CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON us_daily_market_data(symbol);
    CREATE INDEX IF NOT EXISTS idx_market_data_theme ON us_daily_market_data(theme);
    CREATE INDEX IF NOT EXISTS idx_risk_scores_date ON us_risk_scores(report_date);
    CREATE INDEX IF NOT EXISTS idx_earnings_calendar_date ON us_earnings_calendar(earnings_date);
    CREATE INDEX IF NOT EXISTS idx_news_events_date ON us_news_events(report_date);
  `);

  console.log('[DB] Schema initialized — 6 tables ready');
}
