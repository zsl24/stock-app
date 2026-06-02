import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type {
  MarketReviewData,
  GenerateReportResponse,
  LatestReportResponse,
  RiskDimension,
} from '../types';
import { formatPercent } from '../utils/format';

const riskLevelColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  extreme: 'bg-red-100 text-red-700',
};

const riskEmoji: Record<string, string> = {
  low: '🟢', medium: '🟡', high: '🟠', extreme: '🔴',
};

export default function MarketReview() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<MarketReviewData | null>(null);
  const [fullReport, setFullReport] = useState<GenerateReportResponse | null>(null);
  const [savedReport, setSavedReport] = useState<LatestReportResponse['report'] | null>(null);
  const [savedRiskScores, setSavedRiskScores] = useState<LatestReportResponse['riskScores']>([]);

  // Load saved report on mount
  useEffect(() => {
    loadSavedReport();
    loadBasicReview();
  }, []);

  const loadSavedReport = async () => {
    try {
      const res = await axios.get('/api/review/reports/latest');
      if (res.data.success && res.data.data.hasData) {
        setSavedReport(res.data.data.report);
        setSavedRiskScores(res.data.data.riskScores || []);
      }
    } catch {
      // no saved report yet
    } finally {
      setLoading(false);
    }
  };

  const loadBasicReview = async () => {
    try {
      const res = await axios.get('/api/review/us');
      if (res.data.success) setReview(res.data.data);
    } catch {
      // basic review unavailable
    }
  };

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await axios.post('/api/review/generate', { date: today });
      if (res.data.success) {
        setFullReport(res.data.data);
        // Reload saved report
        await loadSavedReport();
      } else {
        setError(res.data.error || 'Generation failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Network error');
    } finally {
      setGenerating(false);
    }
  }, []);

  const riskScores = fullReport?.riskScores?.dimensions ||
    savedRiskScores.map(r => ({
      dimension: r.risk_dimension,
      dimensionZh: dimensionNames[r.risk_dimension] || r.risk_dimension,
      ruleScore: r.rule_score,
      aiAdjustment: 0,
      finalScore: r.final_score,
      riskLevel: r.risk_level,
      riskLevelZh: riskLevelNames[r.risk_level] || r.risk_level,
      reasons: r.reasons ? r.reasons.split('；') : [],
    } as RiskDimension));

  const macroData = fullReport?.macroData || [];
  const reportText = fullReport?.dailyReport?.reportText || savedReport?.report_text || '';
  const dataMissing = fullReport?.dataMissing || (savedReport?.data_quality_notes ? savedReport.data_quality_notes.split('\n').filter(Boolean) : []);

  // Show report text with simple markdown rendering
  const renderReportText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h3 key={i} className="text-base font-bold text-gray-800 mt-4 mb-2">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('### ')) {
        return <h4 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('|')) {
        return <div key={i} className="font-mono text-xs text-gray-600 whitespace-pre overflow-x-auto">{line}</div>;
      }
      if (line.trim() === '---') {
        return <hr key={i} className="my-3 border-gray-200" />;
      }
      if (line.startsWith('⚠️') || line.startsWith('**')) {
        return <p key={i} className="text-xs text-gray-500 my-1 italic">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.trim()) {
        return <p key={i} className="text-sm text-gray-700 leading-relaxed my-1">{line}</p>;
      }
      return <br key={i} />;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-40 mb-3" />
            <div className="h-40 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header with generate button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">📊 美股盘后复盘日报</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {savedReport ? `最新日报：${savedReport.report_date}` : '暂无日报'}
            {review && ` · ${review.marketStatus === 'closed' ? '🔴 已收盘' : '🟢 交易中'}`}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {generating ? '⏳ 生成中...' : '🔄 生成/刷新今日日报'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Data quality warnings */}
      {dataMissing.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 space-y-1">
          <span className="font-semibold">⚠️ 数据缺失提示：</span>
          {dataMissing.map((m, i) => <span key={i} className="ml-2">· {m}</span>)}
        </div>
      )}

      {/* Market Overview Cards */}
      {review && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {review.indices.slice(0, 3).map(idx => (
            <div key={idx.symbol} className="card">
              <div className="text-xs text-gray-400 mb-1">{idx.name}</div>
              <div className="text-lg font-bold text-gray-900">{idx.price.toLocaleString()}</div>
              <span className={idx.changePercent >= 0 ? 'badge-up' : 'badge-down'}>
                {formatPercent(idx.changePercent)}
              </span>
            </div>
          ))}
          <div className="card">
            <div className="text-xs text-gray-400 mb-1">市场宽度</div>
            <div className="text-lg font-bold text-gray-900">{review.breadth.advanceRatio.toFixed(0)}%</div>
            <span className="text-xs text-gray-400">{review.breadth.advanceCount}↑/{review.breadth.declineCount}↓</span>
          </div>
          <div className="card">
            <div className="text-xs text-gray-400 mb-1">总成交</div>
            <div className="text-lg font-bold text-gray-900">{review.breadth.volumeRatio.toFixed(2)}x</div>
            <span className="text-xs text-gray-400">vs 5日均值</span>
          </div>
          {/* Macro indicators */}
          {macroData.filter(m => m.available).slice(0, 2).map(m => (
            <div key={m.symbol} className="card">
              <div className="text-xs text-gray-400 mb-1">{m.name}</div>
              <div className="text-lg font-bold text-gray-900">{m.price?.toFixed(2) || '-'}</div>
              <span className={m.changePct && m.changePct >= 0 ? 'badge-up' : 'badge-down'}>
                {m.changePct !== null ? formatPercent(m.changePct) : '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Risk Score Table */}
      {riskScores.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            🔴 风险评分 {fullReport?.riskScores ? `— ${riskEmoji[fullReport.riskScores.overallLevel]} ${fullReport.riskScores.overallLevelZh} ${fullReport.riskScores.overallScore}/100` : ''}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400">
                  <th className="text-left py-2 pr-4">维度</th>
                  <th className="text-right py-2 px-2">分数</th>
                  <th className="text-center py-2 px-2">等级</th>
                  <th className="text-left py-2 pl-4">主要原因</th>
                </tr>
              </thead>
              <tbody>
                {riskScores.map(dim => (
                  <tr key={dim.dimension} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-700">{dim.dimensionZh}</td>
                    <td className="py-2 px-2 text-right font-bold text-gray-900">{dim.finalScore || dim.ruleScore}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${riskLevelColors[dim.riskLevel] || 'bg-gray-100'}`}>
                        {dim.riskLevelZh}
                      </span>
                    </td>
                    <td className="py-2 pl-4 text-gray-500 max-w-xs truncate">{dim.reasons?.slice(0, 2).join('；') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fullReport?.riskScores && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
              评分引擎：{fullReport.riskScores.source} | AI修正：未启用
            </div>
          )}
        </div>
      )}

      {/* Full Report Text */}
      {reportText && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">📝 日报正文</h3>
          <div className="prose prose-sm max-w-none">{renderReportText(reportText)}</div>
        </div>
      )}

      {/* If no report yet, show prompt */}
      {!reportText && !generating && (
        <div className="card text-center py-8">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500 mb-4">暂无日报数据。点击上方按钮生成今日美股盘后复盘日报。</p>
        </div>
      )}

      {/* Sector Performance (from basic review) */}
      {review && review.sectors.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">🏭 板块表现</h3>
          <div className="space-y-1.5">
            {review.sectors.map(sec => (
              <div key={sec.name} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-20">{sec.nameZh}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${sec.avgChangePercent >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                    style={{
                      width: `${Math.min(Math.abs(sec.avgChangePercent) * 8, 48)}%`,
                      marginLeft: sec.avgChangePercent >= 0 ? '50%' : `${50 - Math.min(Math.abs(sec.avgChangePercent) * 8, 48)}%`,
                    }}
                  />
                </div>
                <span className={`font-semibold w-16 text-right ${sec.avgChangePercent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatPercent(sec.avgChangePercent)}
                </span>
                <span className="text-gray-400 w-16 text-right">{sec.advanceCount}↑/{sec.declineCount}↓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Findings */}
      {review && review.findings.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">💡 关键发现</h3>
          <div className="space-y-2">
            {review.findings.map((f, i) => (
              <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg ${
                f.type === 'bullish' ? 'bg-green-50' :
                f.type === 'bearish' ? 'bg-red-50' :
                f.type === 'warning' ? 'bg-amber-50' : 'bg-gray-50'
              }`}>
                <span className="text-lg">{{ bullish: '🐂', bearish: '🐻', neutral: '📊', warning: '⚠️' }[f.type]}</span>
                <p className="text-sm text-gray-700">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const dimensionNames: Record<string, string> = {
  index: '指数风险', tech: '科技股风险', semiconductor: '半导体风险',
  optical: '光通信风险', gold_silver: '金银风险', macro: '宏观风险',
};

const riskLevelNames: Record<string, string> = {
  low: '低风险', medium: '中性', high: '高风险', extreme: '极高风险',
};
