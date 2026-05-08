import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const PRESETS_IN = [100000, 500000, 1000000, 5000000]
const PRESETS_US = [5000, 10000, 25000, 100000]

function formatIN(v) { return `₹${(v / 100000).toFixed(0)}L` }
function formatUS(v) { return v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}` }

function CapitalSelector({ label, currency, presets, value, onChange, formatter }) {
  const [custom, setCustom] = useState('')
  const [showCustom, setShowCustom] = useState(!presets.includes(value))

  function handleCustomChange(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setCustom(raw)
    if (raw) onChange(Number(raw))
  }

  function handlePreset(v) {
    setShowCustom(false)
    setCustom('')
    onChange(v)
  }

  function handleCustomToggle() {
    setShowCustom(true)
    setCustom(value ? String(value) : '')
  }

  return (
    <div>
      <label className="block text-text-secondary text-xs mb-2">{label}</label>
      <div className="flex gap-1.5 flex-wrap items-center">
        {presets.map(c => (
          <button key={c} type="button" onClick={() => handlePreset(c)}
            className={`px-3 py-1.5 rounded border text-xs transition-colors ${!showCustom && value === c ? 'border-trade-blue bg-trade-blue/10 text-trade-blue' : 'border-border-color text-text-secondary hover:border-text-secondary'}`}>
            {formatter(c)}
          </button>
        ))}
        <button type="button" onClick={handleCustomToggle}
          className={`px-3 py-1.5 rounded border text-xs transition-colors ${showCustom ? 'border-trade-blue bg-trade-blue/10 text-trade-blue' : 'border-border-color text-text-secondary hover:border-text-secondary'}`}>
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-text-secondary text-sm">{currency}</span>
          <input
            type="text"
            inputMode="numeric"
            value={custom}
            onChange={handleCustomChange}
            placeholder="Enter amount"
            className="flex-1 bg-bg-secondary border border-trade-blue rounded px-3 py-1.5 text-sm text-text-primary outline-none"
          />
        </div>
      )}
    </div>
  )
}

export default function RegisterPage() {
  const { signUp, completeOnboarding } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    email: '', password: '', username: '', displayName: '',
    markets: ['IN'],
    capitalIN: 500000,
    capitalUS: 10000
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  function toggleMarket(market) {
    setForm(f => {
      const has = f.markets.includes(market)
      if (has && f.markets.length === 1) return f
      return { ...f, markets: has ? f.markets.filter(m => m !== market) : [...f.markets, market] }
    })
  }

  async function handleStep1(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const data = await signUp(form.email, form.password)
      setUserId(data.user?.id)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2(e) {
    e.preventDefault()
    setError('')
    if (form.username.length < 3) { setError('Username must be at least 3 characters'); return }
    setLoading(true)
    try {
      await completeOnboarding({
        userId,
        username: form.username,
        displayName: form.displayName || form.username,
        markets: form.markets,
        initialBalances: { IN: form.capitalIN, US: form.capitalUS }
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-trade-green flex items-center justify-center">
            <span className="text-white font-bold">T</span>
          </div>
          <span className="text-trade-green font-bold text-xl tracking-wide">TradeArena</span>
        </div>

        <div className="bg-bg-card border border-border-color rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step >= s ? 'bg-trade-blue text-white' : 'bg-bg-hover text-text-secondary'}`}>
                  {s}
                </div>
                <div className={`text-xs ${step === s ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {s === 1 ? 'Account' : 'Setup'}
                </div>
                {s < 2 && <div className="flex-1 h-px bg-border-color" />}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-trade-red/10 border border-trade-red/30 rounded px-3 py-2 text-trade-red text-xs mb-4">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-3">
              <div>
                <label className="block text-text-secondary text-xs mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                  className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary outline-none focus:border-trade-blue"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-text-secondary text-xs mb-1">Password</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required
                  className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary outline-none focus:border-trade-blue"
                  placeholder="Min. 6 characters" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-trade-green hover:bg-trade-green/90 text-white text-sm font-medium rounded transition-colors disabled:opacity-50">
                {loading ? 'Creating account...' : 'Continue →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="space-y-4">
              <h2 className="text-text-primary font-medium text-sm">Set up your profile</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary text-xs mb-1">Username *</label>
                  <input value={form.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required
                    className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary outline-none focus:border-trade-blue"
                    placeholder="sid_trades" />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs mb-1">Display Name</label>
                  <input value={form.displayName} onChange={e => set('displayName', e.target.value)}
                    className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary outline-none focus:border-trade-blue"
                    placeholder="Sid" />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary text-xs mb-2">Which markets do you want to trade?</label>
                <div className="flex gap-2">
                  {[{ key: 'IN', flag: '🇮🇳', name: 'Indian Markets' }, { key: 'US', flag: '🇺🇸', name: 'US Markets' }].map(m => (
                    <button key={m.key} type="button" onClick={() => toggleMarket(m.key)}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border transition-colors text-xs ${form.markets.includes(m.key) ? 'border-trade-blue bg-trade-blue/10 text-trade-blue' : 'border-border-color text-text-secondary hover:border-text-secondary'}`}>
                      <span className="text-2xl">{m.flag}</span>
                      <span>{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {form.markets.includes('IN') && (
                <CapitalSelector
                  label="Starting Capital (Indian Portfolio)"
                  currency="₹"
                  presets={PRESETS_IN}
                  value={form.capitalIN}
                  onChange={v => set('capitalIN', v)}
                  formatter={formatIN}
                />
              )}

              {form.markets.includes('US') && (
                <CapitalSelector
                  label="Starting Capital (US Portfolio)"
                  currency="$"
                  presets={PRESETS_US}
                  value={form.capitalUS}
                  onChange={v => set('capitalUS', v)}
                  formatter={formatUS}
                />
              )}

              <button type="submit" disabled={loading || !form.username}
                className="w-full py-2.5 bg-trade-green hover:bg-trade-green/90 text-white text-sm font-medium rounded transition-colors disabled:opacity-50">
                {loading ? 'Setting up...' : '🚀 Start Trading'}
              </button>
            </form>
          )}

          {step === 1 && (
            <p className="text-center text-text-secondary text-xs mt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-trade-blue hover:underline">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
