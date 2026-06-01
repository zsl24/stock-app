import type { FactorScores } from '../types';
import { getScoreBgColor, getScoreColor } from '../utils/format';

interface Props {
  scores: FactorScores;
  compositeScore: number;
}

const FACTORS = [
  { key: 'priceChangeScore' as const, label: '涨跌幅', weight: 15, category: '技术面' },
  { key: 'volumeRatioScore' as const, label: '量比', weight: 10, category: '技术面' },
  { key: 'rsiScore' as const, label: '相对强度', weight: 10, category: '技术面' },
  { key: 'breakoutScore' as const, label: '突破信号', weight: 5, category: '技术面' },
  { key: 'peScore' as const, label: 'PE估值', weight: 10, category: '基本面' },
  { key: 'roeScore' as const, label: 'ROE', weight: 10, category: '基本面' },
  { key: 'growthScore' as const, label: '营收增长', weight: 10, category: '基本面' },
  { key: 'newsVolumeScore' as const, label: '新闻热度', weight: 10, category: '情绪面' },
  { key: 'newsSentimentScore' as const, label: '新闻情绪', weight: 15, category: '情绪面' },
  { key: 'analystScore' as const, label: '机构评级', weight: 5, category: '情绪面' },
];

export default function FactorBreakdown({ scores, compositeScore }: Props) {
  // Group factors by category
  const categories = ['技术面', '基本面', '情绪面'];
  const grouped = categories.map((cat) => ({
    name: cat,
    factors: FACTORS.filter((f) => f.category === cat),
    totalWeight: FACTORS.filter((f) => f.category === cat).reduce((s, f) => s + f.weight, 0),
  }));

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">🔬 多因子分析</h3>

      {/* Composite Score Highlight */}
      <div className="text-center mb-5">
        <div className="text-3xl font-bold mb-1">
          <span className={getScoreColor(compositeScore)}>
            {compositeScore.toFixed(0)}
          </span>
          <span className="text-gray-300 text-lg">/100</span>
        </div>
        <div className="text-xs text-gray-400">综合得分</div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.name}>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>{group.name}</span>
              <span>权重 {group.totalWeight}%</span>
            </div>
            {group.factors.map((factor) => {
              const score = scores[factor.key];
              return (
                <div key={factor.key} className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{factor.label}</span>
                    <span className="text-gray-400">权重 {factor.weight}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${getScoreBgColor(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${getScoreColor(score)} w-8 text-right`}>
                      {score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
