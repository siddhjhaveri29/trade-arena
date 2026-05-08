import { Router } from 'express'
import { makeServiceClient } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function getServiceClient() {
  return makeServiceClient()
}

// POST /api/journal
router.post('/', requireAuth, async (req, res) => {
  const {
    tradeId, symbol, market, entryDate, direction,
    setup, notes, lessons, emotion, emotionRating,
    outcome, pnl, tags, screenshotUrl
  } = req.body

  if (!symbol) return res.status(400).json({ error: 'Symbol is required' })

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: req.user.id,
      trade_id: tradeId || null,
      symbol,
      market,
      entry_date: entryDate || new Date().toISOString().split('T')[0],
      direction,
      setup,
      notes,
      lessons,
      emotion,
      emotion_rating: emotionRating,
      outcome,
      pnl: pnl ? Number(pnl) : null,
      tags: tags || [],
      screenshot_url: screenshotUrl || null
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

// GET /api/journal?page=1&limit=20&market=IN&outcome=win
router.get('/', requireAuth, async (req, res) => {
  const { page = 1, limit = 20, market, outcome, setup, symbol, tag } = req.query
  const supabase = getServiceClient()
  const offset = (Number(page) - 1) * Number(limit)

  let query = supabase
    .from('journal_entries')
    .select('*, trades(side, quantity, price)', { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('entry_date', { ascending: false })
    .range(offset, offset + Number(limit) - 1)

  if (market) query = query.eq('market', market)
  if (outcome) query = query.eq('outcome', outcome)
  if (setup) query = query.eq('setup', setup)
  if (symbol) query = query.ilike('symbol', `%${symbol}%`)
  if (tag) query = query.contains('tags', [tag])

  const { data, count, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ entries: data, total: count, page: Number(page), limit: Number(limit) })
})

// GET /api/journal/stats
router.get('/stats', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', req.user.id)
    .not('outcome', 'is', null)

  if (!entries || entries.length === 0) {
    return res.json({
      total: 0, wins: 0, losses: 0, winRate: 0,
      avgPnl: 0, byEmotion: {}, bySetup: {}, byDate: {}
    })
  }

  const wins = entries.filter(e => e.outcome === 'win').length
  const losses = entries.filter(e => e.outcome === 'loss').length
  const totalPnl = entries.reduce((s, e) => s + (e.pnl || 0), 0)
  const avgPnl = entries.length ? totalPnl / entries.length : 0

  // By emotion stats
  const byEmotion = {}
  const bySetup = {}
  const byDate = {}

  for (const e of entries) {
    // Emotion stats
    if (e.emotion) {
      if (!byEmotion[e.emotion]) byEmotion[e.emotion] = { count: 0, wins: 0, totalPnl: 0 }
      byEmotion[e.emotion].count++
      if (e.outcome === 'win') byEmotion[e.emotion].wins++
      byEmotion[e.emotion].totalPnl += e.pnl || 0
    }

    // Setup stats
    if (e.setup) {
      if (!bySetup[e.setup]) bySetup[e.setup] = { count: 0, wins: 0, totalPnl: 0 }
      bySetup[e.setup].count++
      if (e.outcome === 'win') bySetup[e.setup].wins++
      bySetup[e.setup].totalPnl += e.pnl || 0
    }

    // Date heatmap
    const date = e.entry_date
    if (!byDate[date]) byDate[date] = { count: 0, pnl: 0 }
    byDate[date].count++
    byDate[date].pnl += e.pnl || 0
  }

  res.json({
    total: entries.length,
    wins,
    losses,
    winRate: entries.length ? (wins / entries.length) * 100 : 0,
    avgPnl,
    totalPnl,
    byEmotion,
    bySetup,
    byDate
  })
})

// PUT /api/journal/:id
router.put('/:id', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  const { data: entry } = await supabase
    .from('journal_entries')
    .select('user_id')
    .eq('id', req.params.id)
    .single()

  if (!entry) return res.status(404).json({ error: 'Entry not found' })
  if (entry.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  const allowed = ['notes', 'lessons', 'emotion', 'emotion_rating', 'outcome', 'pnl',
    'tags', 'setup', 'direction', 'screenshot_url']
  const updates = {}
  for (const key of allowed) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    if (req.body[camelKey] !== undefined) updates[key] = req.body[camelKey]
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// DELETE /api/journal/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  const { data: entry } = await supabase
    .from('journal_entries')
    .select('user_id')
    .eq('id', req.params.id)
    .single()

  if (!entry) return res.status(404).json({ error: 'Entry not found' })
  if (entry.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  const { error } = await supabase.from('journal_entries').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
