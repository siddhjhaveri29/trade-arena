import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'

export function usePortfolio(market) {
  const { user } = useAuth()
  const [portfolios, setPortfolios] = useState([])
  const [positions, setPositions] = useState([])
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPortfolios = useCallback(async () => {
    if (!user) return
    try {
      const res = await apiFetch('/api/portfolio')
      const data = await res.json()
      setPortfolios(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    }
  }, [user])

  const fetchPositions = useCallback(async () => {
    if (!user) return
    try {
      const url = market ? `/api/portfolio/positions?market=${market}` : '/api/portfolio/positions'
      const res = await apiFetch(url)
      const data = await res.json()
      setPositions(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, market])

  const fetchTrades = useCallback(async () => {
    if (!user) return
    try {
      const url = market ? `/api/portfolio/trades?market=${market}` : '/api/portfolio/trades'
      const res = await apiFetch(url)
      const data = await res.json()
      setTrades(Array.isArray(data) ? data : [])
    } catch (e) {/* ignore */}
  }, [user, market])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchPortfolios()
    fetchPositions()
    fetchTrades()

    const interval = setInterval(() => {
      fetchPortfolios()
      fetchPositions()
    }, 5000)

    return () => clearInterval(interval)
  }, [user, market])

  const refetch = useCallback(() => {
    fetchPortfolios()
    fetchPositions()
    fetchTrades()
  }, [fetchPortfolios, fetchPositions, fetchTrades])

  const activePortfolio = market ? portfolios.find(p => p.market === market) : portfolios[0]

  return { portfolios, activePortfolio, positions, trades, loading, error, refetch }
}

export function useStats(market) {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const url = market ? `/api/portfolio/stats?market=${market}` : '/api/portfolio/stats'
    apiFetch(url)
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user, market])

  return { stats, loading }
}

export function useEquityCurve(market = 'IN', period = '1M') {
  const { user } = useAuth()
  const [data, setData] = useState({ snapshots: [], initialBalance: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    apiFetch(`/api/portfolio/equity-curve?market=${market}&period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user, market, period])

  return { ...data, loading }
}
