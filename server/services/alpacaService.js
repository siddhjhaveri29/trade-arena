import axios from 'axios'

const DATA_URL = process.env.ALPACA_DATA_URL ?? 'https://data.alpaca.markets'
const BASE_URL = process.env.ALPACA_BASE_URL ?? 'https://paper-api.alpaca.markets'

function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_KEY_ID,
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY
  }
}

export async function fetchAlpacaSnapshots(symbols) {
  if (!symbols || symbols.length === 0) return {}
  if (!process.env.ALPACA_KEY_ID) {
    return generateMockPrices(symbols)
  }

  try {
    const res = await axios.get(`${DATA_URL}/v2/stocks/snapshots`, {
      params: { symbols: symbols.join(','), feed: 'iex' },
      headers: alpacaHeaders()
    })

    const result = {}
    for (const [symbol, snap] of Object.entries(res.data)) {
      const price = snap.latestTrade?.p ?? snap.minuteBar?.c ?? 0
      const prevClose = snap.prevDailyBar?.c ?? price
      const dailyBar = snap.dailyBar ?? {}
      result[symbol] = {
        price,
        change: price - prevClose,
        changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
        high: dailyBar.h ?? price,
        low: dailyBar.l ?? price,
        volume: dailyBar.v ?? 0,
        open: dailyBar.o ?? price,
        prevClose
      }
    }
    return result
  } catch (err) {
    console.error('[alpacaService] Snapshot error:', err.message)
    return generateMockPrices(symbols)
  }
}

export async function searchAlpacaAssets(query) {
  if (!query) return []
  if (!process.env.ALPACA_KEY_ID) return getMockUSInstruments(query)

  try {
    const res = await axios.get(`${BASE_URL}/v2/assets`, {
      params: { status: 'active', asset_class: 'us_equity' },
      headers: alpacaHeaders()
    })

    const q = query.toLowerCase()
    return res.data
      .filter(
        a =>
          a.tradable &&
          (a.symbol.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q))
      )
      .slice(0, 20)
      .map(a => ({
        symbol: a.symbol,
        name: a.name,
        market: 'US',
        exchange: a.exchange
      }))
  } catch (err) {
    console.error('[alpacaService] Asset search error:', err.message)
    return getMockUSInstruments(query)
  }
}

// Mock prices for development without API keys
const BASE_PRICES = {
  AAPL: 189.5, TSLA: 175.2, MSFT: 415.3, NVDA: 875.4,
  SPY: 524.8, QQQ: 446.2, GLD: 218.6, USO: 78.4
}

function generateMockPrices(symbols) {
  const result = {}
  for (const symbol of symbols) {
    const base = BASE_PRICES[symbol] ?? 100
    const change = (Math.random() - 0.5) * base * 0.02
    const price = +(base + change).toFixed(2)
    result[symbol] = {
      price,
      change: +change.toFixed(2),
      changePercent: +((change / base) * 100).toFixed(3),
      high: +(price + Math.random() * 2).toFixed(2),
      low: +(price - Math.random() * 2).toFixed(2),
      volume: Math.floor(Math.random() * 50000000),
      open: +(base).toFixed(2),
      prevClose: +(base).toFixed(2)
    }
  }
  return result
}

function getMockUSInstruments(query) {
  const ALL = [
    { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', market: 'US', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', market: 'US', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US', exchange: 'NASDAQ' },
    { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US', exchange: 'NASDAQ' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', market: 'US', exchange: 'NYSE' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', market: 'US', exchange: 'NASDAQ' },
    { symbol: 'GLD', name: 'SPDR Gold Shares', market: 'US', exchange: 'NYSE' },
    { symbol: 'USO', name: 'United States Oil Fund', market: 'US', exchange: 'NYSE' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US', exchange: 'NYSE' },
    { symbol: 'BAC', name: 'Bank of America Corporation', market: 'US', exchange: 'NYSE' },
    { symbol: 'XOM', name: 'Exxon Mobil Corporation', market: 'US', exchange: 'NYSE' },
    { symbol: 'WMT', name: 'Walmart Inc.', market: 'US', exchange: 'NYSE' }
  ]
  const q = query.toLowerCase()
  return ALL.filter(
    a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  ).slice(0, 15)
}
