import { useState, useEffect } from 'react'
import { useOrders } from '../../hooks/useOrders'
import { usePortfolio } from '../../hooks/usePortfolio'
import { usePriceContext } from '../../context/PriceContext'
import { useToast } from '../../context/ToastContext'

export function OrderForm({ symbol, market, onOrderPlaced }) {
  const { prices } = usePriceContext()
  const { portfolios } = usePortfolio(market)
  const { placeOrder } = useOrders(market)
  const { addToast } = useToast()

  const [orderType, setOrderType] = useState('market')
  const [side, setSide] = useState('buy')
  const [positionSide, setPositionSide] = useState('long')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const priceData = prices[symbol]
  const currentPrice = priceData?.price
  const portfolio = portfolios?.find(p => p.market === market)

  const estimatedPrice = orderType === 'limit' && limitPrice ? parseFloat(limitPrice) : currentPrice
  const estimatedCost = estimatedPrice && quantity ? estimatedPrice * parseFloat(quantity) : null

  const currency = market === 'IN' ? '₹' : '$'
  const cashBalance = portfolio?.cash_balance ?? 0

  // Auto-set position side based on order side
  useEffect(() => {
    if (side === 'buy') setPositionSide('long')
    else setPositionSide('long') // default sell = close long; user can toggle to short
  }, [side])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!symbol || !quantity || parseFloat(quantity) <= 0) {
      addToast('error', 'Enter a valid quantity')
      return
    }
    if (orderType === 'limit' && !limitPrice) {
      addToast('error', 'Enter a limit price')
      return
    }
    if (!portfolio) {
      addToast('error', 'Portfolio not found')
      return
    }

    setSubmitting(true)
    try {
      await placeOrder({
        symbol,
        market,
        orderType,
        side,
        positionSide,
        quantity: parseFloat(quantity),
        limitPrice: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        portfolioId: portfolio.id
      })
      addToast('order', `${side === 'buy' ? 'Buy' : 'Sell'} order placed for ${quantity} ${symbol}`)
      setQuantity('')
      setLimitPrice('')
      onOrderPlaced?.()
    } catch (err) {
      addToast('error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isShortSell = side === 'sell' && positionSide === 'short'

  return (
    <div className="p-3 border-b border-border-color">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-primary text-sm font-medium">{symbol || '—'}</h3>
        {currentPrice && (
          <span className="text-text-primary font-mono text-sm">
            {currency}{currentPrice.toLocaleString(market === 'IN' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {/* Buy / Sell */}
      <div className="flex rounded overflow-hidden border border-border-color mb-3">
        <button
          type="button"
          onClick={() => setSide('buy')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${side === 'buy' ? 'bg-trade-green text-white' : 'text-text-secondary hover:text-text-primary'}`}
        >
          BUY
        </button>
        <button
          type="button"
          onClick={() => setSide('sell')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${side === 'sell' ? 'bg-trade-red text-white' : 'text-text-secondary hover:text-text-primary'}`}
        >
          SELL
        </button>
      </div>

      {/* Order type */}
      <div className="flex rounded overflow-hidden border border-border-color mb-3">
        <button
          type="button"
          onClick={() => setOrderType('market')}
          className={`flex-1 py-1.5 text-xs transition-colors ${orderType === 'market' ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Market
        </button>
        <button
          type="button"
          onClick={() => setOrderType('limit')}
          className={`flex-1 py-1.5 text-xs transition-colors ${orderType === 'limit' ? 'bg-bg-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Limit
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Position side toggle (only for sell) */}
        {side === 'sell' && (
          <div className="mb-3">
            <label className="block text-text-secondary text-xs mb-1">Position</label>
            <div className="flex rounded overflow-hidden border border-border-color">
              <button
                type="button"
                onClick={() => setPositionSide('long')}
                className={`flex-1 py-1.5 text-xs transition-colors ${positionSide === 'long' ? 'bg-trade-green/20 text-trade-green' : 'text-text-secondary'}`}
              >
                Close Long
              </button>
              <button
                type="button"
                onClick={() => setPositionSide('short')}
                className={`flex-1 py-1.5 text-xs transition-colors ${positionSide === 'short' ? 'bg-trade-red/20 text-trade-red' : 'text-text-secondary'}`}
              >
                Sell Short
              </button>
            </div>
          </div>
        )}

        {/* Quantity */}
        <div className="mb-3">
          <label className="block text-text-secondary text-xs mb-1">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="0"
            min="0"
            step="1"
            className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue"
          />
        </div>

        {/* Limit price */}
        {orderType === 'limit' && (
          <div className="mb-3">
            <label className="block text-text-secondary text-xs mb-1">Limit Price</label>
            <input
              type="number"
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              placeholder={currentPrice ? currentPrice.toFixed(2) : '0.00'}
              min="0"
              step="0.01"
              className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue"
            />
          </div>
        )}

        {/* Estimated cost */}
        {estimatedCost != null && (
          <div className="flex justify-between text-xs mb-3">
            <span className="text-text-secondary">Estimated Cost</span>
            <span className={`font-mono font-medium ${side === 'buy' ? 'text-trade-red' : 'text-trade-green'}`}>
              {currency}{estimatedCost.toLocaleString(market === 'IN' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Cash balance */}
        <div className="flex justify-between text-xs mb-3">
          <span className="text-text-secondary">Available</span>
          <span className="text-text-primary font-mono">
            {currency}{cashBalance.toLocaleString(market === 'IN' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !symbol || !quantity}
          className={`w-full py-2.5 text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            side === 'buy'
              ? 'bg-trade-green hover:bg-trade-green/90 text-white'
              : 'bg-trade-red hover:bg-trade-red/90 text-white'
          }`}
        >
          {submitting ? 'Placing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol || '—'}`}
        </button>

        {isShortSell && (
          <p className="text-text-secondary text-xs mt-1 text-center">⚠️ Short selling — profit if price falls</p>
        )}
      </form>
    </div>
  )
}
