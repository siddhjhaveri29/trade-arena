import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'

export function useOrders(market) {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOrders = useCallback(async () => {
    if (!user) return
    try {
      const url = market ? `/api/orders?market=${market}` : '/api/orders'
      const res = await apiFetch(url)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user, market])

  useEffect(() => {
    if (!user) return
    fetchOrders()
    const interval = setInterval(fetchOrders, 3000)
    return () => clearInterval(interval)
  }, [user, market])

  // Listen for WS order_filled events for immediate refresh
  useEffect(() => {
    const handler = () => fetchOrders()
    window.addEventListener('order_filled', handler)
    return () => window.removeEventListener('order_filled', handler)
  }, [fetchOrders])

  const placeOrder = useCallback(async (orderData) => {
    const res = await apiFetch('/api/orders', { method: 'POST', body: orderData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    fetchOrders()
    return data.order
  }, [fetchOrders])

  const cancelOrder = useCallback(async (orderId) => {
    const res = await apiFetch(`/api/orders/${orderId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    fetchOrders()
    return data
  }, [fetchOrders])

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const filledOrders = orders.filter(o => o.status === 'filled')

  return { orders, pendingOrders, filledOrders, loading, error, placeOrder, cancelOrder, refetch: fetchOrders }
}

export function useWatchlist(market) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWatchlist = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      const url = market ? `/api/watchlist?market=${market}` : '/api/watchlist'
      const res = await apiFetch(url)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {/* ignore */}
    finally { setLoading(false) }
  }, [user, market])

  useEffect(() => {
    fetchWatchlist()
    const interval = setInterval(fetchWatchlist, 5000)
    return () => clearInterval(interval)
  }, [user, market])

  const addToWatchlist = useCallback(async (symbolData) => {
    const res = await apiFetch('/api/watchlist', { method: 'POST', body: symbolData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    fetchWatchlist()
    return data
  }, [fetchWatchlist])

  const removeFromWatchlist = useCallback(async (id) => {
    const res = await apiFetch(`/api/watchlist/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to remove')
    fetchWatchlist()
  }, [fetchWatchlist])

  return { items, loading, addToWatchlist, removeFromWatchlist, refetch: fetchWatchlist }
}
