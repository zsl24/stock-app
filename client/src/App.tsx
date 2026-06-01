import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">StockScope</h1>
              <p className="text-xs text-gray-400">全球股票多因子分析</p>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            数据来源: Yahoo Finance
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6">
        <Dashboard />
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-6 border-t border-gray-200 mt-8">
        <p className="text-center text-xs text-gray-400">
          ⚠️ 本工具仅供研究参考，不构成任何投资建议。投资有风险，入市需谨慎。
        </p>
      </footer>
    </div>
  );
}

export default App;
