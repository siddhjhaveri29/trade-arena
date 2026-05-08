import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-trade-green flex items-center justify-center">
            <span className="text-white font-bold">T</span>
          </div>
          <span className="text-trade-green font-bold text-xl tracking-wide">TradeArena</span>
        </div>

        <div className="bg-bg-card border border-border-color rounded-xl p-6">
          <h1 className="text-text-primary text-lg font-semibold mb-1 text-center">Welcome back</h1>
          <p className="text-text-secondary text-xs text-center mb-5">Sign in to your trading account</p>

          {error && (
            <div className="bg-trade-red/10 border border-trade-red/30 rounded px-3 py-2 text-trade-red text-xs mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-text-secondary text-xs mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary outline-none focus:border-trade-blue"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-xs mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-bg-secondary border border-border-color rounded px-3 py-2.5 text-sm text-text-primary outline-none focus:border-trade-blue"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-trade-green hover:bg-trade-green/90 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 mt-1"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-text-secondary text-xs mt-4">
            Don't have an account?{' '}
            <Link to="/register" className="text-trade-blue hover:underline">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
