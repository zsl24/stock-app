import { compactSymbol } from '../utils/format';

interface Props {
  watchedSymbols: string[];
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}

export default function Watchlist({ watchedSymbols, onSelect, onRemove }: Props) {
  if (watchedSymbols.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">⭐ 自选股</h3>
        <p className="text-xs text-gray-400">
          点击股票详情页的 ☆ 按钮添加自选股
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">⭐ 自选股 ({watchedSymbols.length})</h3>
      <div className="flex flex-wrap gap-2">
        {watchedSymbols.map((sym) => (
          <div
            key={sym}
            className="flex items-center gap-1 bg-gray-50 hover:bg-blue-50 rounded-lg px-3 py-1.5 group cursor-pointer transition-colors"
            onClick={() => onSelect(sym)}
          >
            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
              {compactSymbol(sym)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(sym);
              }}
              className="text-gray-300 hover:text-red-500 text-xs ml-1 transition-colors"
              title="移除自选"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
