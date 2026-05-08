import { Router } from 'express'
import { makeServiceClient } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import { getPrice } from '../services/priceCache.js'

const router = Router()

function getServiceClient() {
  return makeServiceClient()
}

function generateInviteCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase()
}

// POST /api/groups — create group
router.post('/', requireAuth, async (req, res) => {
  const { name, description, market, competitionType } = req.body

  if (!name || !market) {
    return res.status(400).json({ error: 'Name and market are required' })
  }

  const supabase = getServiceClient()
  let inviteCode = generateInviteCode()

  // Ensure uniqueness
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .single()
    if (!existing) break
    inviteCode = generateInviteCode()
    attempts++
  }

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      name,
      description,
      created_by: req.user.id,
      invite_code: inviteCode,
      market,
      competition_type: competitionType || 'all_time'
    })
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })

  // Auto-add creator as member
  await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: req.user.id
  })

  res.status(201).json(group)
})

// GET /api/groups — list groups user belongs to
router.get('/', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', req.user.id)

  if (!memberships || memberships.length === 0) return res.json([])

  const groupIds = memberships.map(m => m.group_id)
  const { data: groups, error } = await supabase
    .from('groups')
    .select('*, profiles!groups_created_by_fkey(display_name, username)')
    .in('id', groupIds)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  // Add member counts
  const enriched = await Promise.all(groups.map(async g => {
    const { count } = await supabase
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', g.id)
    return { ...g, member_count: count }
  }))

  res.json(enriched)
})

// GET /api/groups/:id
router.get('/:id', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  // Check membership
  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  const { data: group, error } = await supabase
    .from('groups')
    .select('*, profiles!groups_created_by_fkey(display_name, username, avatar_url)')
    .eq('id', req.params.id)
    .single()

  if (error || !group) return res.status(404).json({ error: 'Group not found' })
  res.json(group)
})

// POST /api/groups/join
router.post('/join', requireAuth, async (req, res) => {
  const { inviteCode } = req.body
  if (!inviteCode) return res.status(400).json({ error: 'Invite code required' })

  const supabase = getServiceClient()

  const { data: group, error } = await supabase
    .from('groups')
    .select('id, name, market, is_active')
    .eq('invite_code', inviteCode.toUpperCase())
    .single()

  if (error || !group) return res.status(404).json({ error: 'Invalid invite code' })
  if (!group.is_active) return res.status(400).json({ error: 'This group is no longer active' })

  // Check already a member
  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', group.id)
    .eq('user_id', req.user.id)
    .single()

  if (existing) return res.status(409).json({ error: 'Already a member of this group' })

  const { error: joinError } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: req.user.id
  })

  if (joinError) return res.status(500).json({ error: joinError.message })
  res.json({ success: true, group })
})

// GET /api/groups/:id/leaderboard
router.get('/:id/leaderboard', requireAuth, async (req, res) => {
  const supabase = getServiceClient()

  // Verify membership
  const { data: member } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', req.params.id)
    .eq('user_id', req.user.id)
    .single()

  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  const { data: group } = await supabase
    .from('groups')
    .select('market')
    .eq('id', req.params.id)
    .single()

  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, joined_at, profiles(id, username, display_name, avatar_url)')
    .eq('group_id', req.params.id)

  if (!members) return res.json([])

  const leaderboard = await Promise.all(members.map(async m => {
    const userId = m.user_id

    // Get portfolio(s) for this user
    let portfolioQuery = supabase
      .from('portfolios')
      .select('id, cash_balance, initial_balance, market')
      .eq('user_id', userId)

    if (group.market !== 'BOTH') {
      portfolioQuery = portfolioQuery.eq('market', group.market)
    }

    const { data: portfolios } = await portfolioQuery

    if (!portfolios || portfolios.length === 0) {
      return {
        userId,
        profile: m.profiles,
        joinedAt: m.joined_at,
        totalValue: 0,
        initialBalance: 0,
        returnPct: 0,
        winRate: 0,
        totalTrades: 0
      }
    }

    // Calculate total equity across all portfolios
    let totalValue = 0
    let initialBalance = 0

    for (const portfolio of portfolios) {
      const { data: positions } = await supabase
        .from('positions')
        .select('symbol, quantity, current_price, avg_price')
        .eq('portfolio_id', portfolio.id)

      let positionsValue = 0
      if (positions) {
        for (const pos of positions) {
          const priceData = getPrice(pos.symbol)
          const price = priceData?.price ?? pos.current_price ?? pos.avg_price
          positionsValue += price * pos.quantity
        }
      }
      totalValue += portfolio.cash_balance + positionsValue
      initialBalance += portfolio.initial_balance
    }

    const returnPct = initialBalance ? ((totalValue - initialBalance) / initialBalance) * 100 : 0

    // Get win rate from trades
    const { data: trades } = await supabase
      .from('trades')
      .select('pnl, side, position_side')
      .eq('user_id', userId)

    const closingTrades = (trades || []).filter(t =>
      (t.side === 'sell' && t.position_side === 'long') ||
      (t.side === 'buy' && t.position_side === 'short')
    )
    const wins = closingTrades.filter(t => (t.pnl || 0) > 0).length
    const winRate = closingTrades.length ? (wins / closingTrades.length) * 100 : 0

    return {
      userId,
      profile: m.profiles,
      joinedAt: m.joined_at,
      totalValue,
      initialBalance,
      returnPct,
      winRate,
      totalTrades: closingTrades.length
    }
  }))

  leaderboard.sort((a, b) => b.returnPct - a.returnPct)
  leaderboard.forEach((entry, i) => { entry.rank = i + 1 })

  res.json(leaderboard)
})

// DELETE /api/groups/:id — creator deletes group
router.delete('/:id', requireAuth, async (req, res) => {
  const supabase = getServiceClient()
  const { data: group } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', req.params.id)
    .single()

  if (!group) return res.status(404).json({ error: 'Group not found' })
  if (group.created_by !== req.user.id) return res.status(403).json({ error: 'Only the creator can delete this group' })

  await supabase.from('groups').delete().eq('id', req.params.id)
  res.json({ success: true })
})

export default router
