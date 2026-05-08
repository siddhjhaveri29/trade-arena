import { useState } from 'react'
import { useOrders } from '../../hooks/useOrders'
import { usePortfolio } from '../../hooks/usePortfolio'
import { useToast } from '../../context/ToastContext'
import { usePriceContext } from '../../context/PriceContext'

const TABS = ['Positions', 'Orders', 'Trades']

export function OrderBook({ market }) {
  const [activeTab, setActiveTab] = useState('Positions')
  const { pendingOrders, filledOrders, cancelOrder } = useOrders(market)
  const { positions, trades } = usePortfolio(market)
  const { prices } = usePriceContext()
  const { addToast } = useToast()

  async function handleCancel(orderId) {
    try {
      await cancelOrder(orderId)
      addToast('info', 'Order cancelled')
    } catch (err) {
      addToast('error', err.message)
    }
  }

  const currency = market === 'IN' ? '₹' : '$'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border-color flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab ? 'text-trade-blue border-b-2 border-trade-blue' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
            {tab === 'Orders' && pendingOrders.length > 0 && (
              <span className="ml-1 text-xs bg-trade-yellow/20 text-trade-yellow rounded-full px-1">{pendingOrders.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'Positions' && (
          <PositionsTab positions={positions.filter(p => p.market === market)} prices={prices} currency={currency} market={market} />
        )}
        {activeTab === 'Orders' && (
          <OrdersTab pendingOrders={pendingOrders} filledOrders={filledOrders} currency={currency} onCancel={handleCancel} market={market} />
        )}
        {activeTab === 'Trades' && (
          <TradesTab trades={trades.filter(t => t.market === market)} currency={currency} />
        )}
      </div>
    </div>
  )
}

function PositionsTab({ positions, prices, currency, market }) {
  if (positions.length === 0) {
    return <EmptyState message="No open positions" />
  }

  return (
    <div className="p-2 space-y-2">
      {positions.map(pos => {
        const priceData = prices[pos.symbol]
        const ltp = priceData?.price ?? pos.current_price ?? pos.avg_price
        const pnl = pos.side === 'long'
          ? (ltp - pos.avg_price) * pos.quantity
          : (pos.avg_price - ltp) * pos.quantity
        const pnlPct = pos.avg_price ? (pnl / (pos.avg_price * pos.quantity)) * 100 : 0
        const isPos = pnl >= 0

        return (
          <div key={pos.id} className="bg-bg-card rounded p-2.5 border border-border-color">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-medium text-xs">{pos.symbol}</span>
                <span className={`text-xs px-1 rounded ${pos.side === 'long' ? 'bg-trade-green/20 text-trade-green' : 'bg-trade-red/20 text-trade-red'}`}>
                  {pos.side === 'long' ? 'LONG' : 'SHORT'}
                </span>
              </div>
              <span className={`text-xs font-mono font-medium ${isPos ? 'text-trade-green' : 'text-trade-red'}`}>
                {isPos ? '+' : ''}{currency}{Math.abs(pnl).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Qty: {pos.quantity}</span>
              <span>Avg: {currency}{pos.avg_price?.toFixed(2)}</span>
              <span>LTP: {currency}{ltp?.toFixed(2)}</span>
              <span className={isPos ? 'text-trade-green' : 'text-trade-red'}>
                {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OrdersTab({ pendingOrders, filledOrders, currency, onCancel, market }) {
  if (pendingOrders.length === 0 && filledOrders.length === 0) {
    return <EmptyState message="No orders yet" />
  }

  return (
    <div className="p-2 space-y-2">
      {pendingOrders.length > 0 && (
        <>
          <div className="text-text-secondary text-xs px-1 pt-1">Pending</div>
          {pendingOrders.filter(o => !market || o.market === market).map(order => (
            <div key={order.id} className="bg-bg-card rounded p-2.5 border border-trade-yellow/30 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-xs font-medium">{order.symbol}</span>
                  <span className={`text-xs ${order.side === 'buy' ? 'text-trade-green' : 'text-trade-red'}`}>
                    {order.side.toUpperCase()} {order.order_type.toUpperCase()}
                  </span>
                </div>
                <div className="text-text-secondary text-xs mt-0.5">
                  {order.quantity} @ {order.limit_price ? `${currency}${order.limit_price}` : 'Market'}
                </div>
              </div>
              <button
                onClick={() => onCancel(order.id)}
                className="text-trade-red text-xs hover:underline"
              >
                Cancel
              </button>
            </div>
          ))}
        </>
      )}
      {filledOrders.length > 0 && (
        <>
          <div className="text-text-secondary text-xs px-1 pt-1">Filled</div>
          {filledOrders.filter(o => !market || o.market === market).slice(0, 20).map(order => (
            <div key={order.id} className="bg-bg-card rounded p-2.5 border border-border-color">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary text-xs font-medium">{order.symbol}</span>
                  <span className={`text-xs ${order.side === 'buy' ? 'text-trade-green' : 'text-trade-red'}`}>
                    {order.side.toUpperCase()}
                  </span>
                </div>
                <span className="text-text-secondary text-xs font-mono">
                  {currency}{order.filled_price?.toFixed(2)}
                </span>
              </div>
              <div className="text-text-secondary text-xs mt-0.5">
                {order.quantity} shares · {new Date(order.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function TradesTab({ trades }) {
  if (trades.length === 0) return <EmptyState message="No trades yet" />

  return (
    <div className="p-2 space-y-1.5">
      {trades.slice(0, 30).map(trade => {
        const isClosing = (trade.side === 'sell' && trade.position_side === 'long') ||
          (trade.side === 'buy' && trade.position_side === 'short')
        const isProfit = isClosing && (trade.pnl ?? 0) >= 0
        const currency = trade.market === 'IN' ? '₹' : '$'

        return (
          <div key={trade.id} className="flex items-center justify-between px-2 py-1.5 bg-bg-card rounded border border-border-color">
            <div className="flex items-center gap-2">
              <span className="text-text-primary text-xs font-medium">{trade.symbol}</span>
              <span className={`text-xs ${trade.side === 'buy' ? 'text-trade-green' : 'text-trade-red'}`}>
                {trade.side.toUpperCase()}
              </span>
              <span className="text-text-secondary text-xs">{trade.quantity}@{currency}{trade.price?.toFixed(2)}</span>
            </div>
            {isClosing && (
              <span className={`text-xs font-mono ${isProfit ? 'text-trade-green' : 'text-trade-red'}`}>
                {isProfit ? '+' : ''}{currency}{(trade.pnl ?? 0).toFixed(2)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex items-center justify-center h-24 text-text-secondary text-xs">
      {message}
    </div>
  )
}
