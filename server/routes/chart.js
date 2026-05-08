/**
 * GET /api/chart?symbol=RELIANCE&market=IN&interval=D
 * Returns OHLCV candlestick data from Yahoo Finance.
 * interval: 1 | 5 | 15 | 30 | 60 | 240 | D | W
 */
import { Router } from 'express'
import axios from 'axios'

const router = Router()

// Map our interval codes to Yahoo Finance params
const INTERVAL_MAP = {
  '1':   { yInterval: '1m',  range: '1d'  },
  '5':   { yInterval: '5m',  range: '5d'  },
  '15':  { yInterval: '15m', range: '60d' },
  '30':  { yInterval: '30m', range: '60d' },
  '60':  { yInterval: '60m', range: '730d' },
  '240': { yInterval: '60m', range: '730d' }, // 4h: fetch 1h + aggregate
  'D':   { yInterval: '1d',  range: '10y' },
  'W':   { yInterval: '1wk', range: 'max' },
}

// Map symbol+market → Yahoo Finance ticker
function toYahooTicker(symbol, market, yahooKey) {
  if (yahooKey) return yahooKey
  if (market === 'US') return symbol
  // Indian — derive from symbol
  const SPECIAL = {
    NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', SENSEX: '^BSESN',
    NIFTYMIDCAP: '^NSEMDCP100',
    GOLD: 'GC=F', SILVER: 'SI=F', CRUDEOIL: 'CL=F', NATURALGAS: 'NG=F',
  }
  return SPECIAL[symbol] || `${symbol}.NS`
}

router.get('/', async (req, res) => {
  const { symbol, market = 'IN', interval = 'D', yahooKey } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  const cfg = INTERVAL_MAP[interval] || INTERVAL_MAP['D']
  const ticker = toYahooTicker(symbol.toUpperCase(), market, yahooKey)

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`
    const { data } = await axios.get(url, {
      params: { interval: cfg.yInterval, range: cfg.range },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    })

    const result = data?.chart?.result?.[0]
    if (!result) return res.status(404).json({ error: 'No data returned' })

    const { timestamp, indicators } = result
    const quote = indicators?.quote?.[0]
    if (!timestamp || !quote) return res.status(404).json({ error: 'Empty data' })

    // Build candles — skip bars with null/zero OHLC (market closed gaps)
    const candles = []
    for (let i = 0; i < timestamp.length; i++) {
      const o = quote.open?.[i]
      const h = quote.high?.[i]
      const l = quote.low?.[i]
      const c = quote.close?.[i]
      const v = quote.volume?.[i]
      if (o == null || h == null || l == null || c == null) continue
      if (o === 0 && h === 0 && l === 0 && c === 0) continue
      candles.push({
        time: timestamp[i],  // unix seconds
        open: +o.toFixed(4),
        high: +h.toFixed(4),
        low:  +l.toFixed(4),
        close: +c.toFixed(4),
        volume: v ?? 0,
      })
    }

    // For 240 (4h): aggregate 1h bars into 4h groups
    let output = candles
    if (interval === '240' && candles.length > 0) {
      output = aggregate4h(candles)
    }

    res.json({ symbol: ticker, interval: cfg.yInterval, candles: output })
  } catch (err) {
    console.error('[chart]', ticker, err.message)
    res.status(500).json({ error: err.message })
  }
})

// Aggregate 1-hour candles into 4-hour candles
function aggregate4h(candles) {
  const groups = {}
  for (const c of candles) {
    // Group by 4h bucket: floor to nearest 4h
    const bucket = Math.floor(c.time / (4 * 3600)) * (4 * 3600)
    if (!groups[bucket]) {
      groups[bucket] = { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }
    } else {
      const g = groups[bucket]
      g.high = Math.max(g.high, c.high)
      g.low  = Math.min(g.low,  c.low)
      g.close = c.close
      g.volume += c.volume
    }
  }
  return Object.values(groups).sort((a, b) => a.time - b.time)
}

export default router
