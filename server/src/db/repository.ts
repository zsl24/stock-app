import { getDb } from './connection.js';

// --- Market Data ---
export interface MarketDataRow {
  trade_date: string;
  symbol: string;
  name?: string;
  theme?: string;
  asset_type?: string;
  close?: number;
  prev_close?: number;
  change_pct?: number;
  volume?: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  high_20d?: number;
  low_20d?: number;
  below_ma20?: number;
  below_ma50?: number;
  below_ma200?: number;
  volume_vs_avg?: number;
  trend_3d?: string;
  source?: string;
  data_time?: string;
}

export function upsertMarketData(rows: MarketDataRow[]): void {
  const db = getDb();

  // Delete existing rows for same date+symbol, then insert
  const deleteStmt = db.prepare('DELETE FROM us_daily_market_data WHERE trade_date = ? AND symbol = ?');
  const insertStmt = db.prepare(`
    INSERT INTO us_daily_market_data (
      trade_date, symbol, name, theme, asset_type, close, prev_close, change_pct, volume,
      ma20, ma50, ma200, high_20d, low_20d,
      below_ma20, below_ma50, below_ma200, volume_vs_avg, trend_3d, source, data_time
    ) VALUES (
      @trade_date, @symbol, @name, @theme, @asset_type, @close, @prev_close, @change_pct, @volume,
      @ma20, @ma50, @ma200, @high_20d, @low_20d,
      @below_ma20, @below_ma50, @below_ma200, @volume_vs_avg, @trend_3d, @source, @data_time
    )
  `);

  const upsert = db.transaction((rows: MarketDataRow[]) => {
    for (const row of rows) {
      deleteStmt.run(row.trade_date, row.symbol);
      insertStmt.run(row);
    }
  });

  upsert(rows);
}

export function getMarketDataByDate(date: string): MarketDataRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM us_daily_market_data WHERE trade_date = ?').all(date) as MarketDataRow[];
}

// --- Risk Scores ---
export interface RiskScoreRow {
  report_date: string;
  risk_dimension: string;
  rule_score: number;
  ai_adjustment?: number;
  final_score: number;
  risk_level: string;
  reasons: string;
  source?: string;
  data_time?: string;
}

export function saveRiskScores(rows: RiskScoreRow[]): void {
  const db = getDb();
  // Delete old scores for this date before inserting
  if (rows.length > 0) {
    db.prepare('DELETE FROM us_risk_scores WHERE report_date = ?').run(rows[0].report_date);
  }
  const stmt = db.prepare(`
    INSERT INTO us_risk_scores (report_date, risk_dimension, rule_score, ai_adjustment, final_score, risk_level, reasons, source, data_time)
    VALUES (@report_date, @risk_dimension, @rule_score, @ai_adjustment, @final_score, @risk_level, @reasons, @source, @data_time)
  `);
  const insertMany = db.transaction((rows: RiskScoreRow[]) => {
    for (const row of rows) {
      stmt.run(row);
    }
  });
  insertMany(rows);
}

export function getRiskScoresByDate(date: string): RiskScoreRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM us_risk_scores WHERE report_date = ?').all(date) as RiskScoreRow[];
}

// --- Daily Reports ---
export interface DailyReportRow {
  report_date: string;
  title?: string;
  report_text?: string;
  market_summary?: string;
  risk_summary?: string;
  action_summary?: string;
  opportunity_summary?: string;
  data_quality_notes?: string;
}

export function upsertDailyReport(report: DailyReportRow): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO us_daily_reports (report_date, title, report_text, market_summary, risk_summary, action_summary, opportunity_summary, data_quality_notes, updated_at)
    VALUES (@report_date, @title, @report_text, @market_summary, @risk_summary, @action_summary, @opportunity_summary, @data_quality_notes, datetime('now'))
    ON CONFLICT(report_date) DO UPDATE SET
      title=excluded.title, report_text=excluded.report_text,
      market_summary=excluded.market_summary, risk_summary=excluded.risk_summary,
      action_summary=excluded.action_summary, opportunity_summary=excluded.opportunity_summary,
      data_quality_notes=excluded.data_quality_notes, updated_at=datetime('now')
  `).run(report);
}

export function getDailyReportByDate(date: string): DailyReportRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM us_daily_reports WHERE report_date = ?').get(date) as DailyReportRow | undefined;
}

export function getLatestDailyReport(): DailyReportRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM us_daily_reports ORDER BY report_date DESC LIMIT 1').get() as DailyReportRow | undefined;
}

// --- Earnings ---
export function clearEarningsForDate(date: string): void {
  getDb().prepare('DELETE FROM us_earnings_calendar WHERE report_date = ?').run(date);
}

export function insertEarnings(rows: Array<{
  report_date: string;
  symbol: string;
  company_name?: string;
  earnings_date?: string;
  earnings_time?: string;
  importance_level?: string;
  expected_eps?: number;
  expected_revenue?: number;
  source?: string;
  data_time?: string;
}>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO us_earnings_calendar (report_date, symbol, company_name, earnings_date, earnings_time, importance_level, expected_eps, expected_revenue, source, data_time)
    VALUES (@report_date, @symbol, @company_name, @earnings_date, @earnings_time, @importance_level, @expected_eps, @expected_revenue, @source, @data_time)
  `);
  db.transaction((rows: any[]) => { for (const r of rows) stmt.run(r); })(rows);
}

export function getEarningsByDateRange(startDate: string, endDate: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM us_earnings_calendar WHERE earnings_date BETWEEN ? AND ? ORDER BY earnings_date').all(startDate, endDate);
}

// --- News ---
export function clearNewsForDate(date: string): void {
  getDb().prepare('DELETE FROM us_news_events WHERE report_date = ?').run(date);
}

export function insertNews(rows: Array<{
  report_date: string;
  event_time?: string;
  symbol?: string;
  theme?: string;
  title: string;
  summary?: string;
  url?: string;
  importance_level?: string;
  impact_type?: string;
  source?: string;
  data_time?: string;
}>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO us_news_events (report_date, event_time, symbol, theme, title, summary, url, importance_level, impact_type, source, data_time)
    VALUES (@report_date, @event_time, @symbol, @theme, @title, @summary, @url, @importance_level, @impact_type, @source, @data_time)
  `);
  db.transaction((rows: any[]) => { for (const r of rows) stmt.run(r); })(rows);
}

export function getNewsByDate(date: string) {
  return getDb().prepare('SELECT * FROM us_news_events WHERE report_date = ? ORDER BY importance_level DESC').all(date);
}
