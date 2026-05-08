import { Router } from 'express'
import { makeServiceClient } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { getPrice, registerSymbol } from '../services/priceCache.js'

const router = Router()

function getServiceClient() {
  return makeServiceClient()
}

// POST /api/orders — place a new order
router.post('/', requireAuth, async (req, res) => {
  const {
    symbol, market, orderType, side, positionSide,
    quantity, limitPrice, portfolioId
  } = req.body

  if (!symbol || !market || !orderType || !side || !positionSide || !quantity || !portfolioId) {
    return res.status(400).json({ error: 'Missing required order fields' })
  }

  const supabase = getServiceClient()

  try {
    // Verify portfolio belongs to user
    const { data: portfolio, error: portErr } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', portfolioId)
      .eq('user_id', req.user.id)
      .single()

    if (portErr || !portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' })
    }

    // Ensure symbol is tracked in price cache
    registerSymbol(symbol.toUpperCase(), market)

    // Get current price for validation
    const priceData = getPrice(symbol.toUpperCase())
    const currentPrice = priceData?.price ?? null

    // For buy orders: need a price to check funds (use limit price as fallback)
    const priceForValidation = currentPrice ?? (orderType === 'limit' ? Number(limitPrice) : null)
    const totalCost = priceForValidation ? priceForValidation * quantity : null

    // Validate cash for buy orders (skip if price not yet cached — engine will re-check at fill)
    if (side === 'buy' && positionSide === 'long' && totalCost !== null) {
      if (portfolio.cash_balance < totalCost) {
        return res.status(400).json({
          error: `Insufficient funds. Required: ${market === 'IN' ? '₹' : '$'}${totalCost.toFixed(2)}, Available: ${market === 'IN' ? '₹' : '$'}${portfolio.cash_balance.toFixed(2)}`
        })
      }
    }

    // Validate position exists for sell-long
    if (side === 'sell' && positionSide === 'long') {
      const { data: pos } = await supabase
        .from('positions')
        .select('quantity')
        .eq('portfolio_id', portfolioId)
        .eq('symbol', symbol)
        .eq('side', 'long')
        .single()

      if (!pos || pos.quantity < quantity) {
        return res.status(400).json({
          error: `Insufficient position quantity. You hold ${pos?.quantity ?? 0} shares.`
        })
      }
    }

    // Validate limit price provided for limit orders
    if (orderType === 'limit' && !limitPrice) {
      return res.status(400).json({ error: 'Limit price required for limit orders' })
    }

    // Insert order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: req.user.id,
        portfolio_id: portfolioId,
        symbol: symbol.toUpperCase(),
        market,
        order_type: orderType,
        side,
        position_side: positionSide,
        quantity: Number(quantity),
        limit_price: orderType === 'limit' ? Number(limitPrice) : null,
        status: 'pending'
      })
      .select()
      .single()

    if (orderErr) throw orderErr

    res.status(201).json({ order })
  } catch (err) {
    console.error('[orders/post]', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/orders?market=IN&status=pending
router.get('/', requireAuth, async (req, res) => {
  const { market, status, limit = 50 } = req.query
  const supabase = getServiceClient()

  let query = supabase
    .from('orders')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(Number(limit))

  if (market) query = query.eq('market', market)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// DELETE /api/orders/:id — cancel pending order
router.delete('/:id', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  const { data: order } = await supabase
    .from('orders')
    .select('status, user_id')
    .eq('id', req.params.id)
    .single()

  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
  if (order.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending orders can be cancelled' })
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
