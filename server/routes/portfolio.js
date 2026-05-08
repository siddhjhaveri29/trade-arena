import { Router } from 'express'
import { makeServiceClient } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { getPrice } from '../services/priceCache.js'

const router = Router()

function getServiceClient() {
  return makeServiceClient()
}

// GET /api/portfolio — all portfolios with live position values
router.get('/', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', req.user.id)

  if (!portfolios) return res.json([])

  const enriched = await Promise.all(portfolios.map(p => enrichPortfolio(p, supabase)))
  res.json(enriched)
})

// POST /api/portfolio/add-funds  { market, amount }
router.post('/add-funds', requireAuth, async (req, res) => {
  const { market = 'IN', amount } = req.body
  const parsed = parseFloat(amount)

  if (!parsed || parsed <= 0 || parsed > 10_000_000) {
    return res.status(400).json({ error: 'Amount must be between 1 and 10,000,000' })
  }

  const supabase = getServiceClient()

  const { data: portfolio, error: fetchErr } = await supabase
    .from('portfolios')
    .select('id, cash_balance, initial_balance')
    .eq('user_id', req.user.id)
    .eq('market', market)
    .single()

  if (fetchErr || !portfolio) {
    return res.status(404).json({ error: 'Portfolio not found' })
  }

  const newCash = portfolio.cash_balance + parsed
  const newInitial = portfolio.initial_balance + parsed

  const { error: updateErr } = await supabase
    .from('portfolios')
    .update({
      cash_balance:    newCash,
      initial_balance: newInitial,
      updated_at:      new Date().toISOString()
    })
    .eq('id', portfolio.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  res.json({ success: true, cash_balance: newCash, added: parsed })
})

// GET /api/portfolio/positions?market=IN
router.get('/positions', requireAuth, async (req, res) => {
  const { market } = req.query
  const supabase = getServiceClient()

  let query = supabase
    .from('positions')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })

  if (market) query = query.eq('market', market)

  const { data: positions, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Enrich with live price and PnL
  const enrichedPositions = positions.map(pos => {
    const priceData = getPrice(pos.symbol)
    const ltp = priceData?.price ?? pos.current_price ?? pos.avg_price
    const pnl = pos.side === 'long'
      ? (ltp - pos.avg_price) * pos.quantity
      : (pos.avg_price - ltp) * pos.quantity
    const pnlPct = pos.avg_price ? (pnl / (pos.avg_price * pos.quantity)) * 100 : 0

    return {
      ...pos,
      current_price: ltp,
      unrealized_pnl: pnl,
      unrealized_pnl_pct: pnlPct,
      market_value: ltp * pos.quantity
    }
  })

  res.json(enrichedPositions)
})

// GET /api/portfolio/trades?market=IN&limit=50
router.get('/trades', requireAuth, async (req, res) => {
  const { market, limit = 50, offset = 0 } = req.query
  const supabase = getServiceClient()

  let query = supabase
    .from('trades')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (market) query = query.eq('market', market)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/portfolio/equity-curve?market=IN&period=1M
router.get('/equity-curve', requireAuth, async (req, res) => {
  const { market = 'IN', period = '1M' } = req.query
  const supabase = getServiceClient()

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('id, initial_balance')
    .eq('user_id', req.user.id)
    .eq('market', market)
    .single()

  if (!portfolio) return res.json({ snapshots: [], initialBalance: 0 })

  const since = getPeriodStart(period)
  const { data: snapshots } = await supabase
    .from('equity_snapshots')
    .select('equity, cash, positions_value, snapshot_at')
    .eq('portfolio_id', portfolio.id)
    .gte('snapshot_at', since.toISOString())
    .order('snapshot_at', { ascending: true })

  res.json({
    snapshots: snapshots || [],
    initialBalance: portfolio.initial_balance
  })
})

// GET /api/portfolio/stats?market=IN
router.get('/stats', requireAuth, async (req, res) => {
  const { market } = req.query
  const supabase = getServiceClient()

  let query = supabase
    .from('trades')
    .select('pnl, pnl_percentage, side, position_side, symbol, quantity, price, created_at')
    .eq('user_id', req.user.id)

  if (market) query = query.eq('market', market)

  const { data: trades } = await query

  if (!trades || trades.length === 0) {
    return res.json({
      totalTrades: 0, wins: 0, losses: 0, winRate: 0,
      totalPnl: 0, avgPnl: 0, bestTrade: null, worstTrade: null,
      avgHoldTime: null
    })
  }

  const closingTrades = trades.filter(t =>
    (t.side === 'sell' && t.position_side === 'long') ||
    (t.side === 'buy' && t.position_side === 'short')
  )

  const totalPnl = closingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const wins = closingTrades.filter(t => (t.pnl || 0) > 0).length
  const losses = closingTrades.filter(t => (t.pnl || 0) < 0).length
  const winRate = closingTrades.length > 0 ? (wins / closingTrades.length) * 100 : 0
  const avgPnl = closingTrades.length > 0 ? totalPnl / closingTrades.length : 0

  const sorted = [...closingTrades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0))

  res.json({
    totalTrades: closingTrades.length,
    wins,
    losses,
    winRate,
    totalPnl,
    avgPnl,
    bestTrade: sorted[0] ?? null,
    worstTrade: sorted[sorted.length - 1] ?? null
  })
})

async function enrichPortfolio(portfolio, supabase) {
  const { data: positions } = await supabase
    .from('positions')
    .select('symbol, quantity, avg_price, current_price, side')
    .eq('portfolio_id', portfolio.id)

  let positionsValue = 0
  if (positions) {
    for (const pos of positions) {
      const priceData = getPrice(pos.symbol)
      const price = priceData?.price ?? pos.current_price ?? pos.avg_price
      positionsValue += price * pos.quantity
    }
  }

  const totalValue = portfolio.cash_balance + positionsValue
  const totalReturn = portfolio.initial_balance
    ? ((totalValue - portfolio.initial_balance) / portfolio.initial_balance) * 100
    : 0

  return {
    ...portfolio,
    positions_value: positionsValue,
    total_value: totalValue,
    total_return_pct: totalReturn,
    positions_count: positions?.length ?? 0
  }
}

function getPeriodStart(period) {
  const now = new Date()
  switch (period) {
    case '1W': return new Date(now - 7 * 24 * 60 * 60 * 1000)
    case '1M': return new Date(now - 30 * 24 * 60 * 60 * 1000)
    case '3M': return new Date(now - 90 * 24 * 60 * 60 * 1000)
    case '6M': return new Date(now - 180 * 24 * 60 * 60 * 1000)
    case '1Y': return new Date(now - 365 * 24 * 60 * 60 * 1000)
    case 'ALL': return new Date(0)
    default: return new Date(now - 30 * 24 * 60 * 60 * 1000)
  }
}

export default router
