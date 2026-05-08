import { useState } from 'react'
import { Navbar } from '../components/shared/Navbar'
import { useAuth, apiFetch } from '../context/AuthContext'
import { usePortfolio, useStats, useEquityCurve } from '../hooks/usePortfolio'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useToast } from '../context/ToastContext'

const PERIODS = ['1W', '1M', '3M', '6M', '1Y', 'ALL']

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const { portfolios } = usePortfolio()
  const { addToast } = useToast()
  const [activeMarket, setActiveMarket] = useState('IN')
  const [chartPeriod, setChartPeriod] = useState('1M')
  const [editMode, setEditMode] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [showAddFunds, setShowAddFunds] = useState(false)
  const [fundsAmount, setFundsAmount] = useState('')
  const [addingFunds, setAddingFunds] = useState(false)

  const { stats } = useStats(activeMarket)
  const { snapshots, initialBalance } = useEquityCurve(activeMarket, chartPeriod)

  const portfolio = portfolios.find(p => p.market === activeMarket)
  const currency = activeMarket === 'IN' ? '₹' : '$'

  // Prepare equity curve data
  const chartData = snapshots.map(s => ({
    date: new Date(s.snapshot_at).toLocaleDateString(),
    equity: s.equity,
    returnPct: initialBalance ? ((s.equity - initialBalance) / initialBalance) * 100 : 0
  }))

  async function handleAddFunds() {
    const amount = parseFloat(fundsAmount)
    if (!amount || amount <= 0) return addToast('error', 'Enter a valid amount')
    setAddingFunds(true)
    try {
      const res = await apiFetch('/api/portfolio/add-funds', {
        method: 'POST',
        body: { market: activeMarket, amount }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add funds')
      const currency = activeMarket === 'IN' ? '₹' : '$'
      addToast('success', `Added ${currency}${amount.toLocaleString()} to your ${activeMarket === 'IN' ? 'India' : 'US'} portfolio`)
      setShowAddFunds(false)
      setFundsAmount('')
      // Reload the page to refresh portfolio values
      window.location.reload()
    } catch (err) {
      addToast('error', err.message)
    } finally {
      setAddingFunds(false)
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: { displayName, bio }
      })
      if (!res.ok) throw new Error('Failed to save')
      addToast('success', 'Profile updated')
      refreshProfile()
      setEditMode(false)
    } catch (err) {
      addToast('error', err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      <Navbar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
          {/* Profile header */}
          <div className="bg-bg-card border border-border-color rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-trade-blue flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                {(profile?.display_name || profile?.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                {editMode ? (
                  <div className="space-y-2">
                    <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                      placeholder="Display Name"
                      className="w-full bg-bg-secondary border border-border-color rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-trade-blue" />
                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
                      placeholder="Bio (optional)"
                      className="w-full bg-bg-secondary border border-border-color rounded px-3 py-1.5 text-sm text-text-primary outline-none focus:border-trade-blue resize-none" />
                    <div className="flex gap-2">
                      <button onClick={handleSaveProfile} disabled={savingProfile}
                        className="px-3 py-1 bg-trade-blue text-white text-xs rounded disabled:opacity-50">
                        {savingProfile ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditMode(false)} className="px-3 py-1 border border-border-color text-text-secondary text-xs rounded">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h1 className="text-text-primary font-semibold text-lg">{profile?.display_name || profile?.username}</h1>
                      <button onClick={() => setEditMode(true)} className="text-text-secondary text-xs hover:text-text-primary border border-border-color rounded px-2 py-0.5">
                        Edit
                      </button>
                    </div>
                    <p className="text-text-secondary text-xs">@{profile?.username}</p>
                    {profile?.bio && <p className="text-text-secondary text-sm mt-1">{profile.bio}</p>}
                    <p className="text-text-secondary text-xs mt-1">{user?.email}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Market selector */}
          <div className="flex gap-2">
            {portfolios.map(p => (
              <button
                key={p.market}
                onClick={() => setActiveMarket(p.market)}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${activeMarket === p.market ? 'border-trade-blue bg-trade-blue/10 text-trade-blue' : 'border-border-color text-text-secondary hover:bg-bg-hover'}`}
              >
                {p.market === 'IN' ? '🇮🇳 India' : '🇺🇸 US'}
              </button>
            ))}
          </div>

          {/* Portfolio summary */}
          {portfolio && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard title="Total Value"
                  value={`${currency}${(portfolio.total_value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  color="text-text-primary"
                />
                <StatCard title="Cash Balance"
                  value={`${currency}${(portfolio.cash_balance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  color="text-text-primary"
                />
                <StatCard title="Total Return"
                  value={`${(portfolio.total_return_pct ?? 0) >= 0 ? '+' : ''}${(portfolio.total_return_pct ?? 0).toFixed(2)}%`}
                  color={(portfolio.total_return_pct ?? 0) >= 0 ? 'text-trade-green' : 'text-trade-red'}
                />
                <StatCard title="Starting Capital"
                  value={`${currency}${(portfolio.initial_balance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                  color="text-text-secondary"
                />
              </div>

              {/* Add Funds */}
              {showAddFunds ? (
                <div className="bg-bg-card border border-border-color rounded-xl p-4">
                  <h3 className="text-text-primary text-sm font-medium mb-3">
                    Add Funds to {activeMarket === 'IN' ? '🇮🇳 India' : '🇺🇸 US'} Portfolio
                  </h3>
                  <div className="flex gap-2 items-center">
                    <span className="text-text-secondary text-sm">{currency}</span>
                    <input
                      type="number"
                      min="1"
                      max="10000000"
                      value={fundsAmount}
                      onChange={e => setFundsAmount(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddFunds()}
                      placeholder={activeMarket === 'IN' ? '100000' : '10000'}
                      className="flex-1 bg-bg-secondary border border-border-color rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-trade-blue"
                      autoFocus
                    />
                    <button
                      onClick={handleAddFunds}
                      disabled={addingFunds || !fundsAmount}
                      className="px-4 py-2 bg-trade-green text-white text-sm rounded hover:opacity-90 disabled:opacity-50 font-medium"
                    >
                      {addingFunds ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setShowAddFunds(false); setFundsAmount('') }}
                      className="px-3 py-2 border border-border-color text-text-secondary text-sm rounded hover:bg-bg-hover"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-text-secondary text-xs mt-2">
                    This adds virtual paper trading funds. Maximum {currency}10,000,000 per transaction.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddFunds(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-trade-green text-trade-green text-sm rounded-lg hover:bg-trade-green/10 transition-colors"
                >
                  <span>+</span> Add Funds
                </button>
              )}
            </div>
          )}

          {/* Equity curve */}
          {chartData.length > 0 && (
            <div className="bg-bg-card border border-border-color rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-text-primary font-medium text-sm">Equity Curve</h2>
                <div className="flex gap-1">
                  {PERIODS.map(p => (
                    <button key={p} onClick={() => setChartPeriod(p)}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${chartPeriod === p ? 'bg-trade-blue text-white' : 'text-text-secondary hover:text-text-primary'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fill: '#787B86', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#787B86', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}%`} />
                  <ReferenceLine y={0} stroke="#2A2E39" strokeDasharray="3 3" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-bg-secondary border border-border-color rounded p-2 text-xs">
                          <p className="text-text-secondary">{d.date}</p>
                          <p className="text-text-primary">{currency}{d.equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                          <p className={d.returnPct >= 0 ? 'text-trade-green' : 'text-trade-red'}>
                            {d.returnPct >= 0 ? '+' : ''}{d.returnPct.toFixed(2)}%
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="returnPct"
                    stroke="#26A69A"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trading stats */}
          {stats && stats.totalTrades > 0 && (
            <div className="bg-bg-card border border-border-color rounded-xl p-4">
              <h2 className="text-text-primary font-medium text-sm mb-3">Trading Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard title="Total Trades" value={stats.totalTrades} color="text-text-primary" />
                <StatCard title="Win Rate" value={`${(stats.winRate ?? 0).toFixed(1)}%`}
                  color={(stats.winRate ?? 0) >= 50 ? 'text-trade-green' : 'text-trade-red'} />
                <StatCard title="Realized P&L"
                  value={`${(stats.totalPnl ?? 0) >= 0 ? '+' : ''}${currency}${Math.abs(stats.totalPnl ?? 0).toFixed(0)}`}
                  color={(stats.totalPnl ?? 0) >= 0 ? 'text-trade-green' : 'text-trade-red'} />
                <StatCard title="Avg P&L per Trade"
                  value={`${(stats.avgPnl ?? 0) >= 0 ? '+' : ''}${currency}${Math.abs(stats.avgPnl ?? 0).toFixed(0)}`}
                  color={(stats.avgPnl ?? 0) >= 0 ? 'text-trade-green' : 'text-trade-red'} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color = 'text-text-primary' }) {
  return (
    <div className="bg-bg-secondary border border-border-color rounded-lg p-3">
      <p className="text-text-secondary text-xs mb-1">{title}</p>
      <p className={`text-lg font-mono font-bold ${color}`}>{value}</p>
    </div>
  )
}
