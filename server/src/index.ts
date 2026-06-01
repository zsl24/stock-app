import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { SERVER_PORT } from './config.js';
import marketRoutes from './routes/market.js';
import stockRoutes from './routes/stocks.js';
import newsRoutes from './routes/news.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : SERVER_PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api/market', marketRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/news', newsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve static frontend files (production mode)
import fs from 'fs';
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback — serve index.html for all non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(clientDist, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) next();
    });
  });
  console.log(`   Static files: ${clientDist}`);
} else {
  console.log(`   ⚠️  Frontend not built — run: cd client && npm run build`);
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📈 StockScope Server running on http://0.0.0.0:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health`);
});
