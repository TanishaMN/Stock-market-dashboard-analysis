// --- ADDED ---
// Import and configure dotenv to read variables from .env
import dotenv from 'dotenv';
dotenv.config();

// --- Original Imports ---
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

// --- ADDED ---
// Import the Supabase client
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3000;

app.use(cors()); // Allow CORS
app.use(express.json()); // --- ADDED: To parse JSON bodies (for POST/DELETE)

// --- Finnhub (Free API) ---
// --- UPDATED: Key is now loaded securely from .env file
const FINNHUB_KEY = process.env.FINNHUB_KEY;

// --- ADDED: Supabase Initialization ---
// Initialize Supabase client with your SERVICE key (secret)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
// ------------------------------------

// --- ADDED: Auth Middleware ---
/**
 * Middleware to protect routes.
 * It verifies the JWT from the frontend and attaches user info to req.
 */
async function protectRoute(req, res, next) {
  // 1. Get the token from the "Authorization" header
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'No token provided. You must be logged in.' });
  }

  // 2. Verify the token with Supabase
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  // 3. Token is valid! Attach user to the request and continue.
  req.user = data.user;
  next();
}
// --------------------------------

// --- Your existing API routes ---

app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length < 2) {
    return res.json({ result: [] });
  }
  const finnhubUrl = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`;
  res.set('Cache-Control', 'no-store');
  console.log(`--- RECEIVED /api/search REQUEST ---`);
  console.log(`Query: "${query}"`);
  console.log(`Fetching Finnhub URL: ${finnhubUrl}`);
  try {
    const resp = await fetch(finnhubUrl);
    const data = await resp.json();
    console.log(`Finnhub Response Status: ${resp.status}`);
    console.log(`Finnhub Response Data Count: ${data.result ? data.result.length : 0}`);
    res.json({ result: data.result || [] });
  } catch (err) {
    console.error('SERVER ERROR:', err);
    res.status(500).json({ result: [], error: 'Server error', details: err.message });
  } finally {
    console.log('--- FINISHED /api/search REQUEST ---');
  }
});

app.get('/api/profile', async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
  try {
    const resp = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/quote', async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
  try {
    const resp = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } // <-- FIXED: Removed extra 's' here
});

app.get('/api/candles', async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  try {
    const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=6mo`);
    const data = await resp.json();

    if (!data.chart.result) return res.status(404).json({ error: 'No candle data' });

    const result = data.chart.result[0];
    const t = result.timestamp;
    const o = result.indicators.quote[0].open;
    const h = result.indicators.quote[0].high;
    const l = result.indicators.quote[0].low;
    const c = result.indicators.quote[0].close;
    const v = result.indicators.quote[0].volume;

    // Convert to Finnhub-style candle array
    const candles = t.map((ts, i) => ({
      t: ts,
      o: o[i],
      h: h[i],
      l: l[i],
      c: c[i],
      v: v[i] // <-- FIXED: Removed extra 'V' here
    }));

    res.json(candles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/logo', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send('URL parameter is required.');
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        // Set the appropriate content type and pipe the image data back
        res.setHeader('Content-Type', response.headers.get('content-type'));
        response.body.pipe(res); // <-- FIXED: Removed extra 'R' here
    } catch (error) {
        console.error('Error proxying image:', error);
        res.status(500).send('Error fetching image.');
    }
});

// --- ADDED: Wishlist API Routes ---

/**
 * GET: Fetch all wishlist items for the logged-in user
 * This route is protected by our 'protectRoute' middleware.
 */
app.get('/api/wishlist', protectRoute, async (req, res) => {
  // req.user was attached by the protectRoute middleware
  const userId = req.user.id; 

  const { data, error } = await supabase
    .from('wishlist')
    .select('id, ticker_symbol, created_at') // Get the ticker, id, etc.
    .eq('user_id', userId); // Filter by the logged-in user

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

/**
 * POST: Add a new item to the user's wishlist
 * This route is also protected.
 */
app.post('/api/wishlist', protectRoute, async (req, res) => {
  const userId = req.user.id;
  const { ticker } = req.body; // Get ticker from frontend request body

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required.' });
  }

  const { data, error } = await supabase
    .from('wishlist')
    .insert([
      { user_id: userId, ticker_symbol: ticker }
    ])
    .select(); // .select() returns the newly created row
  
  if (error) {
    // e.g., if user tries to add a duplicate (if you set a UNIQUE constraint)
    if (error.code === '23505') { 
      return res.status(409).json({ error: 'Ticker already in wishlist.' });
    }
    return res.status(500).json({ error: error.message });
  }
  
  res.status(201).json({ message: 'Ticker added to wishlist!', data: data[0] });
});

/**
 * DELETE: Remove an item from the user's wishlist
 * This route is also protected.
 */
app.delete('/api/wishlist', protectRoute, async (req, res) => {
  const userId = req.user.id;
  const { ticker } = req.body; // Get ticker from request body

  if (!ticker) {
    return res.status(400).json({ error: 'Ticker symbol is required.' }); // <-- FIXED: Was 4000
  }

  const { data, error } = await supabase
    .from('wishlist')
    .delete()
    .eq('user_id', userId) // Must match user
    .eq('ticker_symbol', ticker); // And must match ticker

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ message: 'Ticker removed from wishlist.' });
});
// ----------------------------------

// --- Original Server Listen ---
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));