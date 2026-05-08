import { Router } from 'express'
import { searchIndian, searchUS, isLoaded } from '../services/instrumentsCache.js'
import { searchSymbols } from '../services/growwService.js'
import { searchAlpacaAssets } from '../services/alpacaService.js'

const router = Router()

// GET /api/search?q=reli&market=IN
router.get('/', async (req, res) => {
  const { q, market } = req.query

  if (!q || q.trim().length < 1) {
    return res.status(400).json({ error: 'Query parameter q is required' })
  }

  try {
    if (market === 'US') {
      // Use full instruments cache if loaded, otherwise Alpaca API
      const results = isLoaded() ? searchUS(q.trim()) : await searchAlpacaAssets(q.trim())
      return res.json(results)
    }

    // Indian market — use full NSE cache if loaded, else static fallback
    const results = isLoaded() ? searchIndian(q.trim()) : searchSymbols(q.trim())
    return res.json(results)
  } catch (err) {
    console.error('[search]', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
