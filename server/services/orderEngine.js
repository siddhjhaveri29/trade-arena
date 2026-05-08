import { makeServiceClient } from '../lib/supabase.js'

let supabase = null
let broadcastFn = null

export function init(broadcast) {
  broadcastFn = broadcast
  supabase = makeServiceClient()
}

export function start() {
  // Called after init — the tick is called by priceCache after each price update
  console.log('[orderEngine] Order engine ready')
}

export async function tick(prices) {
  if (!supabase) return

  try {
    const { data: pendingOrders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')

    if (error || !pendingOrders || pendingOrders.length === 0) return

    const fillable = pendingOrders.filter(order => {
      const priceData = prices[order.symbol]
      if (!priceData) return false
      const ltp = priceData.price

      if (order.order_type === 'market') return true
      if (order.order_type === 'limit') {
        if (order.side === 'buy') return ltp <= order.limit_price
        if (order.side === 'sell') return ltp >= order.limit_price
      }
      return false
    })

    if (fillable.length === 0) return

    await Promise.allSettled(fillable.map(order => executeOrder(order, prices)))
  } catch (err) {
    console.error('[orderEngine] tick error:', err.message)
  }
}

async function executeOrder(order, prices) {
  const priceData = prices[order.symbol]
  if (!priceData) return

  const fillPrice = priceData.price

  try {
    // 1. Get portfolio
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', order.portfolio_id)
      .single()

    if (!portfolio) return

    const totalCost = fillPrice * order.quantity

    // 2. Validate
    if (order.side === 'buy') {
      if (portfolio.cash_balance < totalCost) {
        await supabase.from('orders').update({
          status: 'rejected',
          reject_reason: 'Insufficient funds'
        }).eq('id', order.id)
        return
      }
    }

    if (order.side === 'sell' && order.position_side === 'long') {
      const { data: pos } = await supabase
        .from('positions')
        .select('quantity')
        .eq('portfolio_id', order.portfolio_id)
        .eq('symbol', order.symbol)
        .eq('side', 'long')
        .single()

      if (!pos || pos.quantity < order.quantity) {
        await supabase.from('orders').update({
          status: 'rejected',
          reject_reason: 'Insufficient position quantity'
        }).eq('id', order.id)
        return
      }
    }

    // 3. Update order to filled
    await supabase.from('orders').update({
      status: 'filled',
      filled_price: fillPrice,
      filled_quantity: order.quantity
    }).eq('id', order.id)

    // 4. Handle position and cash
    let pnl = 0
    let pnlPct = 0

    if (order.side === 'buy' && order.position_side === 'long') {
      // Opening or adding to long
      await upsertLongPosition(order, fillPrice)
      await supabase.from('portfolios').update({
        cash_balance: portfolio.cash_balance - totalCost
      }).eq('id', order.portfolio_id)

    } else if (order.side === 'sell' && order.position_side === 'long') {
      // Closing long
      const { pnl: closePnl, pnlPct: closePnlPct } = await closeLongPosition(order, fillPrice)
      pnl = closePnl
      pnlPct = closePnlPct
      await supabase.from('portfolios').update({
        cash_balance: portfolio.cash_balance + totalCost
      }).eq('id', order.portfolio_id)

    } else if (order.side === 'sell' && order.position_side === 'short') {
      // Opening short (sell short — receive cash)
      await upsertShortPosition(order, fillPrice)
      await supabase.from('portfolios').update({
        cash_balance: portfolio.cash_balance + totalCost
      }).eq('id', order.portfolio_id)

    } else if (order.side === 'buy' && order.position_side === 'short') {
      // Covering short (buy to close — pay cash)
      const { pnl: coverPnl, pnlPct: coverPnlPct } = await coverShortPosition(order, fillPrice)
      pnl = coverPnl
      pnlPct = coverPnlPct
      await supabase.from('portfolios').update({
        cash_balance: portfolio.cash_balance - totalCost
      }).eq('id', order.portfolio_id)
    }

    // 5. Record trade
    await supabase.from('trades').insert({
      user_id: order.user_id,
      portfolio_id: order.portfolio_id,
      order_id: order.id,
      symbol: order.symbol,
      market: order.market,
      side: order.side,
      position_side: order.position_side,
      quantity: order.quantity,
      price: fillPrice,
      pnl,
      pnl_percentage: pnlPct
    })

    // 6. Notify via WebSocket
    if (broadcastFn) {
      const action = order.side === 'buy' ? 'Bought' : 'Sold'
      broadcastFn({
        type: 'order_filled',
        userId: order.user_id,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: fillPrice,
        pnl,
        message: `${action} ${order.quantity} ${order.symbol} @ ${formatPrice(fillPrice, order.market)}`
      })
    }

    console.log(`[orderEngine] Filled order ${order.id}: ${order.side} ${order.quantity} ${order.symbol} @ ${fillPrice}`)
  } catch (err) {
    console.error(`[orderEngine] executeOrder error for ${order.id}:`, err.message)
  }
}

async function upsertLongPosition(order, fillPrice) {
  const { data: existing } = await supabase
    .from('positions')
    .select('*')
    .eq('portfolio_id', order.portfolio_id)
    .eq('symbol', order.symbol)
    .eq('side', 'long')
    .single()

  if (existing) {
    const totalQty = existing.quantity + order.quantity
    const newAvg = (existing.quantity * existing.avg_price + order.quantity * fillPrice) / totalQty
    await supabase.from('positions').update({
      quantity: totalQty,
      avg_price: newAvg,
      current_price: fillPrice
    }).eq('id', existing.id)
  } else {
    await supabase.from('positions').insert({
      user_id: order.user_id,
      portfolio_id: order.portfolio_id,
      symbol: order.symbol,
      market: order.market,
      side: 'long',
      quantity: order.quantity,
      avg_price: fillPrice,
      current_price: fillPrice
    })
  }
}

async function closeLongPosition(order, fillPrice) {
  const { data: pos } = await supabase
    .from('positions')
    .select('*')
    .eq('portfolio_id', order.portfolio_id)
    .eq('symbol', order.symbol)
    .eq('side', 'long')
    .single()

  if (!pos) return { pnl: 0, pnlPct: 0 }

  const pnl = (fillPrice - pos.avg_price) * order.quantity
  const pnlPct = pos.avg_price ? ((fillPrice - pos.avg_price) / pos.avg_price) * 100 : 0

  const remainingQty = pos.quantity - order.quantity
  if (remainingQty <= 0.000001) {
    await supabase.from('positions').delete().eq('id', pos.id)
  } else {
    await supabase.from('positions').update({
      quantity: remainingQty,
      current_price: fillPrice
    }).eq('id', pos.id)
  }

  return { pnl, pnlPct }
}

async function upsertShortPosition(order, fillPrice) {
  const { data: existing } = await supabase
    .from('positions')
    .select('*')
    .eq('portfolio_id', order.portfolio_id)
    .eq('symbol', order.symbol)
    .eq('side', 'short')
    .single()

  if (existing) {
    const totalQty = existing.quantity + order.quantity
    const newAvg = (existing.quantity * existing.avg_price + order.quantity * fillPrice) / totalQty
    await supabase.from('positions').update({
      quantity: totalQty,
      avg_price: newAvg,
      current_price: fillPrice
    }).eq('id', existing.id)
  } else {
    await supabase.from('positions').insert({
      user_id: order.user_id,
      portfolio_id: order.portfolio_id,
      symbol: order.symbol,
      market: order.market,
      side: 'short',
      quantity: order.quantity,
      avg_price: fillPrice,
      current_price: fillPrice
    })
  }
}

async function coverShortPosition(order, fillPrice) {
  const { data: pos } = await supabase
    .from('positions')
    .select('*')
    .eq('portfolio_id', order.portfolio_id)
    .eq('symbol', order.symbol)
    .eq('side', 'short')
    .single()

  if (!pos) return { pnl: 0, pnlPct: 0 }

  // Short PnL: profit when price falls
  const pnl = (pos.avg_price - fillPrice) * order.quantity
  const pnlPct = pos.avg_price ? ((pos.avg_price - fillPrice) / pos.avg_price) * 100 : 0

  const remainingQty = pos.quantity - order.quantity
  if (remainingQty <= 0.000001) {
    await supabase.from('positions').delete().eq('id', pos.id)
  } else {
    await supabase.from('positions').update({
      quantity: remainingQty,
      current_price: fillPrice
    }).eq('id', pos.id)
  }

  return { pnl, pnlPct }
}

function formatPrice(price, market) {
  return market === 'IN'
    ? `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : `$${price.toFixed(2)}`
}
