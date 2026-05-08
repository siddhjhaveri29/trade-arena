import { makeServiceClient } from '../lib/supabase.js'
import { getPrice } from './priceCache.js'

let supabase = null

export function init() {
  supabase = makeServiceClient()
}

export function start() {
  console.log('[snapshotService] Starting equity snapshots every 5 minutes')
  // Take an initial snapshot after 30 seconds
  setTimeout(takeSnapshots, 30000)
  setInterval(takeSnapshots, 5 * 60 * 1000)
}

async function takeSnapshots() {
  if (!supabase) return

  try {
    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('id, user_id, cash_balance')

    if (!portfolios || portfolios.length === 0) return

    const snapshots = []
    for (const portfolio of portfolios) {
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

      const equity = portfolio.cash_balance + positionsValue
      snapshots.push({
        user_id: portfolio.user_id,
        portfolio_id: portfolio.id,
        equity,
        cash: portfolio.cash_balance,
        positions_value: positionsValue
      })
    }

    if (snapshots.length > 0) {
      await supabase.from('equity_snapshots').insert(snapshots)
      console.log(`[snapshotService] Recorded ${snapshots.length} equity snapshots`)
    }
  } catch (err) {
    console.error('[snapshotService] Error:', err.message)
  }
}

// Called immediately after a trade closes for real-time equity curve updates
export async function recordSnapshot(userId, portfolioId) {
  if (!supabase) return

  try {
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('cash_balance')
      .eq('id', portfolioId)
      .single()

    const { data: positions } = await supabase
      .from('positions')
      .select('symbol, quantity, current_price, avg_price')
      .eq('portfolio_id', portfolioId)

    let positionsValue = 0
    if (positions) {
      for (const pos of positions) {
        const priceData = getPrice(pos.symbol)
        const price = priceData?.price ?? pos.current_price ?? pos.avg_price
        positionsValue += price * pos.quantity
      }
    }

    const equity = (portfolio?.cash_balance ?? 0) + positionsValue
    await supabase.from('equity_snapshots').insert({
      user_id: userId,
      portfolio_id: portfolioId,
      equity,
      cash: portfolio?.cash_balance ?? 0,
      positions_value: positionsValue
    })
  } catch (err) {
    console.error('[snapshotService] recordSnapshot error:', err.message)
  }
}
