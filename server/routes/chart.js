/**
 * GET /api/chart?symbol=RELIANCE&market=IN&interval=D
 * Returns OHLCV candlestick data.
 *
 * Primary:  Twelve Data API (works from cloud IPs, 800 free calls/day)
 * Fallback: Yahoo Finance v8 (query1 → query2, may be rate-limited on cloud)
 */
import { Router } from 'express'
import axios from 'axios'

const router = Router()

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_KEY

const INTERVAL_MAP = {
  '1':   { tdInterval: '1min',  yInterval: '1m',  range: '1d'   },
  '5':   { tdInterval: '5min',  yInterval: '5m',  range: '5d'   },
  '15':  { tdInterval: '15min', yInterval: '15m', range: '60d'  },
  '30':  { tdInterval: '30min', yInterval: '30m', range: '60d'  },
  '60':  { tdInterval: '1h',    yInterval: '60m', range: '730d' },
  '240': { tdInterval: '4h',    yInterval: '60m', range: '730d' },
  'D':   { tdInterval: '1day',  yInterval: '1d',  range: '10y'  },
  'W':   { tdInterval: '1week', yInterval: '1wk', range: 'max'  },
}

// ── Ticker helpers ───────────────────────────────────────────────────────────

const YAHOO_SPECIAL = {
  NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', SENSEX: '^BSESN',
  NIFTYMIDCAP: '^NSEMDCP100',
  GOLD: 'GC=F', SILVER: 'SI=F', CRUDEOIL: 'CL=F', NATURALGAS: 'NG=F',
}

// Twelve Data symbol format for Indian stocks: RELIANCE:NSE
const TD_SPECIAL = {
  '^NSEI':    { symbol: 'NIFTY 50',  exchange: 'INDICES' },
  '^NSEBANK': { symbol: 'NIFTY BANK', exchange: 'INDICES' },
  '^BSESN':   { symbol: 'SENSEX',    exchange: 'INDICES' },
  'GC=F':     { symbol: 'XAU/USD',   exchange: 'Forex'   },
  'SI=F':     { symbol: 'XAG/USD',   exchange: 'Forex'   },
  'CL=F':     { symbol: 'WTI/USD',   exchange: 'Forex'   },
}

function toYahooTicker(symbol, market, yahooKey) {
  if (yahooKey) return yahooKey
  if (market === 'US') return symbol
  return YAHOO_SPECIAL[symbol] || `${symbol}.NS`
}

function toTwelveDataParams(yahooTicker, market) {
  if (TD_SPECIAL[yahooTicker]) return TD_SPECIAL[yahooTicker]
  if (yahooTicker.endsWith('.NS')) return { symbol: yahooTicker.replace('.NS', ''), exchange: 'NSE' }
  if (yahooTicker.endsWith('.BO')) return { symbol: yahooTicker.replace('.BO', ''), exchange: 'BSE' }
  // US stock
  return { symbol: yahooTicker, exchange: '' }
}

// ── Twelve Data fetch ────────────────────────────────────────────────────────

async function fetchTwelveData(yahooTicker, market, tdInterval) {
  if (!TWELVE_DATA_KEY) throw new Error('TWELVE_DATA_KEY not set')

  const { symbol, exchange } = toTwelveDataParams(yahooTicker, market)
  const params = {
    symbol,
    interval: tdInterval,
    outputsize: 5000,
    apikey: TWELVE_DATA_KEY,
    format: 'JSON',
  }
  if (exchange) params.exchange = exchange

  const { data } = await axios.get('https://api.twelvedata.com/time_series', {
    params,
    timeout: 20000,
    headers: { 'User-Agent': 'TradeArena/1.0' }
  })

  if (data.status === 'error') throw new Error(data.message || 'Twelve Data error')

  const values = data.values
  if (!values || values.length === 0) throw new Error('No data from Twelve Data')

  const candles = values.map(v => {
    const dt = v.datetime.includes(' ')
      ? new Date(v.datetime.replace(' ', 'T') + 'Z').getTime() / 1000
      : new Date(v.datetime).getTime() / 1000
    return {
      time:   Math.floor(dt),
      open:   parseFloat(v.open),
      high:   parseFloat(v.high),
      low:    parseFloat(v.low),
      close:  parseFloat(v.close),
      volume: parseInt(v.volume) || 0,
    }
  }).filter(c => !isNaN(c.open))

  // Twelve Data returns newest first — reverse to oldest first
  return candles.reverse()
}

// ── Yahoo Finance fallback ───────────────────────────────────────────────────

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
      if (!result) throw new Error('No result')
      const { timestamp, indicators } = result
      const quote = indicators?.quote?.[0]
      if (!timestamp || !quote) throw new Error('Empty result')

      const candles = []
      for (let i = 0; i < timestamp.length; i++) {
        const o = quote.open?.[i], h = quote.high?.[i]
        const l = quote.low?.[i],  c = quote.close?.[i]
        if (o == null || h == null || l == null || c == null) continue
        if (o === 0 && h === 0 && l === 0 && c === 0) continue
        candles.push({
          time: timestamp[i],
          open: +o.toFixed(4), high: +h.toFixed(4),
          low:  +l.toFixed(4), close: +c.toFixed(4),
          volume: quote.volume?.[i] ?? 0,
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

    // Try Twelve Data first (reliable from cloud)
    if (TWELVE_DATA_KEY) {
      try {
        candles = await fetchTwelveData(yahooTicker, market, cfg.tdInterval)
        console.log(`[chart] TwelveData ${yahooTicker}: ${candles.length} candles`)
      } catch (tdErr) {
        console.warn(`[chart] TwelveData failed (${tdErr.message}), trying Yahoo`)
        candles = await fetchYahooChart(yahooTicker, cfg.yInterval, cfg.range)
      }
    } else {
      candles = await fetchYahooChart(yahooTicker, cfg.yInterval, cfg.range)
    }

    if (interval === '240' && candles.length > 0) candles = aggregate4h(candles)

    res.json({ symbol: yahooTicker, interval: cfg.yInterval, candles })
  } catch (err) {
    const status = err.response?.status
    const msg = status
      ? `Data provider returned ${status} for ${yahooTicker}`
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
      g.high = Math.max(g.high, c.high)
      g.low  = Math.min(g.low,  c.low)
      g.close = c.close
      g.volume += c.volume
    }
  }
  return Object.values(groups).sort((a, b) => a.time - b.time)
}

export default router
