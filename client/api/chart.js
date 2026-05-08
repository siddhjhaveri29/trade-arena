/**
 * Vercel Edge Function — runs on Cloudflare's edge network (NOT AWS/GCP)
 * Yahoo Finance does not block Cloudflare edge IPs → Indian stocks work.
 */
export const config = { runtime: 'edge' }

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

function aggregate4h(candles) {
  const groups = {}
  for (const c of candles) {
    const bucket = Math.floor(c.time / (4 * 3600)) * (4 * 3600)
    if (!groups[bucket]) {
      groups[bucket] = { ...c, time: bucket }
    } else {
      groups[bucket].high = Math.max(groups[bucket].high, c.high)
      groups[bucket].low  = Math.min(groups[bucket].low,  c.low)
      groups[bucket].close  = c.close
      groups[bucket].volume += c.volume
    }
  }
  return Object.values(groups).sort((a, b) => a.time - b.time)
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const symbol   = searchParams.get('symbol')
  const market   = searchParams.get('market')   || 'IN'
  const interval = searchParams.get('interval') || 'D'
  const yahooKey = searchParams.get('yahooKey') || null

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol required' }), { status: 400 })
  }

  const cfg    = INTERVAL_MAP[interval] || INTERVAL_MAP['D']
  const ticker = toYahooTicker(symbol.toUpperCase(), market, yahooKey)
  const hosts  = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

  let candles = null
  let lastErr = ''

  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${cfg.yInterval}&range=${cfg.range}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com',
        }
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data   = await res.json()
      const result = data?.chart?.result?.[0]
      if (!result) throw new Error('no result')

      const { timestamp, indicators } = result
      const quote = indicators?.quote?.[0]
      if (!timestamp || !quote) throw new Error('empty data')

      candles = []
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
      break // success
    } catch (e) {
      lastErr = e.message
    }
  }

  if (!candles) {
    return new Response(JSON.stringify({ error: lastErr || 'Failed to fetch' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (interval === '240' && candles.length > 0) candles = aggregate4h(candles)

  return new Response(JSON.stringify({ symbol: ticker, interval: cfg.yInterval, candles }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    }
  })
}
