/**
 * Vercel Serverless Function — GET /api/chart
 * Runs on AWS Lambda (different IP than Railway/GCP).
 * Yahoo Finance does not block AWS Lambda IPs → Indian stocks work here.
 */

const INTERVAL_MAP = {
  '1':   { yInterval: '1m',  range: '1d'   },
  '5':   { yInterval: '5m',  range: '5d'   },
  '15':  { yInterval: '15m', range: '60d'  },
  '30':  { yInterval: '30m', range: '60d'  },
  '60':  { yInterval: '60m', range: '730d' },
  '240': { yInterval: '60m', range: '730d' },
  'D':   { yInterval: '1d',  range: '10y'  },
  'W':   { yInterval: '1wk', range: 'max'  },
}

const SPECIAL_TICKERS = {
  NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', SENSEX: '^BSESN', NIFTYMIDCAP: '^NSEMDCP100',
  GOLD: 'GC=F', SILVER: 'SI=F', CRUDEOIL: 'CL=F', NATURALGAS: 'NG=F',
}

function toYahooTicker(symbol, market, yahooKey) {
  if (yahooKey) return yahooKey
  if (market === 'US') return symbol
  return SPECIAL_TICKERS[symbol] || `${symbol}.NS`
}

const YF_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

async function fetchYahoo(ticker, yInterval, range) {
  let lastErr
  for (const host of YF_HOSTS) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${encodeURIComponent(yInterval)}&range=${encodeURIComponent(range)}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com',
        }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${host}`)
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (!result) throw new Error('No result in response')
      const { timestamp, indicators } = result
      const quote = indicators?.quote?.[0]
      if (!timestamp || !quote) throw new Error('Empty data')
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

export default async function handler(req, res) {
  // CORS headers so the Vercel frontend can call this
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { symbol, market = 'IN', interval = 'D', yahooKey } = req.query
  if (!symbol) return res.status(400).json({ error: 'symbol required' })

  const cfg = INTERVAL_MAP[interval] || INTERVAL_MAP['D']
  const ticker = toYahooTicker(symbol.toUpperCase(), market, yahooKey)

  try {
    let candles = await fetchYahoo(ticker, cfg.yInterval, cfg.range)
    if (interval === '240' && candles.length > 0) candles = aggregate4h(candles)
    res.json({ symbol: ticker, interval: cfg.yInterval, candles })
  } catch (err) {
    console.error('[chart-fn]', ticker, err.message)
    res.status(500).json({ error: err.message || 'Failed to fetch chart data' })
  }
}
