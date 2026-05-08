import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePortfolio } from '../../hooks/usePortfolio'
import { MarketStatusBadges } from './MarketStatus'

export function Navbar({ onSymbolSelect, activeMarket = 'IN' }) {
  const { user, profile, signOut } = useAuth()
  const { portfolios } = usePortfolio()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchMarket, setSearchMarket] = useState(activeMarket)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef(null)
  const userMenuRef = useRef(null)
  const debounceRef = useRef(null)
  const navigate = useNavigate()

  // Total P&L across all portfolios
  const totalPnl = portfolios.reduce((sum, p) => {
    const pnl = p.total_value - p.initial_balance
    return sum + pnl
  }, 0)
  const hasPnl = portfolios.length > 0

  function handleSearchChange(e) {
    const q = e.target.value
    setSearchQuery(q)
    clearTimeout(debounceRef.current)
    if (q.trim().length < 1) { setSearchResults([]); return }
    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || ''
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}&market=${searchMarket}`)
        const data = await res.json()
        setSearchResults(Array.isArray(data) ? data : [])
      } catch (e) {/* ignore */} finally { setSearchLoading(false) }
    }, 300)
  }

  function handleSelect(item) {
    setSearchQuery('')
    setSearchResults([])
    if (onSymbolSelect) onSymbolSelect(item.symbol, searchMarket)
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchResults([])
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <header className="flex items-center justify-between h-12 px-4 bg-bg-secondary border-b border-border-color flex-shrink-0">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 flex-shrink-0">
        <div className="w-6 h-6 rounded bg-trade-green flex items-center justify-center">
          <span className="text-white text-xs font-bold">T</span>
        </div>
        <span className="text-trade-green font-bold text-sm tracking-wide">TradeArena</span>
      </Link>

      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-md mx-6" ref={searchRef}>
        <div className="flex rounded border border-border-color overflow-hidden text-xs">
          <button
            className={`px-2 py-1 ${searchMarket === 'IN' ? 'bg-trade-blue text-white' : 'bg-bg-card text-text-secondary'}`}
            onClick={() => setSearchMarket('IN')}
          >IN</button>
          <button
            className={`px-2 py-1 ${searchMarket === 'US' ? 'bg-trade-blue text-white' : 'bg-bg-card text-text-secondary'}`}
            onClick={() => setSearchMarket('US')}
          >US</button>
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search symbols..."
            className="w-full bg-bg-card border border-border-color rounded px-3 py-1.5 text-xs text-text-primary placeholder-text-secondary outline-none focus:border-trade-blue"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-bg-card border border-border-color rounded shadow-xl z-50 max-h-48 overflow-y-auto">
              {searchResults.map(item => (
                <button
                  key={`${item.symbol}-${item.market}`}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-bg-hover text-left"
                  onClick={() => handleSelect(item)}
                >
                  <div>
                    <span className="text-text-primary font-medium">{item.symbol}</span>
                    <span className="text-text-secondary ml-2">{item.name}</span>
                  </div>
                  <span className="text-text-secondary">{item.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <MarketStatusBadges />

        {hasPnl && (
          <div className="text-xs font-medium">
            <span className="text-text-secondary mr-1">P&L</span>
            <span className={totalPnl >= 0 ? 'text-trade-green' : 'text-trade-red'}>
              {totalPnl >= 0 ? '+' : ''}
              {totalPnl >= 0
                ? `₹${Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                : `-₹${Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              }
            </span>
          </div>
        )}

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="flex items-center gap-2 hover:bg-bg-hover rounded px-2 py-1"
          >
            <div className="w-6 h-6 rounded-full bg-trade-blue flex items-center justify-center text-white text-xs font-bold">
              {profile?.display_name?.[0]?.toUpperCase() ?? profile?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span className="text-text-secondary text-xs">{profile?.display_name ?? profile?.username ?? 'User'}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-bg-card border border-border-color rounded shadow-xl z-50">
              <Link to="/" className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-hover" onClick={() => setShowUserMenu(false)}>
                📈 Terminal
              </Link>
              <Link to="/journal" className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-hover" onClick={() => setShowUserMenu(false)}>
                📒 Journal
              </Link>
              <Link to="/groups" className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-hover" onClick={() => setShowUserMenu(false)}>
                🏆 Groups
              </Link>
              <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-bg-hover" onClick={() => setShowUserMenu(false)}>
                👤 Profile
              </Link>
              <div className="border-t border-border-color" />
              <button
                onClick={() => { signOut(); setShowUserMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-trade-red hover:bg-bg-hover"
              >
                🚪 Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
