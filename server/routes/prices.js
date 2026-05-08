import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  getAllPrices,
  getCacheForSymbols,
  registerSymbol,
  unregisterSymbol
} from '../services/priceCache.js'

const router = Router()

// GET /api/prices?symbols=RELIANCE,NIFTY,AAPL
router.get('/', (req, res) => {
  const { symbols } = req.query
  if (symbols) {
    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase())
    return res.json(getCacheForSymbols(symbolList))
  }
  res.json(getAllPrices())
})

// GET /api/prices/market-status
router.get('/market-status', (req, res) => {
  res.json(getMarketStatus())
})

// POST /api/prices/subscribe
router.post('/subscribe', requireAuth, (req, res) => {
  const { symbols, market } = req.body
  if (!Array.isArray(symbols) || !market) {
    return res.status(400).json({ error: 'symbols array and market required' })
  }
  symbols.forEach(s => registerSymbol(s.toUpperCase(), market))
  res.json({ subscribed: symbols, market })
})

// POST /api/prices/unsubscribe
router.post('/unsubscribe', requireAuth, (req, res) => {
  const { symbols, market } = req.body
  if (!Array.isArray(symbols) || !market) {
    return res.status(400).json({ error: 'symbols array and market required' })
  }
  symbols.forEach(s => unregisterSymbol(s.toUpperCase(), market))
  res.json({ unsubscribed: symbols })
})

function getMarketStatus() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))

  const day = d => d.getDay()
  const h = d => d.getHours() + d.getMinutes() / 60

  const nseOpen =
    day(ist) >= 1 && day(ist) <= 5 &&
    h(ist) >= 9.25 && h(ist) <= 15.5

  const mcxOpen =
    day(ist) >= 1 && day(ist) <= 5 &&
    h(ist) >= 9 && h(ist) < 23.5

  const nyseOpen =
    day(et) >= 1 && day(et) <= 5 &&
    h(et) >= 9.5 && h(et) < 16

  return { nseOpen, mcxOpen, nyseOpen }
}

export default router
