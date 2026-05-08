/**
 * GET /api/chart?symbol=RELIANCE&market=IN&interval=D
 * Returns OHLCV candlestick data.
 *
 * Data sources (in priority order):
 *  - D/W intervals → Stooq.com CSV (works from cloud IPs, no key needed)
 *  - Intraday      → Yahoo Finance v8 (query1 → query2 fallback)
 */
import { Router } from 'express'
import axios from 'axios'

const router = Router()

const INTERVAL_MAP = {
  '1':   { yInterval: '1m',  range: '1d',   stooqI: null },
  '5':   { yInterval: '5m',  range: '5d',   stooqI: null },
  '15':  { yInterval: '15m', range: '60d',  stooqI: null },
  '30':  { yInterval: '30m', range: '60d',  stooqI: null },
  '60':  { yInterval: '60m', range: '730d', stooqI: null },
  '240': { yInterval: '60m', range: '730d', stooqI: null },
  'D':   { yInterval: '1d',  range: '10y',  stooqI: 'd'  },
  'W':   { yInterval: '1wk', range: 'max',  stooqI: 'w'  },
}

// ── Ticker conversion helpers ────────────────────────────────────────────────

const YAHOO_SPECIAL = {
  NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', SENSEX: '^BSESN',
  NIFTYMIDCAP: '^NSEMDCP100',
  GOLD: 'GC=F', SILVER: 'SI=F', CRUDEOIL: 'CL=F', NATURALGAS: 'NG=F',
}

function toYahooTicker(symbol, market, yahooKey) {
  if (yahooKey) return yahooKey
  if (market === 'US') return symbol
  return YAHOO_SPECIAL[symbol] || `${symbol}.NS`
}

// Stooq uses lowercase; indices use ^ prefix; futures use .f suffix
function toStooqTicker(yahooTicker, market) {
  // Indices: ^NSEI → ^nsei
  if (yahooTicker.startsWith('^')) return yahooTicker.toLowerCase()
  // Futures: GC=F → gc.f
  if (yahooTicker.endsWith('=F')) return yahooTicker.replace('=F', '').toLowerCase() + '.f'
  // Indian stocks: RELIANCE.NS → reliance.ns
  if (yahooTicker.endsWith('.NS') || yahooTicker.endsWith('.BO')) return yahooTicker.toLowerCase()
  // US stocks: AAPL → aapl.us
  if (market === 'US') return yahooTicker.toLowerCase() + '.us'
  return yahooTicker.toLowerCase()
}

// ── Stooq daily/weekly chart ─────────────────────────────────────────────────

async function fetchStooqChart(stooqTicker, stooqInterval) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqTicker)}&i=${stooqInterval}`
  const { data } = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/csv,text/plain,*/*',
    }
  })

  if (!data || data.includes('No data') || data.trim().length < 20) {
    throw new Error(`No Stooq data for ${stooqTicker}`)
  }

  const lines = data.trim().split('\n')
  // Header: Date,Open,High,Low,Close,Volume
  const candles = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length < 5) continue
    const [dateStr, open, high, low, close, volume] = parts
    if (!dateStr || !close || close.trim() === '') continue
    // Stooq dates are YYYY-MM-DD
    const time = Math.floor(new Date(dateStr.trim()).getTime() / 1000)
    if (isNaN(time)) continue
    const o = parseFloat(open), h = parseFloat(high), l = parseFloat(low), c = parseFloat(close)
    if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c)) continue
    candles.push({ time, open: o, high: h, low: l, close: c, volume: parseInt(volume) || 0 })
  }

  return candles.sort((a, b) => a.time - b.time)
}

// ── Yahoo Finance intraday chart ─────────────────────────────────────────────

const YF_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

async function fetchYahooChart(ticker, yInterval, range) {
  let lastErr
  for (const host of YF_HOSTS) {
    try {
      const { data } = await axios.get(
        `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}`,
        {
          params: { interval: yInterval, range },
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Referer': 'https://finance.yahoo.com',
          }
        }
      )
      const result = data?.chart?.result?.[0]
      if (!result) throw new Error('No result in response')

      const { timestamp, indicators } = result
      const quote = indicators?.quote?.[0]
      if (!timestamp || !quote) throw new Error('Empty result')

      const candles = []
      for (let i = 0; i < timestamp.length; i++) {
        const o = quote.open?.[i], h = quote.high?.[i]
        const l = quote.low?.[i],  c = quote.close?.[i]
        const v = quote.volume?.[i]
        if (o == null || h == null || l == null || c == null) continue
        if (o === 0 && h === 0 && l === 0 && c === 0) continue
        candles.push({
          time: timestamp[i],
          open: +o.toFixed(4), high: +h.toFixed(4),
          low:  +l.toFixed(4), close: +c.toFixed(4),
          volume: v ?? 0,
        })
      }
      return candles
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

// ── Route ────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { symbol, market = 'IN', interval = 'D', yahooKey } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  const cfg = INTERVAL_MAP[interval] || INTERVAL_MAP['D']
  const yahooTicker = toYahooTicker(symbol.toUpperCase(), market, yahooKey)

  try {
    let candles

    if (cfg.stooqI) {
      // Daily / Weekly → Stooq (works from cloud IPs)
      const stooqTicker = toStooqTicker(yahooTicker, market)
      try {
        candles = await fetchStooqChart(stooqTicker, cfg.stooqI)
        console.log(`[chart] Stooq ${stooqTicker}: ${candles.length} candles`)
      } catch (stooqErr) {
        // Stooq failed — fall back to Yahoo Finance
        console.warn(`[chart] Stooq failed (${stooqErr.message}), trying Yahoo`)
        candles = await fetchYahooChart(yahooTicker, cfg.yInterval, cfg.range)
      }
    } else {
      // Intraday → Yahoo Finance
      candles = await fetchYahooChart(yahooTicker, cfg.yInterval, cfg.range)
    }

    // For 240 (4h): aggregate 1h bars into 4h groups
    if (interval === '240' && candles.length > 0) candles = aggregate4h(candles)

    res.json({ symbol: yahooTicker, interval: cfg.yInterval, candles })
  } catch (err) {
    const status = err.response?.status
    const msg = status
      ? `Data provider returned ${status} for ${yahooTicker} — market may be closed or symbol unavailable`
      : (err.message || 'Failed to fetch chart data')
    console.error('[chart]', yahooTicker, msg)
    res.status(500).json({ error: msg })
  }
})

// ── 4h aggregation ───────────────────────────────────────────────────────────

function aggregate4h(candles) {
  const groups = {}
  for (const c of candles) {
    const bucket = Math.floor(c.time / (4 * 3600)) * (4 * 3600)
    if (!groups[bucket]) {
      groups[bucket] = { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }
    } else {
      const g = groups[bucket]
      g.high   = Math.max(g.high, c.high)
      g.low    = Math.min(g.low,  c.low)
      g.close  = c.close
      g.volume += c.volume
    }
  }
  return Object.values(groups).sort((a, b) => a.time - b.time)
}

export default router
