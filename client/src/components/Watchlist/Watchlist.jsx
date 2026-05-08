import { useState, useRef, useEffect } from 'react'
import { useWatchlist } from '../../hooks/useOrders'
import { usePriceContext } from '../../context/PriceContext'
import { useToast } from '../../context/ToastContext'

export function Watchlist({ onSymbolSelect, selectedSymbol, activeMarket, onMarketChange }) {
  const { items, loading, addToWatchlist, removeFromWatchlist } = useWatchlist()
  const { prices } = usePriceContext()
  const { addToast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const debounceRef = useRef(null)
  const searchRef = useRef(null)

  const indianItems = items.filter(i => i.market === 'IN')
  const usItems = items.filter(i => i.market === 'US')

  function handleSearchChange(e) {
    const q = e.target.value
    setSearchQuery(q)
    clearTimeout(debounceRef.current)
    if (q.trim().length < 1) { setSearchResults([]); return }
    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&market=${activeMarket}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch (e) {/* ignore */} finally { setSearchLoading(false) }
    }, 300)
  }

  async function handleAddSymbol(item) {
    try {
      await addToWatchlist({
        symbol: item.symbol,
        displayName: item.name,
        market: activeMarket,
        yahooKey: item.yahooKey
      })
      setSearchQuery('')
      setSearchResults([])
      setShowSearch(false)
      addToast('success', `Added ${item.symbol} to watchlist`)
    } catch (err) {
      addToast('error', err.message)
    }
  }

  async function handleRemove(e, id, symbol) {
    e.stopPropagation()
    try {
      await removeFromWatchlist(id)
      addToast('info', `Removed ${symbol} from watchlist`)
    } catch (err) {
      addToast('error', err.message)
    }
  }

  useEffect(() => {
    function handler(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchResults([])
        setShowSearch(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="flex flex-col h-full bg-bg-secondary overflow-hidden">
      {/* Market tabs */}
      <div className="flex border-b border-border-color flex-shrink-0">
        <button
          onClick={() => onMarketChange?.('IN')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${activeMarket === 'IN' ? 'text-trade-blue border-b-2 border-trade-blue' : 'text-text-secondary hover:text-text-primary'}`}
        >
          🇮🇳 India
        </button>
        <button
          onClick={() => onMarketChange?.('US')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${activeMarket === 'US' ? 'text-trade-blue border-b-2 border-trade-blue' : 'text-text-secondary hover:text-text-primary'}`}
        >
          🇺🇸 US
        </button>
      </div>

      {/* Watchlist items */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-text-secondary text-xs text-center">Loading...</div>
        ) : (
          <>
            <WatchlistSection
              items={activeMarket === 'IN' ? indianItems : usItems}
              prices={prices}
              selectedSymbol={selectedSymbol}
              market={activeMarket}
              onSelect={onSymbolSelect}
              onRemove={handleRemove}
            />
            {(activeMarket === 'IN' ? indianItems : usItems).length === 0 && (
              <div className="p-4 text-center text-text-secondary text-xs">
                No symbols yet.<br />Add some below.
              </div>
            )}
          </>
        )}
      </div>

      {/* Add symbol */}
      <div className="border-t border-border-color flex-shrink-0 p-2" ref={searchRef}>
        {showSearch ? (
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={`Search ${activeMarket === 'IN' ? 'NSE/MCX' : 'US'} symbols...`}
              className="w-full bg-bg-card border border-border-color rounded px-2 py-1.5 text-xs text-text-primary placeholder-text-secondary outline-none focus:border-trade-blue"
            />
            {searchResults.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-bg-card border border-border-color rounded shadow-xl max-h-48 overflow-y-auto z-50">
                {searchResults.map(item => (
                  <button
                    key={`${item.symbol}-${activeMarket}`}
                    className="w-full flex items-center justify-between px-2 py-2 text-xs hover:bg-bg-hover text-left"
                    onClick={() => handleAddSymbol(item)}
                  >
                    <div>
                      <span className="text-text-primary font-medium">{item.symbol}</span>
                      <span className="text-text-secondary ml-1 truncate">{item.name?.substring(0, 20)}</span>
                    </div>
                    <span className="text-trade-green text-xs ml-1">+</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          >
            <span>+</span> Add Symbol
          </button>
        )}
      </div>
    </div>
  )
}

function WatchlistSection({ items, prices, selectedSymbol, market, onSelect, onRemove }) {
  return (
    <div>
      {items.map(item => {
        const priceData = prices[item.symbol]
        const price = priceData?.price ?? item.price
        const changePct = priceData?.changePercent ?? item.changePercent ?? 0
        const isUp = changePct >= 0
        const isSelected = selectedSymbol === item.symbol

        return (
          <button
            key={item.id}
            onClick={() => onSelect?.(item.symbol, market, { yahooKey: item.yahoo_key, exchange: item.exchange })}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-bg-hover group transition-colors border-l-2 ${
              isSelected ? 'bg-bg-hover border-trade-blue' : 'border-transparent'
            } ${isUp ? 'hover:border-trade-green' : 'hover:border-trade-red'}`}
          >
            <div className="flex flex-col items-start min-w-0">
              <span className="text-text-primary font-medium">{item.symbol}</span>
              <span className="text-text-secondary text-xs truncate">{item.display_name || item.symbol}</span>
            </div>
            <div className="flex flex-col items-end ml-2">
              <span className="text-text-primary font-mono">
                {price != null
                  ? market === 'IN'
                    ? `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                    : `$${price.toFixed(2)}`
                  : '—'}
              </span>
              <div className="flex items-center gap-1">
                <span className={`font-mono ${isUp ? 'text-trade-green' : 'text-trade-red'}`}>
                  {changePct != null ? `${isUp ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
                </span>
                <button
                  onClick={(e) => onRemove(e, item.id, item.symbol)}
                  className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-trade-red ml-1"
                >
                  ×
                </button>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
