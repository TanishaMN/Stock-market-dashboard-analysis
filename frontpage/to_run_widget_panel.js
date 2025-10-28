import express from 'express';
import cors from 'cors';
import path from 'path';
import fetch from 'node-fetch'; // Correct for ES modules
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());

// Fix for __dirname and __filename in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (HTML, CSS, JS) from current directory
app.use(express.static(path.join(__dirname)));

// Market endpoints
const endpoints = {
  nasdaq: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EIXIC', // NASDAQ Composite Index
  sp500: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC', // S&P 500
  dowjones: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EDJI' // Dow Jones Industrial Average
};

// Fetch market data
async function getData(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.chart || !data.chart.result) throw new Error("Invalid data");

    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const previous = meta.previousClose;
    const change = (price - previous).toFixed(2);
    const percent = ((change / previous) * 100).toFixed(2);

    return { price, change, percent };
  } catch (err) {
    console.error("Error fetching data from", url, err);
    return null;
  }
}

// API endpoint
app.get('/api/market', async (req, res) => {
  const nasdaq = await getData(endpoints.nasdaq);
  const sp500 = await getData(endpoints.sp500);
  const dowjones = await getData(endpoints.dowjones);
  res.json({ nasdaq, sp500, dowjones });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Server running on port', PORT));
