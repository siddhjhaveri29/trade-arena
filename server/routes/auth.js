import { Router } from 'express'
import { makeServiceClient } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function getServiceClient() {
  return makeServiceClient()
}

// POST /api/auth/register
// Called after client-side Supabase signUp succeeds — creates profile + portfolios
router.post('/register', async (req, res) => {
  const { userId, username, displayName, markets, initialBalances } = req.body

  if (!userId || !username || !markets || markets.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const supabase = getServiceClient()

  try {
    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      username: username.toLowerCase().trim(),
      display_name: displayName || username
    })

    if (profileError) {
      if (profileError.code === '23505') {
        return res.status(409).json({ error: 'Username already taken' })
      }
      throw profileError
    }

    // Create portfolios for selected markets
    const portfolioInserts = []
    if (markets.includes('IN')) {
      const balance = initialBalances?.IN ?? 500000
      portfolioInserts.push({
        user_id: userId,
        market: 'IN',
        cash_balance: balance,
        initial_balance: balance
      })
    }
    if (markets.includes('US')) {
      const balance = initialBalances?.US ?? 10000
      portfolioInserts.push({
        user_id: userId,
        market: 'US',
        cash_balance: balance,
        initial_balance: balance
      })
    }

    const { error: portfolioError } = await supabase
      .from('portfolios')
      .insert(portfolioInserts)

    if (portfolioError) throw portfolioError

    // Add default watchlist items
    const defaultWatchlist = []
    if (markets.includes('IN')) {
      const indianDefaults = [
        { symbol: 'RELIANCE', display_name: 'Reliance', market: 'IN', yahoo_key: 'RELIANCE.NS' },
        { symbol: 'TCS', display_name: 'TCS', market: 'IN', yahoo_key: 'TCS.NS' },
        { symbol: 'NIFTY', display_name: 'NIFTY 50', market: 'IN', yahoo_key: '^NSEI' },
        { symbol: 'INFY', display_name: 'Infosys', market: 'IN', yahoo_key: 'INFY.NS' },
        { symbol: 'HDFCBANK', display_name: 'HDFC Bank', market: 'IN', yahoo_key: 'HDFCBANK.NS' }
      ]
      indianDefaults.forEach(s => defaultWatchlist.push({ user_id: userId, ...s }))
    }
    if (markets.includes('US')) {
      const usDefaults = [
        { symbol: 'AAPL', display_name: 'Apple', market: 'US', yahoo_key: 'AAPL' },
        { symbol: 'TSLA', display_name: 'Tesla', market: 'US', yahoo_key: 'TSLA' },
        { symbol: 'NVDA', display_name: 'Nvidia', market: 'US', yahoo_key: 'NVDA' },
        { symbol: 'SPY', display_name: 'S&P 500 ETF', market: 'US', yahoo_key: 'SPY' },
        { symbol: 'QQQ', display_name: 'NASDAQ ETF', market: 'US', yahoo_key: 'QQQ' }
      ]
      usDefaults.forEach(s => defaultWatchlist.push({ user_id: userId, ...s }))
    }

    if (defaultWatchlist.length > 0) {
      await supabase.from('watchlist_items').insert(defaultWatchlist)
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[auth/register]', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const supabase = getServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single()

  res.json({ user: req.user, profile })
})

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  const { displayName, bio, avatarUrl } = req.body
  const supabase = getServiceClient()

  const updates = {}
  if (displayName !== undefined) updates.display_name = displayName
  if (bio !== undefined) updates.bio = bio
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single()

  if (error) return res.status(400).json({ error: error.message })
  res.json({ profile: data })
})

export default router
