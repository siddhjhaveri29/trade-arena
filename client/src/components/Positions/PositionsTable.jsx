import { useState } from 'react'
import { usePortfolio } from '../../hooks/usePortfolio'
import { useOrders } from '../../hooks/useOrders'
import { usePriceContext } from '../../context/PriceContext'
import { useToast } from '../../context/ToastContext'

export function PositionsTable({ market }) {
  const { positions, trades, portfolios, loading } = usePortfolio(market)
  const { placeOrder } = useOrders(market)
  const { prices } = usePriceContext()
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('Positions')
  const [closingId, setClosingId] = useState(null)

  const portfolio = portfolios?.find(p => p.market === market)
  const currency = market === 'IN' ? '₹' : '$'

  const filteredPositions = positions.filter(p => p.market === market)
  const filteredTrades = trades.filter(t => t.market === market)

  // Summary calculations
  const unrealizedPnl = filteredPositions.reduce((sum, pos) => {
    const ltp = prices[pos.symbol]?.price ?? pos.current_price ?? pos.avg_price
    const pnl = pos.side === 'long'
      ? (ltp - pos.avg_price) * pos.quantity
      : (pos.avg_price - ltp) * pos.quantity
    return sum + pnl
  }, 0)

  async function handleClose(pos) {
    if (!portfolio) return
    setClosingId(pos.id)
    try {
      await placeOrder({
        symbol: pos.symbol,
        market: pos.market,
        orderType: 'market',
        side: pos.side === 'long' ? 'sell' : 'buy',
        positionSide: pos.side,
        quantity: pos.quantity,
        portfolioId: portfolio.id
      })
      addToast('trade', `Closing ${pos.symbol} position...`)
    } catch (err) {
      addToast('error', err.message)
    } finally {
      setClosingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      {portfolio && (
        <div className="flex items-center gap-6 px-4 py-2 bg-bg-secondary border-b border-border-color text-xs flex-shrink-0">
          <div>
            <span className="text-text-secondary">Cash</span>
            <span className="text-text-primary ml-2 font-mono">
              {currency}{(portfolio.cash_balance ?? 0).toLocaleString(market === 'IN' ? 'en-IN' : 'en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div>
            <span className="text-text-secondary">Unrealized P&L</span>
            <span className={`ml-2 font-mono font-medium ${unrealizedPnl >= 0 ? 'text-trade-green' : 'text-trade-red'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}{currency}{Math.abs(unrealizedPnl).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-text-secondary">Return</span>
            <span className={`ml-2 font-mono font-medium ${(portfolio.total_return_pct ?? 0) >= 0 ? 'text-trade-green' : 'text-trade-red'}`}>
              {(portfolio.total_return_pct ?? 0) >= 0 ? '+' : ''}{(portfolio.total_return_pct ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border-color flex-shrink-0">
        {['Positions', 'Trades'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${activeTab === tab ? 'text-trade-blue border-b-2 border-trade-blue' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {tab}
            {tab === 'Positions' && filteredPositions.length > 0 && (
              <span className="ml-1 text-xs bg-bg-hover text-text-secondary rounded-full px-1.5">{filteredPositions.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-16 text-text-secondary text-xs">Loading...</div>
        ) : activeTab === 'Positions' ? (
          filteredPositions.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-text-secondary text-xs">No open positions</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-secondary border-b border-border-color">
                  <th className="text-left px-3 py-1.5 font-normal">Symbol</th>
                  <th className="text-left px-3 py-1.5 font-normal">Side</th>
                  <th className="text-right px-3 py-1.5 font-normal">Qty</th>
                  <th className="text-right px-3 py-1.5 font-normal">Avg Price</th>
                  <th className="text-right px-3 py-1.5 font-normal">LTP</th>
                  <th className="text-right px-3 py-1.5 font-normal">P&L</th>
                  <th className="text-right px-3 py-1.5 font-normal">P&L%</th>
                  <th className="text-right px-3 py-1.5 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map(pos => {
                  const ltp = prices[pos.symbol]?.price ?? pos.current_price ?? pos.avg_price
                  const pnl = pos.side === 'long'
                    ? (ltp - pos.avg_price) * pos.quantity
                    : (pos.avg_price - ltp) * pos.quantity
                  const pnlPct = pos.avg_price ? (pnl / (pos.avg_price * pos.quantity)) * 100 : 0
                  const isPos = pnl >= 0

                  return (
                    <tr key={pos.id} className="border-b border-border-color hover:bg-bg-hover">
                      <td className="px-3 py-2 font-medium text-text-primary">{pos.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${pos.side === 'long' ? 'bg-trade-green/20 text-trade-green' : 'bg-trade-red/20 text-trade-red'}`}>
                          {pos.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-text-primary font-mono">{pos.quantity}</td>
                      <td className="px-3 py-2 text-right text-text-secondary font-mono">{currency}{pos.avg_price?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-text-primary font-mono">{currency}{ltp?.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-medium ${isPos ? 'text-trade-green' : 'text-trade-red'}`}>
                        {isPos ? '+' : ''}{currency}{Math.abs(pnl).toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${isPos ? 'text-trade-green' : 'text-trade-red'}`}>
                        {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleClose(pos)}
                          disabled={closingId === pos.id}
                          className="text-xs px-2 py-0.5 rounded border border-border-color text-text-secondary hover:border-trade-red hover:text-trade-red transition-colors disabled:opacity-50"
                        >
                          {closingId === pos.id ? '...' : 'Close'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : (
          filteredTrades.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-text-secondary text-xs">No trades yet</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-secondary border-b border-border-color">
                  <th className="text-left px-3 py-1.5 font-normal">Symbol</th>
                  <th className="text-left px-3 py-1.5 font-normal">Side</th>
                  <th className="text-right px-3 py-1.5 font-normal">Qty</th>
                  <th className="text-right px-3 py-1.5 font-normal">Price</th>
                  <th className="text-right px-3 py-1.5 font-normal">P&L</th>
                  <th className="text-right px-3 py-1.5 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.slice(0, 50).map(trade => {
                  const isClosing = (trade.side === 'sell' && trade.position_side === 'long') ||
                    (trade.side === 'buy' && trade.position_side === 'short')
                  const isPos = (trade.pnl ?? 0) >= 0
                  return (
                    <tr key={trade.id} className="border-b border-border-color hover:bg-bg-hover">
                      <td className="px-3 py-2 font-medium text-text-primary">{trade.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={trade.side === 'buy' ? 'text-trade-green' : 'text-trade-red'}>
                          {trade.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-text-primary font-mono">{trade.quantity}</td>
                      <td className="px-3 py-2 text-right text-text-secondary font-mono">{currency}{trade.price?.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${isClosing ? (isPos ? 'text-trade-green' : 'text-trade-red') : 'text-text-secondary'}`}>
                        {isClosing ? `${isPos ? '+' : ''}${currency}${Math.abs(trade.pnl ?? 0).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary">
                        {new Date(trade.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
