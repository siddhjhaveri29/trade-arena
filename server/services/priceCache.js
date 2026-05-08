import { fetchIndianQuotes, getYahooKey } from './growwService.js'
import { fetchAlpacaSnapshots } from './alpacaService.js'

// In-memory price cache
const cache = new Map()

// Active symbol sets
const activeIN = new Set()
const activeUS = new Set()

let broadcastFn = null
let orderEngineTick = null

// Default symbols pre-registered on startup
const DEFAULT_IN = [
  { symbol: 'RELIANCE', yahooKey: 'RELIANCE.NS', display: 'Reliance' },
  { symbol: 'TCS', yahooKey: 'TCS.NS', display: 'TCS' },
  { symbol: 'INFY', yahooKey: 'INFY.NS', display: 'Infosys' },
  { symbol: 'HDFCBANK', yahooKey: 'HDFCBANK.NS', display: 'HDFC Bank' },
  { symbol: 'NIFTY', yahooKey: '^NSEI', display: 'NIFTY 50' },
  { symbol: 'BANKNIFTY', yahooKey: '^NSEBANK', display: 'Bank Nifty' },
  { symbol: 'GOLD', yahooKey: 'GC=F', display: 'Gold' },
  { symbol: 'CRUDEOIL', yahooKey: 'CL=F', display: 'Crude Oil' }
]

const DEFAULT_US = ['AAPL', 'TSLA', 'MSFT', 'NVDA', 'SPY', 'QQQ', 'GLD', 'USO']

export function init(broadcast, tickFn) {
  broadcastFn = broadcast
  orderEngineTick = tickFn
  // Pre-register defaults
  DEFAULT_IN.forEach(s => activeIN.add(s.symbol))
  DEFAULT_US.forEach(s => activeUS.add(s))
}

export function registerSymbol(symbol, market) {
  if (market === 'IN') activeIN.add(symbol)
  else activeUS.add(symbol)
}

export function unregisterSymbol(symbol, market) {
  if (market === 'IN') activeIN.delete(symbol)
  else activeUS.delete(symbol)
}

export function getPrice(symbol) {
  return cache.get(symbol) ?? null
}

export function getAllPrices() {
  return Object.fromEntries(cache)
}

export function getCacheForSymbols(symbols) {
  const result = {}
  symbols.forEach(s => {
    const entry = cache.get(s)
    if (entry) result[s] = entry
  })
  return result
}

async function pollIN() {
  if (activeIN.size === 0) return
  try {
    const symbols = Array.from(activeIN)
    const quotes = await fetchIndianQuotes(symbols)
    const updated = {}
    for (const [symbol, data] of Object.entries(quotes)) {
      const entry = {
        symbol,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        high: data.high,
        low: data.low,
        volume: data.volume,
        market: 'IN',
        updatedAt: Date.now()
      }
      cache.set(symbol, entry)
      updated[symbol] = entry
    }
    if (broadcastFn && Object.keys(updated).length > 0) {
      broadcastFn({ type: 'prices', data: updated })
    }
  } catch (err) {
    console.error('[priceCache] Indian poll error:', err.message)
  }
}

async function pollUS() {
  if (activeUS.size === 0) return
  try {
    const symbols = Array.from(activeUS)
    const snapshots = await fetchAlpacaSnapshots(symbols)
    const updated = {}
    for (const [symbol, data] of Object.entries(snapshots)) {
      const entry = {
        symbol,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        high: data.high,
        low: data.low,
        volume: data.volume,
        market: 'US',
        updatedAt: Date.now()
      }
      cache.set(symbol, entry)
      updated[symbol] = entry
    }
    if (broadcastFn && Object.keys(updated).length > 0) {
      broadcastFn({ type: 'prices', data: updated })
    }
  } catch (err) {
    console.error('[priceCache] US poll error:', err.message)
  }
}

async function tick() {
  await Promise.allSettled([pollIN(), pollUS()])
  // Notify order engine after each price update
  if (orderEngineTick) {
    orderEngineTick(getAllPrices())
  }
}

export function start() {
  // Stagger IN and US polls so they never fire simultaneously
  // IN: every 10s, US: every 10s offset by 5s
  console.log('[priceCache] Starting price polling (IN: 10s, US: 10s)')
  setTimeout(() => {
    pollIN()
    setInterval(pollIN, 10000)
  }, 0)
  setTimeout(() => {
    pollUS()
    setInterval(pollUS, 10000)
    // Notify order engine every 10s after both pollers are running
    setInterval(() => orderEngineTick && orderEngineTick(getAllPrices()), 10000)
  }, 5000)
}
