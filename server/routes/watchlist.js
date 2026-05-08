import { Router } from 'express'
import { makeServiceClient } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { registerSymbol, getPrice } from '../services/priceCache.js'

const router = Router()

function getServiceClient() {
  return makeServiceClient()
}

// GET /api/watchlist?market=IN
router.get('/', requireAuth, async (req, res) => {
  const { market } = req.query
  const supabase = getServiceClient()

  let query = supabase
    .from('watchlist_items')
    .select('*')
    .eq('user_id', req.user.id)
    .order('added_at', { ascending: true })

  if (market) query = query.eq('market', market)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Enrich with live prices
  const enriched = (data || []).map(item => {
    const priceData = getPrice(item.symbol)
    return {
      ...item,
      price: priceData?.price ?? null,
      change: priceData?.change ?? null,
      changePercent: priceData?.changePercent ?? null
    }
  })

  res.json(enriched)
})

// POST /api/watchlist
router.post('/', requireAuth, async (req, res) => {
  const { symbol, displayName, market, yahooKey } = req.body

  if (!symbol || !market) {
    return res.status(400).json({ error: 'symbol and market are required' })
  }

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('watchlist_items')
    .insert({
      user_id: req.user.id,
      symbol: symbol.toUpperCase(),
      display_name: displayName || symbol,
      market,
      yahoo_key: yahooKey || null
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Symbol already in watchlist' })
    return res.status(400).json({ error: error.message })
  }

  // Register for price polling
  registerSymbol(symbol.toUpperCase(), market)

  res.status(201).json(data)
})

// DELETE /api/watchlist/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  const { data: item } = await supabase
    .from('watchlist_items')
    .select('user_id')
    .eq('id', req.params.id)
    .single()

  if (!item) return res.status(404).json({ error: 'Item not found' })
  if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  const { error } = await supabase.from('watchlist_items').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
